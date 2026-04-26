import type { ChatMessage } from "./openai";

type GeminiPart = { text?: string };

type GeminiCandidate = {
  content?: {
    parts?: GeminiPart[];
  };
};

type GeminiResponse = {
  candidates?: GeminiCandidate[];
  error?: { message?: string };
  promptFeedback?: { blockReason?: string };
};

const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";

function modelPath(model: string): string {
  return model.replace(/^models\//, "");
}

function toGeminiContents(messages: ChatMessage[]): {
  systemInstruction?: { parts: Array<{ text: string }> };
  contents: Array<{ role: "user" | "model"; parts: Array<{ text: string }> }>;
} {
  const systemParts = messages
    .filter((message) => message.role === "system")
    .map((message) => ({ text: message.content }));
  const contents = messages
    .filter((message) => message.role !== "system")
    .map((message) => ({
      role: message.role === "assistant" ? ("model" as const) : ("user" as const),
      parts: [{ text: message.content }],
    }));

  return {
    systemInstruction: systemParts.length > 0 ? { parts: systemParts } : undefined,
    contents,
  };
}

export async function geminiChatJSON(
  apiKey: string,
  messages: ChatMessage[],
  opts?: { model?: string; temperature?: number; signal?: AbortSignal }
): Promise<{ ok: true; raw: string } | { ok: false; reason: string }> {
  try {
    const model = modelPath(opts?.model ?? "gemma-4-26b-a4b-it");
    const { systemInstruction, contents } = toGeminiContents(messages);
    const res = await fetch(
      `${GEMINI_BASE_URL}/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        signal: opts?.signal,
        body: JSON.stringify({
          ...(systemInstruction ? { systemInstruction } : {}),
          contents,
          generationConfig: {
            temperature: opts?.temperature ?? 0,
            responseMimeType: "application/json",
          },
        }),
      }
    );

    const json = (await res.json()) as GeminiResponse;
    if (!res.ok || json.error) {
      return { ok: false, reason: json.error?.message ?? `gemini_${res.status}` };
    }

    const raw =
      json.candidates?.[0]?.content?.parts
        ?.map((part) => part.text ?? "")
        .join("")
        .trim() ?? "";
    if (!raw) {
      return {
        ok: false,
        reason: json.promptFeedback?.blockReason
          ? `gemini_blocked:${json.promptFeedback.blockReason}`
          : "gemini_empty_response",
      };
    }

    return { ok: true, raw };
  } catch (err) {
    return { ok: false, reason: (err as Error).message ?? "gemini_error" };
  }
}
