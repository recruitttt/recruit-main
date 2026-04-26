// Scout dock tool definitions — Server-side. The model can call these to
// mutate the user's profile, kick off intake adapters, or surface a UI hint.
//
// Bound at request-time with the user's authenticated userId so the model
// can never fan out to other users.

import { tool } from "ai";
import { ConvexHttpClient } from "convex/browser";
import { z } from "zod";
import { api } from "@/convex/_generated/api";

const SETTABLE_PATHS = [
  "headline",
  "summary",
  "location",
  "prefs.workAuth",
  "prefs.minSalary",
  "prefs.locations",
  "prefs.companySizes",
  "prefs.roles",
] as const;

type SettablePath = (typeof SETTABLE_PATHS)[number];

export interface ScoutToolContext {
  userId: string;
  origin: string;
  convexUrl: string;
}

export function scoutTools(ctx: ScoutToolContext) {
  const convex = new ConvexHttpClient(ctx.convexUrl);

  return {
    setProfileField: tool({
      description: [
        "Persist a single profile field with provenance='chat'. Only use for",
        "fields the user has confirmed in conversation (headline, summary,",
        "location, work-auth, salary floor, location preferences, company-size",
        "preferences, role focus). Do NOT invent values.",
      ].join(" "),
      inputSchema: z.object({
        path: z.enum(SETTABLE_PATHS).describe("Profile field path"),
        value: z
          .union([z.string(), z.array(z.string())])
          .describe("New value (string or array depending on path)"),
      }),
      execute: async ({ path, value }) => {
        const patch = patchByPath(path, value);
        const provenance: Record<string, string> = {};
        provenance[firstSegment(path)] = "chat";
        try {
          await convex.mutation(api.userProfiles.merge, {
            userId: ctx.userId,
            patch,
            provenance,
            label: `Scout dock: set ${path}`,
          });
          return { ok: true, path };
        } catch (err) {
          return { ok: false, error: errorMessage(err) };
        }
      },
    }),

    triggerSourceIntake: tool({
      description: [
        "Kick off an intake adapter when the user mentions a source they",
        "haven't connected yet. For github, return action='oauth' so the",
        "client can run the OAuth flow (no URL needed). For linkedin/devpost/",
        "website, a profile URL must be supplied.",
      ].join(" "),
      inputSchema: z.object({
        kind: z.enum(["github", "linkedin", "devpost", "website"]),
        url: z.string().url().optional(),
      }),
      execute: async ({ kind, url }) => {
        if (kind === "github") {
          return { action: "oauth", provider: "github" } as const;
        }
        if (!url) return { ok: false, error: "url_required" } as const;

        try {
          if (kind === "linkedin") {
            const res = await fetch(`${ctx.origin}/api/intake/linkedin`, {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ profileUrl: url }),
            });
            if (!res.ok) {
              return { ok: false, error: `linkedin_${res.status}` } as const;
            }
            return { ok: true, kind, url } as const;
          }

          await convex.action(api.intakeActions.runWebIntake, {
            userId: ctx.userId,
            url,
            kind,
          });
          return { ok: true, kind, url } as const;
        } catch (err) {
          return { ok: false, error: errorMessage(err) } as const;
        }
      },
    }),

    suggestNextStep: tool({
      description: [
        "Surface an inline UI hint such as 'You're almost done — try",
        "uploading your resume next' when the user is mid-task. The hint",
        "renders as a chip below the dock; the user can tap to act.",
      ].join(" "),
      inputSchema: z.object({
        suggestion: z.string().min(2).max(160),
        actionLabel: z.string().min(2).max(40).optional(),
        targetStep: z
          .enum(["account", "resume", "connect", "prefs", "activate"])
          .optional(),
      }),
      execute: async ({ suggestion, actionLabel, targetStep }) => ({
        ok: true,
        suggestion,
        actionLabel,
        targetStep,
      }),
    }),
  };
}

function firstSegment(path: SettablePath): string {
  return path.split(".")[0];
}

function patchByPath(
  path: SettablePath,
  value: string | string[],
): Record<string, unknown> {
  const segments = path.split(".");
  const root: Record<string, unknown> = {};
  let cursor: Record<string, unknown> = root;
  for (let i = 0; i < segments.length - 1; i += 1) {
    const next: Record<string, unknown> = {};
    cursor[segments[i]] = next;
    cursor = next;
  }
  cursor[segments[segments.length - 1]] = value;
  return root;
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message.slice(0, 200);
  return String(err).slice(0, 200);
}
