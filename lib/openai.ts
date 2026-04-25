// Server-side OpenAI callers via plain fetch.
// We avoid the openai SDK because it relies on Promise.try (Node 22+).

const OPENAI_CHAT_URL = "https://api.openai.com/v1/chat/completions";
const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";

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
    const res = await fetch(OPENAI_CHAT_URL, {
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

type ResponsesOutput = {
  type: string;
  role?: string;
  content?: Array<{ type: string; text?: string }>;
};

type ResponsesResponse = {
  output?: ResponsesOutput[];
  error?: { message?: string };
};

// Calls the OpenAI Responses API with web_search enabled. Used for the
// research agent: the model decides what to search and how deep to go.
// Returns the raw text content of the last "message" output item.
export async function chatResponsesJSON(
  apiKey: string,
  systemPrompt: string,
  userInput: string,
  opts?: { model?: string; signal?: AbortSignal; tools?: Array<Record<string, unknown>> }
): Promise<{ ok: true; raw: string } | { ok: false; reason: string }> {
  try {
    const res = await fetch(OPENAI_RESPONSES_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      signal: opts?.signal,
      body: JSON.stringify({
        model: opts?.model ?? "gpt-4o-mini",
        tools: opts?.tools ?? [{ type: "web_search_preview" }],
        input: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userInput },
        ],
      }),
    });

    const json = (await res.json()) as ResponsesResponse;
    if (!res.ok || json.error) {
      return { ok: false, reason: json.error?.message ?? `openai_${res.status}` };
    }

    const messageOutput = json.output?.findLast((o) => o.type === "message");
    const text = messageOutput?.content?.find((c) => c.type === "output_text")?.text;

    if (!text) {
      return { ok: false, reason: "empty_response" };
    }

    return { ok: true, raw: text };
  } catch (err) {
    return { ok: false, reason: (err as Error).message ?? "openai_error" };
  }
}

// Strip code fences and trailing prose around a JSON blob.
// Deep research models sometimes wrap JSON in ```json ... ``` even when asked not to.
export function extractJSONBlock(raw: string): string {
  const trimmed = raw.trim();
  // Try fenced code block first.
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch) return fenceMatch[1].trim();
  // Find the outermost {...}.
  const first = trimmed.indexOf("{");
  const last = trimmed.lastIndexOf("}");
  if (first !== -1 && last > first) return trimmed.slice(first, last + 1);
  return trimmed;
}
