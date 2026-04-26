/* eslint-disable @typescript-eslint/no-explicit-any */

"use node";

import { v } from "convex/values";
import { actionGeneric, anyApi } from "convex/server";
import OpenAI from "openai";
import { extractInsight } from "../lib/personalization/insight-extractor";
import type { QuestionCategory } from "../lib/personalization/types";

const action = actionGeneric;
const MODEL = "gpt-5.4-nano";

export const respondToUser = action({
  args: {
    userId: v.string(),
    question: v.optional(v.string()),
    questionCategory: v.optional(v.string()),
    userMessage: v.string(),
  },
  returns: v.any(),
  handler: async (ctx, { userId, question, questionCategory, userMessage }) => {
    let profileDoc: { profile?: any } | null = null;
    try {
      profileDoc = await ctx.runQuery((anyApi as any).userProfiles.byUser, { userId });
    } catch {
      profileDoc = null;
    }
    const profile = profileDoc?.profile ?? {};

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const sysPrompt = `You are a friendly career personalization companion. You help the user articulate their goals, preferences, and stories so their job applications can be more authentic. Be warm, brief (1-3 sentences), curious. Avoid generic AI slop. Don't say "great answer!".`;
    const reply = await client.chat.completions.create({
      model: MODEL,
      messages: [
        { role: "system", content: sysPrompt },
        ...(question ? [{ role: "assistant" as const, content: question }] : []),
        { role: "user", content: userMessage },
      ],
    });
    const replyText = reply.choices[0]?.message.content ?? "Tell me more.";

    let updatedProfile = profile;
    if (question && questionCategory) {
      try {
        const insight = await extractInsight(client, questionCategory as QuestionCategory, question, userMessage);
        if (insight) {
          updatedProfile = applyInsight(profile, insight);
          await ctx.runMutation((anyApi as any).userProfiles.updateProfile, {
            userId,
            profile: updatedProfile,
          });
        }
      } catch {
        // ignore extraction failures
      }
    }

    return { replyText };
  },
});

function applyInsight(profile: any, insight: { field: string; value: unknown }): any {
  const next = { ...profile };
  next.personalization = { ...(profile.personalization ?? {}) };
  if (insight.field === "careerGoals") {
    next.personalization.careerGoals = insight.value as string;
  } else if (insight.field === "workEnvironment") {
    next.personalization.workEnvironment = { ...(next.personalization.workEnvironment ?? {}), ...(insight.value as object) };
  } else if (insight.field === "motivations") {
    const existing = next.personalization.motivations ?? [];
    next.personalization.motivations = Array.from(new Set([...existing, ...(insight.value as string[])]));
  } else if (insight.field === "communicationStyle") {
    next.personalization.communicationStyle = insight.value as string;
  } else if (insight.field === "valuesAlignment") {
    const existing = next.personalization.valuesAlignment ?? [];
    next.personalization.valuesAlignment = Array.from(new Set([...existing, ...(insight.value as string[])]));
  } else if (insight.field === "storyFragments") {
    const existing = next.personalization.storyFragments ?? [];
    const v = insight.value as { topic: string; story: string };
    next.personalization.storyFragments = [...existing, { ...v, updatedAt: new Date().toISOString() }];
  }
  next.personalization.lastInteractionAt = new Date().toISOString();
  return next;
}
