"use client";

import { useState } from "react";
import { useAction, useQuery } from "convex/react";
import { Send, X } from "lucide-react";
import { convexRefs } from "@/lib/convex-refs";
import { useRoomStore } from "./room-store";

type Props = {
  userId: string | null;
};

type Message = { role: string; content: string; timestamp?: string };

export function RecruiterDialogue({ userId }: Props) {
  const activeRecruiterId = useRoomStore((s) => s.activeRecruiterId);
  const setActiveRecruiterId = useRoomStore((s) => s.setActiveRecruiterId);
  const recruiter = useQuery(
    convexRefs.recruiters.getById,
    activeRecruiterId ? { recruiterId: activeRecruiterId as never } : "skip",
  ) as { _id: string; recruiterName: string; companyName: string } | null | undefined;
  const conversation = useQuery(
    convexRefs.recruiters.getConversation,
    activeRecruiterId ? { recruiterId: activeRecruiterId as never } : "skip",
  ) as { messages: Message[] } | null | undefined;
  const sendMessage = useAction(convexRefs.recruiterActions.sendMessage);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  if (!activeRecruiterId || !recruiter) return null;

  async function handleSend() {
    if (!draft.trim() || !userId || !activeRecruiterId) return;
    setSending(true);
    try {
      await sendMessage({ recruiterId: activeRecruiterId as never, userId, userMessage: draft });
      setDraft("");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="pointer-events-auto absolute right-6 top-6 z-30 w-96 max-h-[70vh] flex flex-col rounded-2xl bg-white/95 shadow-xl border border-black/5">
      <div className="flex items-center justify-between px-4 py-3 border-b border-black/5">
        <div>
          <div className="font-medium text-sm">{recruiter.recruiterName}</div>
          <div className="text-xs text-gray-500">{recruiter.companyName}</div>
        </div>
        <button onClick={() => setActiveRecruiterId(null)} className="text-gray-500 hover:text-gray-900">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {(conversation?.messages ?? []).map((m, i) => (
          <div key={i} className={m.role === "user" ? "text-right" : "text-left"}>
            <div className={"inline-block px-3 py-2 rounded-lg text-sm " + (m.role === "user" ? "bg-blue-100" : "bg-gray-100")}>
              {m.content}
            </div>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2 p-3 border-t border-black/5">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleSend(); }}
          placeholder={`Ask ${recruiter.recruiterName.split(" ")[0]} about ${recruiter.companyName}…`}
          className="flex-1 px-3 py-2 text-sm rounded-lg border border-gray-300 focus:outline-none focus:border-blue-500"
          disabled={sending}
        />
        <button onClick={handleSend} disabled={sending || !draft.trim()} className="p-2 rounded-lg bg-blue-600 text-white disabled:opacity-50">
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
