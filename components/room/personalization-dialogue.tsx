"use client";

import { useEffect, useState } from "react";
import { useAction, useQuery } from "convex/react";
import { Send, X } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { convexRefs } from "@/lib/convex-refs";
import { useRoomStore } from "./room-store";
import { gapsFromPersonalization, pickNextQuestion } from "@/lib/personalization/questions";
import type { PersonalizationQuestion } from "@/lib/personalization/types";

type Props = { userId: string | null };

type ProfileDoc = { profile?: { personalization?: Parameters<typeof gapsFromPersonalization>[0] } } | null | undefined;

export function PersonalizationDialogue({ userId }: Props) {
  const open = useRoomStore((s) => s.personalizationOpen);
  const setOpen = useRoomStore((s) => s.setPersonalizationOpen);
  const profile = useQuery(api.userProfiles.byUser, userId ? { userId } : "skip") as ProfileDoc;
  const respond = useAction(convexRefs.personalizationAgent.respondToUser);
  const [question, setQuestion] = useState<PersonalizationQuestion | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [history, setHistory] = useState<{ role: "agent" | "user"; text: string }[]>([]);

  useEffect(() => {
    if (open && !question && profile) {
      const gaps = gapsFromPersonalization(profile.profile?.personalization);
      const q = pickNextQuestion([], gaps);
      if (q) {
        setQuestion(q);
        setHistory([{ role: "agent", text: q.text }]);
      }
    }
  }, [open, question, profile]);

  if (!open) return null;

  async function handleSend() {
    if (!draft.trim() || !userId) return;
    setSending(true);
    setHistory((h) => [...h, { role: "user", text: draft }]);
    const userMessage = draft;
    setDraft("");
    try {
      const out = await respond({
        userId,
        question: question?.text,
        questionCategory: question?.category,
        userMessage,
      }) as { replyText: string };
      setHistory((h) => [...h, { role: "agent", text: out.replyText }]);
      const gaps = gapsFromPersonalization(profile?.profile?.personalization);
      const nextQ = pickNextQuestion(question ? [question.id] : [], gaps);
      if (nextQ) {
        setQuestion(nextQ);
        setHistory((h) => [...h, { role: "agent", text: nextQ.text }]);
      } else {
        setQuestion(null);
      }
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="pointer-events-auto absolute left-6 bottom-6 z-30 w-80 max-h-[60vh] flex flex-col rounded-2xl bg-white/95 shadow-xl border border-purple-200">
      <div className="flex items-center justify-between px-4 py-3 border-b border-purple-100 bg-purple-50">
        <div className="font-medium text-sm text-purple-900">Personalization Companion</div>
        <button onClick={() => setOpen(false)}><X className="h-4 w-4 text-purple-600" /></button>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-2 text-sm">
        {history.map((m, i) => (
          <div key={i} className={m.role === "user" ? "text-right" : "text-left"}>
            <div className={"inline-block px-3 py-2 rounded-lg " + (m.role === "user" ? "bg-blue-100" : "bg-purple-100")}>{m.text}</div>
          </div>
        ))}
      </div>
      <div className="p-3 border-t border-purple-100 flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleSend(); }}
          className="flex-1 px-3 py-2 text-sm border border-purple-200 rounded"
          placeholder="Share your thoughts…"
          disabled={sending}
        />
        <button onClick={handleSend} disabled={sending || !draft.trim()} className="px-3 py-2 bg-purple-600 text-white rounded disabled:opacity-50">
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
