// POST { messages: [{role,content}], profileContext?: object } ->
// { ok: true, message: string, done: boolean, updates?: Partial<UserProfile> }
//
// Drives Scout's in-room intake. The model picks the next question
// dynamically based on what's already in the user's profile and what
// they've answered so far. When it has enough, it sets done=true and
// returns structured updates to merge into the profile.

import { chatJSON, type ChatMessage } from "@/lib/openai";

export const runtime = "nodejs";
export const maxDuration = 30;

const SYSTEM_PROMPT = `You are Scout, the lead agent on a job-application squad. The user just landed in their dashboard and you're approaching them for a quick intake conversation. You're warm, brief, and curious — like a friend who actually wants to help, not a form.

You have ALREADY received the user's resume, social links, and basic preferences during onboarding. Don't re-ask things you can see in profileContext. Use what's there to ask sharper, more personal follow-ups.

Goal: in 3-5 short questions, learn what they actually want from their next role. Things like:
- The job they'd take in a heartbeat (dream role)
- What they're realistically open to right now
- Hard lines on pay, location, remote, company size, mission, work style
- What they're tired of from past roles (only if natural)

Rules:
- ONE question per turn. Keep it under 25 words.
- Conversational tone — contractions, no corporate-speak. No em-dashes.
- React to what they just said before asking the next thing ("Got it." / "Makes sense." / "Oh nice.").
- After 3-5 useful answers, set done=true and write a brief one-line wrap ("Locked in — passing this to the squad.").
- If they give a low-effort answer ("idk", "anything"), gently dig once, then move on.

Always return JSON in this exact shape:
{
  "message": string,           // your next reply (a question, or the wrap-up if done)
  "done": boolean,             // true only when you have enough to brief the squad
  "updates": {                 // anything you learned this turn — omit fields you didn't learn
    "prefs": {
      "roles": string[],       // dream/target roles
      "locations": string[],   // cities, "Remote", regions
      "workAuth": string,
      "minSalary": string,     // e.g. "$140k", "$90/hr"
      "companySizes": string[] // e.g. ["seed","series A"], ["FAANG"]
    },
    "summary": string          // a 1-2 sentence narrative summary of what they're looking for, only set on the final turn
  }
}`;

export async function POST(req: Request) {
  let body: {
    messages?: ChatMessage[];
    profileContext?: Record<string, unknown>;
  };
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false, reason: "bad_request" }, { status: 400 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return Response.json({ ok: false, reason: "no_api_key" }, { status: 503 });
  }

  const history = Array.isArray(body.messages) ? body.messages : [];
  const profileContext = body.profileContext ?? {};

  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    {
      role: "system",
      content: `profileContext:\n${JSON.stringify(profileContext, null, 2)}`,
    },
    ...history,
  ];

  const result = await chatJSON(apiKey, messages, {
    model: "gpt-4o-mini",
    temperature: 0.6,
  });

  if (!result.ok) {
    return Response.json({ ok: false, reason: result.reason }, { status: 502 });
  }

  let parsed: { message?: string; done?: boolean; updates?: unknown };
  try {
    parsed = JSON.parse(result.raw);
  } catch {
    parsed = {};
  }

  const message = typeof parsed.message === "string" ? parsed.message : "";
  if (!message) {
    return Response.json(
      { ok: false, reason: "empty_message" },
      { status: 502 }
    );
  }

  return Response.json({
    ok: true,
    message,
    done: Boolean(parsed.done),
    updates: parsed.updates ?? null,
  });
}
