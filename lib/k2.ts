import type { ChatMessage } from "./openai";

type ChatResponse = {
  choices?: Array<{ message?: { content?: string } }>;
  error?: { message?: string };
};

const DEFAULT_BASE_URL = "https://api.k2think.ai/v1";
const DEFAULT_MODEL = "MBZUAI-IFM/K2-Think-v2";

function resolveK2Auth(): { baseUrl: string; apiKey: string; model: string } {
  return {
    baseUrl: (process.env.K2THINK_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/+$/, ""),
    apiKey: process.env.K2THINK_API_KEY ?? "",
    model: process.env.K2THINK_MODEL ?? DEFAULT_MODEL,
  };
}

export function hasK2Credentials(): boolean {
  return (process.env.K2THINK_API_KEY ?? "").trim().length > 0;
}

export async function k2ChatJSON(
  messages: ChatMessage[],
  opts?: { model?: string; temperature?: number; signal?: AbortSignal }
): Promise<{ ok: true; raw: string } | { ok: false; reason: string }> {
  const auth = resolveK2Auth();
  if (!auth.apiKey) return { ok: false, reason: "no_k2_api_key" };

  try {
    const res = await fetch(`${auth.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${auth.apiKey}`,
      },
      signal: opts?.signal,
      body: JSON.stringify({
        model: opts?.model ?? auth.model,
        temperature: opts?.temperature ?? 0,
        messages,
      }),
    });

    const json = (await res.json()) as ChatResponse;
    if (!res.ok || json.error) {
      return { ok: false, reason: json.error?.message ?? `k2_${res.status}` };
    }
    let raw = json.choices?.[0]?.message?.content ?? "{}";
    // K2 Think V2 embeds chain-of-thought in the content field,
    // delimited by </think>. Strip the reasoning prefix.
    const thinkEnd = raw.indexOf("</think>");
    if (thinkEnd !== -1) {
      raw = raw.slice(thinkEnd + "</think>".length).trim();
    }
    return { ok: true, raw };
  } catch (err) {
    return { ok: false, reason: (err as Error).message ?? "k2_error" };
  }
}
