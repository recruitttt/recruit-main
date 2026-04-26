"use client";

//
// useScoutChat — minimal AI SDK v6 UIMessage-stream consumer. Avoids the
// need to install @ai-sdk/react. Only handles text deltas + tool results;
// every other stream event type (reasoning, file, source) is ignored.
//

import { useCallback, useRef, useState } from "react";

export interface ScoutMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  toolHints?: ToolHint[];
}

export interface ToolHint {
  /** UI-side hint surfaced by the suggestNextStep tool. */
  suggestion: string;
  actionLabel?: string;
  targetStep?: "account" | "resume" | "connect" | "prefs" | "activate";
}

export type ScoutStatus = "ready" | "streaming" | "submitting" | "error";

interface UseScoutChatArgs {
  userId: string;
  surface: "onboarding" | "ready" | "dashboard";
}

export function useScoutChat({ userId, surface }: UseScoutChatArgs) {
  const [messages, setMessages] = useState<ScoutMessage[]>([]);
  const [status, setStatus] = useState<ScoutStatus>("ready");
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;

      const userMessage: ScoutMessage = {
        id: `u-${Date.now()}`,
        role: "user",
        text: trimmed,
      };
      const assistantId = `a-${Date.now()}`;
      setMessages((current) => [
        ...current,
        userMessage,
        { id: assistantId, role: "assistant", text: "" },
      ]);
      setStatus("submitting");
      setError(null);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const response = await fetch("/api/scout/chat", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-user-id": userId,
          },
          body: JSON.stringify({
            surface,
            messages: toUIMessages([...messages, userMessage]),
          }),
          signal: controller.signal,
        });

        if (!response.ok || !response.body) {
          throw new Error(`scout_${response.status}`);
        }

        setStatus("streaming");
        await consumeStream(response.body, (event) => {
          if (event.type === "text-delta" && event.delta) {
            setMessages((current) =>
              current.map((m) =>
                m.id === assistantId ? { ...m, text: m.text + event.delta } : m,
              ),
            );
          } else if (event.type === "tool-output" && event.toolName === "suggestNextStep") {
            const out = event.output as ToolHint | undefined;
            if (out?.suggestion) {
              setMessages((current) =>
                current.map((m) =>
                  m.id === assistantId
                    ? { ...m, toolHints: [...(m.toolHints ?? []), out] }
                    : m,
                ),
              );
            }
          }
        });

        setStatus("ready");
      } catch (err) {
        if (controller.signal.aborted) {
          setStatus("ready");
          return;
        }
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
        setStatus("error");
      } finally {
        abortRef.current = null;
      }
    },
    [messages, surface, userId],
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStatus("ready");
  }, []);

  const clear = useCallback(() => {
    setMessages([]);
    setStatus("ready");
    setError(null);
  }, []);

  return { messages, status, error, send, stop, clear };
}

// ---------------------------------------------------------------------------
// AI SDK v6 UIMessage-stream consumer — minimal subset
// ---------------------------------------------------------------------------

interface StreamEvent {
  type: string;
  delta?: string;
  toolName?: string;
  output?: unknown;
}

async function consumeStream(
  body: ReadableStream<Uint8Array>,
  onEvent: (event: StreamEvent) => void,
): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let idx: number;
      while ((idx = buffer.indexOf("\n")) !== -1) {
        const rawLine = buffer.slice(0, idx).trim();
        buffer = buffer.slice(idx + 1);
        if (!rawLine) continue;
        const payload = rawLine.startsWith("data:")
          ? rawLine.slice(5).trim()
          : rawLine;
        if (!payload || payload === "[DONE]") continue;
        try {
          const json = JSON.parse(payload) as Record<string, unknown>;
          const type = String(json.type ?? "");
          if (type === "text-delta") {
            onEvent({ type: "text-delta", delta: String(json.delta ?? "") });
          } else if (type === "tool-output-available" || type === "tool-result") {
            onEvent({
              type: "tool-output",
              toolName: String(
                json.toolName ?? (json as { toolName?: string }).toolName ?? "",
              ),
              output: (json as { output?: unknown }).output,
            });
          }
        } catch {
          /* ignore malformed line */
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

interface UIMessageWire {
  id: string;
  role: "user" | "assistant";
  parts: Array<{ type: "text"; text: string }>;
}

function toUIMessages(messages: ScoutMessage[]): UIMessageWire[] {
  return messages.map((m) => ({
    id: m.id,
    role: m.role,
    parts: [{ type: "text", text: m.text }],
  }));
}
