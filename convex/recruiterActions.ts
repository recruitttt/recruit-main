/* eslint-disable @typescript-eslint/no-explicit-any */

"use node";

import { actionGeneric, anyApi } from "convex/server";
import { v } from "convex/values";
import OpenAI from "openai";
import {
  assembleRecruiterPrompt,
  summarizeProfile,
} from "../lib/recruiter/prompt";
import { extractBrainstormedAnswer } from "../lib/recruiter/insight-extractor";

const action = actionGeneric;

// Responses API + native web_search_preview hosted tool. The model decides
// when to search; OpenAI runs the search server-side, returning citations
// inline. No external search API key required.
const MODEL = "gpt-5.4-nano";

const FIRST_NAMES = [
  "Sarah",
  "Marcus",
  "Priya",
  "James",
  "Aisha",
  "Diego",
  "Mei",
  "Jordan",
  "Ravi",
  "Elena",
  "Tomas",
  "Yuki",
  "Femi",
  "Anya",
  "Kai",
];

const LAST_NAMES = [
  "Patel",
  "Chen",
  "Rodriguez",
  "Kim",
  "Singh",
  "Nakamura",
  "Okafor",
  "Müller",
  "Silva",
  "Cohen",
  "Reyes",
  "Hassan",
];

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

function generateRecruiterName(seed: number): string {
  const fn = FIRST_NAMES[seed % FIRST_NAMES.length];
  const ln =
    LAST_NAMES[Math.floor(seed / FIRST_NAMES.length) % LAST_NAMES.length];
  return `${fn} ${ln}`;
}

function summarizeTailoredResume(
  app: {
    jsonResume?: {
      basics?: { summary?: string };
      work?: Array<{ position?: string; name?: string }>;
      skills?: Array<{ name?: string }>;
    };
  } | null,
): string {
  if (!app?.jsonResume) {
    return "(no tailored resume yet — encourage candidate to generate one from the desk)";
  }
  const parts: string[] = [];
  if (app.jsonResume.basics?.summary) parts.push(app.jsonResume.basics.summary);
  if (app.jsonResume.work?.length) {
    parts.push(
      "Highlighted roles: " +
        app.jsonResume.work
          .slice(0, 3)
          .map((w) => `${w.position ?? "(role)"} at ${w.name ?? "(co)"}`)
          .join("; "),
    );
  }
  if (app.jsonResume.skills?.length) {
    parts.push(
      "Top skills: " +
        app.jsonResume.skills
          .slice(0, 10)
          .map((s) => s.name ?? "")
          .filter(Boolean)
          .join(", "),
    );
  }
  return parts.join("\n") || "(empty)";
}

export const sendMessage = action({
  args: {
    recruiterId: v.id("recruiters"),
    userId: v.string(),
    userMessage: v.string(),
  },
  returns: v.any(),
  handler: async (ctx, { recruiterId, userId, userMessage }) => {
    const recruiter: any = await ctx.runQuery(anyApi.recruiters.getById, {
      recruiterId,
    });
    if (!recruiter) throw new Error("recruiter not found");

    await ctx.runMutation(anyApi.recruiters.appendMessage, {
      recruiterId,
      userId,
      role: "user",
      content: userMessage,
    });

    let profileDoc: { profile?: any } | null = null;
    try {
      profileDoc = (await ctx.runQuery(
        (anyApi as any).userProfiles.getProfile,
        { userId },
      )) as { profile?: any } | null;
    } catch {
      profileDoc = null;
    }
    const conversation: any = await ctx.runQuery(
      anyApi.recruiters.getConversation,
      { recruiterId },
    );
    const profile = profileDoc?.profile ?? {};

    let tailoredApp: any = null;
    try {
      tailoredApp = await ctx.runQuery(
        (anyApi as any).tailoredApplications.getByJobId,
        { jobId: recruiter.jobId },
      );
    } catch {
      tailoredApp = null;
    }

    const systemPrompt = assembleRecruiterPrompt({
      recruiter,
      userProfileSummary: summarizeProfile(profile),
      tailoredResumeSummary: summarizeTailoredResume(tailoredApp),
      personalizationSummary: profile.personalization
        ? `Career goals: ${profile.personalization.careerGoals ?? "n/a"}; Values: ${(
            profile.personalization.valuesAlignment ?? []
          ).join(", ")}`
        : "",
      conversationHistory: conversation?.messages ?? [],
    });

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const input: Array<{
      role: "system" | "user" | "assistant";
      content: string;
    }> = [
      { role: "system", content: systemPrompt },
      ...((conversation?.messages ?? []).map((m: any) => ({
        role: (m.role === "recruiter" ? "assistant" : "user") as
          | "user"
          | "assistant",
        content: m.content,
      }))),
      { role: "user", content: userMessage },
    ];

    let assistantText: string | null = null;
    try {
      const response = await client.responses.create({
        model: MODEL,
        input,
        tools: [{ type: "web_search_preview" }],
      });

      // Responses API returns an array of output items (search calls,
      // reasoning, final message). Pull the last "message" item's text.
      const messageItem = response.output?.findLast?.(
        (o: { type?: string }) => o.type === "message",
      ) as
        | { content?: Array<{ type?: string; text?: string }> }
        | undefined;
      const textPart = messageItem?.content?.find(
        (c) => c.type === "output_text",
      );
      assistantText =
        textPart?.text?.trim() ?? response.output_text?.trim() ?? null;

      // Soft-cache the latest assistant text on the recruiter row so we
      // can show "remembered company context" without re-querying.
      if (!recruiter.companyContext && assistantText) {
        await ctx.runMutation(anyApi.recruiters.setCompanyContext, {
          recruiterId,
          companyContext: assistantText.slice(0, 4000),
        });
      }
    } catch (err) {
      assistantText = `(I'm having trouble responding right now: ${(err as Error).message})`;
    }

    if (!assistantText) {
      assistantText =
        "(I'm having trouble responding right now — try again in a moment.)";
    }

    await ctx.runMutation(anyApi.recruiters.appendMessage, {
      recruiterId,
      userId,
      role: "recruiter",
      content: assistantText,
    });

    try {
      const insight = await extractBrainstormedAnswer(
        client,
        assistantText,
        userMessage,
      );
      if (insight) {
        await ctx.runMutation(anyApi.recruiters.appendBrainstormedAnswer, {
          recruiterId,
          questionType: insight.questionType,
          answer: insight.answer,
        });
      }
    } catch {
      // ignore extraction failures
    }

    return { assistantText };
  },
});

export const seedRecruiters = action({
  args: { userId: v.string() },
  returns: v.any(),
  handler: async (ctx, { userId }) => {
    let top: any[] = [];
    try {
      top = (await ctx.runQuery(
        (anyApi as any).tailoredApplications.listTopForUser,
        { userId, limit: 5 },
      )) as any[];
    } catch {
      top = [];
    }
    if (!top || top.length === 0) return { seeded: 0 };

    let seeded = 0;
    for (let i = 0; i < top.length; i++) {
      const app = top[i];
      const seed = hashString((app.company ?? "") + app._id);
      const recruiterName = generateRecruiterName(seed);
      let jobId: any;
      try {
        jobId = await ctx.runMutation(
          (anyApi as any).applicationJobs.ensureForTailoredApplication,
          {
            userId,
            tailoredApplicationId: app._id,
          },
        );
      } catch {
        continue;
      }
      await ctx.runMutation(anyApi.recruiters.upsertRecruiter, {
        userId,
        jobId,
        companyName: app.company ?? "(unknown)",
        companyDomain: app.companyDomain,
        recruiterName,
        appearanceSeed: seed,
        positionIndex: i,
      });
      seeded++;
    }
    return { seeded };
  },
});

export const applyThroughRecruiter = action({
  args: { recruiterId: v.id("recruiters"), userId: v.string() },
  returns: v.any(),
  handler: async (ctx, { recruiterId }) => {
    const recruiter: any = await ctx.runQuery(anyApi.recruiters.getById, {
      recruiterId,
    });
    if (!recruiter) throw new Error("recruiter not found");

    const applicationJobId: any = recruiter.jobId ?? null;
    let queued = false;
    try {
      const existing: any = applicationJobId
        ? await ctx.runQuery(anyApi.applicationJobs.getApplicationJob, {
            jobId: applicationJobId,
          })
        : null;
      if (existing && existing.status === "queued") {
        queued = true;
      }
    } catch {
      // best-effort lookup; fall through and treat as not-queued
    }

    await ctx.runMutation(anyApi.recruiters.setRecruiterStatus, {
      recruiterId,
      status: "applied",
    });

    return { ok: true, applicationJobId, queued };
  },
});
