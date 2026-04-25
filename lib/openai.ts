// Server-side OpenAI Chat Completions caller via plain fetch.
// We avoid the openai SDK because it relies on Promise.try (Node 22+).

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

type ChatResponse = {
  choices?: Array<{ message?: { content?: string } }>;
  error?: { message?: string };
};

export async function chatJSON(
  apiKey: string,
  messages: ChatMessage[],
  opts?: { model?: string; temperature?: number; signal?: AbortSignal }
): Promise<{ ok: true; raw: string } | { ok: false; reason: string }> {
  try {
    const res = await fetch(OPENAI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      signal: opts?.signal,
      body: JSON.stringify({
        model: opts?.model ?? "gpt-4o-mini",
        temperature: opts?.temperature ?? 0,
        response_format: { type: "json_object" },
        messages,
      }),
    });

    const json = (await res.json()) as ChatResponse;
    if (!res.ok || json.error) {
      return { ok: false, reason: json.error?.message ?? `openai_${res.status}` };
    }
    const raw = json.choices?.[0]?.message?.content ?? "{}";
    return { ok: true, raw };
  } catch (err) {
    return { ok: false, reason: (err as Error).message ?? "openai_error" };
  }
}
