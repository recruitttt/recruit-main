// LinkedIn intake adapter — implements the IntakeAdapter contract.
//
// Pipeline:
//   1. starting → load any saved cookie from convex.linkedinCookies.byUser
//   2. login    → authenticate via cookie / password / live-view (auth.ts)
//   3. scrape   → scrapeProfile() over Browserbase + Playwright (scrape.ts)
//   4. persist  → save snapshot + fresh li_at + per-experience Haiku summaries
//   5. complete → emit a UserProfile patch + provenance, plus a final event
//
// Spec: docs/superpowers/specs/2026-04-25-recruit-merge-design.md §7.2

import type { Page } from "playwright-core";
import pLimit from "p-limit";

import { api } from "@/convex/_generated/api";
import {
  experienceContentHash,
  experienceKey,
  summarizeExperience,
} from "../github/per-experience";
import type { ExperienceSummary } from "../github/types";
import type {
  IntakeAdapter,
  IntakeContext,
  IntakeProgressEvent,
  ProvenanceSource,
} from "../shared/types";
import type { UserProfile } from "@/lib/profile";

import { authenticate } from "./auth";
import {
  type BrowserbaseSessionHandle,
  formatBrowserbaseDiagnostics,
  getDebuggerUrl,
  makeBrowserbaseSession,
} from "./browserbase";
import { scrapeProfile } from "./scrape";
import {
  type LinkedInEducation,
  type LinkedInExperience,
  type LinkedInSnapshot,
} from "./types";

const PER_EXPERIENCE_CONCURRENCY = 4;

export interface LinkedInIntakeInput {
  profileUrl: string;
}

export const linkedinAdapter: IntakeAdapter<LinkedInIntakeInput> = {
  name: "linkedin",
  async *run(input, ctx): AsyncIterable<IntakeProgressEvent> {
    yield {
      stage: "starting",
      message: `LinkedIn intake for ${input.profileUrl}`,
      level: "info",
    };

    // ---- Read Browserbase + LinkedIn credentials from env ------------------
    const apiKey = (process.env.BROWSERBASE_API_KEY ?? "").trim();
    const projectId = (process.env.BROWSERBASE_PROJECT_ID ?? "").trim();
    if (!apiKey || !projectId) {
      yield {
        stage: "error",
        level: "error",
        message:
          "BROWSERBASE_API_KEY / BROWSERBASE_PROJECT_ID env vars are required for the LinkedIn adapter",
      };
      throw new Error("LinkedIn adapter requires Browserbase credentials");
    }
    const reuseSessionId = (process.env.BROWSERBASE_SESSION_ID ?? "").trim() || undefined;
    // Backwards-compat: a legacy single-file env override. New code should
    // prefer LINKEDIN_CHALLENGE_PIN_DIR (resolved inside auth.ts) so each
    // session gets its own file.
    const challengePinPathOverride =
      (process.env.LINKEDIN_CHALLENGE_PIN_FILE ?? "").trim() || undefined;
    const liEnv = (process.env.LINKEDIN_LI_AT ?? "").trim() || undefined;
    let emailEnv = (process.env.LINKEDIN_EMAIL ?? "").trim() || undefined;
    let passwordEnv = (process.env.LINKEDIN_PASSWORD ?? "").trim() || undefined;

    // Fall back to shared credentials stored in Convex env. This lets devs
    // running locally pick up the team-shared LinkedIn account without
    // populating their own `.env.local` — and keeps a single source of truth
    // for the credential rotation. The query is auth-gated.
    if (!emailEnv || !passwordEnv) {
      try {
        const shared = (await ctx.ctx.runQuery(
          api.linkedinCookies.getSharedLoginCredentials,
          {},
        )) as { email?: string; password?: string } | null;
        if (shared?.email && shared?.password) {
          emailEnv = emailEnv || shared.email;
          passwordEnv = passwordEnv || shared.password;
        }
      } catch (err) {
        // Don't fail the run if the fallback query errors — just log and
        // continue; downstream auth code will surface a clearer message if
        // both env and cookie paths are empty.
        console.warn(
          "[linkedin] shared credential fallback failed:",
          err instanceof Error ? err.message : String(err),
        );
      }
    }

    // ---- Saved cookie from Convex ----------------------------------------
    // `linkedinCookies.byUser` no longer returns the plaintext li_at — it's
    // encrypted at rest and only `getDecryptedLiAt` (identity-checked) hands
    // it back to the authenticated owner. The HTTP client running this
    // adapter forwards the better-auth session token, so identity propagates.
    let savedLiAt: string | undefined;
    const cookieRow = (await ctx.ctx.runQuery(api.linkedinCookies.getDecryptedLiAt, {
      userId: ctx.userId,
    })) as { liAt?: string | null } | null;
    if (cookieRow?.liAt) savedLiAt = cookieRow.liAt;

    // ---- Browserbase session ---------------------------------------------
    let session: BrowserbaseSessionHandle | undefined;
    let page: Page | undefined;
    try {
      session = await makeBrowserbaseSession({
        apiKey,
        projectId,
        reuseSessionId,
        keepAlive: true,
        apiTimeoutSeconds: 1800,
      });

      // `session.sessionId` is sensitive (re-attach grants browser control).
      // `session.liveViewUrl` is the embeddable Browserbase debugger frame —
      // we surface it to the authenticated session owner via the SSE stream so
      // the client can iframe the cloud Chrome. The runIntake driver strips
      // `data` from the persisted intakeRuns event log, so it never lands in
      // a queryable surface — it only travels over the live SSE channel to
      // the user who initiated the run.
      console.log(
        `[linkedin-adapter] Browserbase session ready id=${session.sessionId} ${formatBrowserbaseDiagnostics(session.diagnostics)} liveView=${session.liveViewUrl ?? "n/a"}`
      );
      yield {
        stage: "starting",
        level: "info",
        message: "Cloud browser ready",
        data: {
          ...(session.liveViewUrl ? { liveViewUrl: session.liveViewUrl } : {}),
          browserbase: session.diagnostics,
        },
      };

      page = await session.context.newPage();

      // ---- Authenticate ---------------------------------------------------
      yield { stage: "login", level: "info", message: "Authenticating with LinkedIn" };
      const authResult = await authenticate(page, {
        liAt: liEnv ?? savedLiAt,
        email: emailEnv,
        password: passwordEnv,
        sessionId: session.sessionId,
        challengePinPath: challengePinPathOverride,
        liveViewUrl: session.liveViewUrl,
      });

      if (authResult.status === "challenge") {
        // The PIN file path contains the Browserbase session id — keep both
        // server-side and tell the user to contact the operator instead.
        console.log(
          `[linkedin-adapter] email-PIN challenge unresolved pinPath=${authResult.challengePinPath} liveView=${authResult.liveViewUrl ?? "n/a"}`
        );
        yield {
          stage: "login",
          level: "warn",
          message:
            "LinkedIn email-PIN challenge timed out — contact the operator to enter the 6-digit code",
        };
        throw new Error("LinkedIn challenge unresolved within timeout");
      }

      if (authResult.status === "needs-live-view") {
        const live = authResult.liveViewUrl ?? (await getDebuggerUrl(session.client, session.sessionId));
        console.log(
          `[linkedin-adapter] needs live-view assistance reason=${authResult.reason} liveView=${live ?? "n/a"}`
        );
        yield {
          stage: "login",
          level: "warn",
          message: `LinkedIn needs you to finish sign-in in the embedded browser (${authResult.reason})`,
          data: live ? { liveViewUrl: live, needsAssistance: true } : { needsAssistance: true },
        };
        throw new Error(`LinkedIn auth requires live-view (${authResult.reason})`);
      }

      if (authResult.status === "failed") {
        yield {
          stage: "login",
          level: "error",
          message: `LinkedIn auth failed: ${authResult.reason}`,
        };
        throw new Error(authResult.reason);
      }

      // status === "ok"
      yield {
        stage: "login",
        level: "info",
        message: `Authenticated via ${authResult.mode}`,
      };

      // Persist fresh li_at to Convex for future runs.
      await ctx.ctx.runMutation(api.linkedinCookies.save, {
        userId: ctx.userId,
        liAt: authResult.liAt,
        jsessionId: authResult.jsessionId,
      });

      // ---- Scrape -----------------------------------------------------
      yield {
        stage: "scrape",
        level: "info",
        message: "Scraping LinkedIn profile + 8 detail subpages",
      };
      const events: IntakeProgressEvent[] = [];
      const snapshot = await scrapeProfile({
        page,
        profileUrl: input.profileUrl,
        onProgress: (event) => {
          events.push({ stage: event.stage, level: "info", message: event.message });
        },
      });
      for (const e of events) yield e;

      // Persist snapshot.
      await ctx.ctx.runMutation(api.linkedinSnapshots.save, {
        userId: ctx.userId,
        profileUrl: snapshot.profileUrl,
        raw: snapshot,
      });

      // ---- Per-experience Haiku summaries -----------------------------
      const expEvents = await summarizeExperiences(snapshot, ctx);
      for (const e of expEvents) yield e;

      // ---- Map snapshot → UserProfile patch ---------------------------
      const { patch, provenance } = mapSnapshotToProfile(snapshot);
      yield {
        stage: "mapper",
        level: "info",
        message: `Merging LinkedIn data into profile (${Object.keys(patch).length} fields)`,
        patch,
        provenance,
      };

      yield {
        stage: "complete",
        level: "info",
        message: "LinkedIn intake complete",
      };
    } finally {
      // Always release Playwright. The Browserbase session itself stays alive
      // (keep_alive=true) so a follow-up run can re-attach via
      // BROWSERBASE_SESSION_ID without paying the captcha tax again.
      try {
        await page?.close();
      } catch {
        /* noop */
      }
      try {
        await session?.browser.close();
      } catch {
        /* noop */
      }
    }
  },
};

// ---------------------------------------------------------------------------
// Per-experience summarization — runs in parallel (PER_EXPERIENCE_CONCURRENCY).
// Cached via experienceSummaries.byUserExperience to avoid burning Haiku calls.
// ---------------------------------------------------------------------------

async function summarizeExperiences(
  snapshot: LinkedInSnapshot,
  ctx: IntakeContext
): Promise<IntakeProgressEvent[]> {
  const experiences = snapshot.experiences;
  if (experiences.length === 0) return [];

  const events: IntakeProgressEvent[] = [
    {
      stage: "summarize",
      level: "info",
      message: `Summarizing ${experiences.length} experiences with Haiku`,
      done: 0,
      total: experiences.length,
    },
  ];

  const limit = pLimit(PER_EXPERIENCE_CONCURRENCY);
  let completed = 0;

  await Promise.all(
    experiences.map((experience) =>
      limit(async () => {
        const key = experienceKey(experience);
        const expectedHash = experienceContentHash(experience);
        const cached = (await ctx.ctx.runQuery(
          api.experienceSummaries.byUserExperience,
          { userId: ctx.userId, experienceKey: key }
        )) as { sourceContentHash?: string; summary?: ExperienceSummary } | null;

        let summary: ExperienceSummary;
        if (cached?.sourceContentHash === expectedHash && cached.summary) {
          summary = cached.summary;
        } else {
          summary = await summarizeExperience({
            experience,
            credentials: ctx.credentials,
          });
          await ctx.ctx.runMutation(api.experienceSummaries.upsert, {
            userId: ctx.userId,
            experienceKey: key,
            sourceContentHash: summary.sourceContentHash,
            summary,
            generatedByModel: summary.generatedByModel,
            generatedAt: summary.generatedAt,
          });
        }

        completed += 1;
        events.push({
          stage: "summarize",
          level: "info",
          message: `Summarized ${summary.position} @ ${summary.company}`,
          done: completed,
          total: experiences.length,
        });
      })
    )
  );
  return events;
}

// ---------------------------------------------------------------------------
// Snapshot → simple `UserProfile` patch + provenance map.
//
// The shared mapper at lib/intake/shared/mapper/linkedin.ts targets the
// fuller `ApplicationProfile` schema (which uses retired @gh-app types).
// `convex.userProfiles.merge` accepts the simpler `UserProfile` shape from
// `lib/profile.ts`, so this adapter ships its own minimal mapper that fits
// that shape.
// ---------------------------------------------------------------------------

interface SnapshotMapping {
  patch: Partial<UserProfile>;
  provenance: Record<string, ProvenanceSource>;
}

function mapSnapshotToProfile(snapshot: LinkedInSnapshot): SnapshotMapping {
  const patch: Partial<UserProfile> = {};
  const provenance: Record<string, ProvenanceSource> = {};

  if (snapshot.name) {
    patch.name = snapshot.name;
    provenance["name"] = "linkedin";
  }
  if (snapshot.location) {
    patch.location = snapshot.location;
    provenance["location"] = "linkedin";
  }
  if (snapshot.jobTitle) {
    patch.headline = snapshot.jobTitle;
    provenance["headline"] = "linkedin";
  }
  if (snapshot.about) {
    patch.summary = snapshot.about;
    provenance["summary"] = "linkedin";
  }
  if (snapshot.profileUrl) {
    patch.links = { linkedin: snapshot.profileUrl };
    provenance["links.linkedin"] = "linkedin";
  }

  const experiences = snapshot.experiences
    .map(toUserProfileExperience)
    .filter((e): e is UserProfile["experience"][number] => Boolean(e));
  if (experiences.length > 0) {
    patch.experience = experiences;
    for (const exp of experiences) {
      provenance[`experience[${exp.company}::${exp.title}]`] = "linkedin";
    }
  }

  const educations = snapshot.educations
    .map(toUserProfileEducation)
    .filter((e): e is UserProfile["education"][number] => Boolean(e));
  if (educations.length > 0) {
    patch.education = educations;
    for (const edu of educations) {
      provenance[`education[${edu.school}]`] = "linkedin";
    }
  }

  const skillNames = snapshot.skills
    .map((s) => (s.name ?? "").trim())
    .filter((s) => Boolean(s));
  if (skillNames.length > 0) {
    patch.skills = uniqueStrings(skillNames);
    for (const name of patch.skills) {
      provenance[`skills[${name}]`] = "linkedin";
    }
  }

  return { patch, provenance };
}

function toUserProfileExperience(
  e: LinkedInExperience
): UserProfile["experience"][number] | null {
  const company = (e.company ?? "").trim();
  const title = (e.position_title ?? "").trim();
  if (!company && !title) return null;
  return {
    company: company || "(unknown)",
    title: title || "(unknown)",
    startDate: e.from_date ?? undefined,
    endDate: e.to_date ?? undefined,
    description: e.description ?? undefined,
    location: e.location ?? undefined,
  };
}

function toUserProfileEducation(
  e: LinkedInEducation
): UserProfile["education"][number] | null {
  const school = (e.institution ?? "").trim();
  if (!school) return null;
  return {
    school,
    degree: e.degree ?? undefined,
    startDate: e.from_date ?? undefined,
    endDate: e.to_date ?? undefined,
  };
}

function uniqueStrings(values: ReadonlyArray<string>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of values) {
    const lower = v.toLowerCase();
    if (seen.has(lower)) continue;
    seen.add(lower);
    out.push(v);
  }
  return out;
}
