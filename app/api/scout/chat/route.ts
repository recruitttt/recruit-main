// Scout dock chat endpoint — streams assistant responses with tool use.
// The system prompt is cached as ephemeral so a typical 8-turn dock session
// stays cheap on Anthropic billing.

import { convertToModelMessages, stepCountIs, streamText, type UIMessage } from "ai";
import { z } from "zod";
import { detectCredentials, pickModel } from "@/lib/intake/github/models";
import { scoutTools } from "@/components/scout/scout-tools";

const MAX_STEPS = 5;

const SCOUT_SYSTEM_PROMPT = `You are Scout — the lead agent of a five-mascot squad helping a job seeker stand up their profile on Recruit. You speak warmly, briefly, with the confidence of a senior friend who has done this many times.

Your job in the dock:
- Pull useful information out of the user that the data adapters cannot guess (headline, ideal company size, locations, salary floor, dream/blocked companies).
- Kick off source intakes when the user mentions one (github / linkedin / devpost / personal site).
- Surface short next-step suggestions ("you're almost done — link LinkedIn next") when natural.

Hard rules:
- Never invent profile data. Only call setProfileField with values the user just confirmed.
- Never ask for passwords, social-security numbers, full addresses, or anything that could be PII beyond a city.
- Keep replies under three sentences unless the user explicitly asks for longer.
- If the user wants to skip the chat, tell them where the same fields live in the UI and stop nudging.
- Whenever you push a field, briefly say what you saved ("Got it — saved your headline").
- Never use the words 'sorry' or 'apologize' — be direct and matter-of-fact.

Squad context (use only when relevant):
- Mimi reads the user's resume.
- Pip pulls the user's GitHub.
- Juno reads LinkedIn.
- Bodhi crawls personal sites and DevPost.

If the user is silent or off-topic, default to the next missing high-value field.`;

const RequestSchema = z.object({
  messages: z.array(z.unknown()),
  surface: z.enum(["onboarding", "ready", "dashboard"]).default("onboarding"),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "invalid_body", parsed.error.flatten());
  }

  const userId = req.headers.get("x-user-id");
  if (!userId) return jsonError(401, "no_user_id");

  const credentials = detectCredentials();
  if (!credentials) return jsonError(503, "no_anthropic_credentials");

  const { model } = pickModel("fast", credentials);
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) return jsonError(503, "no_convex_url");

  const origin = new URL(req.url).origin;

  const result = streamText({
    model,
    system: SCOUT_SYSTEM_PROMPT,
    messages: await convertToModelMessages(parsed.data.messages as UIMessage[]),
    tools: scoutTools({ userId, origin, convexUrl }),
    stopWhen: stepCountIs(MAX_STEPS),
    providerOptions: {
      // Anthropic prompt caching — system prompt + tool defs are stable, so
      // cache them as ephemeral. Yields ~70%+ cache-read on a typical session.
      anthropic: {
        cacheControl: { type: "ephemeral" },
      },
    },
  });

  return result.toUIMessageStreamResponse();
}

function jsonError(status: number, code: string, detail?: unknown) {
  return new Response(
    JSON.stringify({ ok: false, error: code, detail }),
    {
      status,
      headers: { "content-type": "application/json" },
    },
  );
}
