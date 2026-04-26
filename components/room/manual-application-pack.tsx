"use client";

import { useQuery } from "convex/react";
import { useState } from "react";
import { api } from "@/convex/_generated/api";

type Props = { jobId: string };

export function ManualApplicationPack({ jobId }: Props) {
  const [open, setOpen] = useState(false);
  const job = useQuery(
    (api as unknown as { applicationJobs?: { getById?: unknown } }).applicationJobs?.getById as never,
    { jobId } as never,
  ) as { targetUrl?: string } | undefined | null;
  const recruiter = useQuery(
    (api as unknown as { recruiters?: { findByJobId?: unknown } }).recruiters?.findByJobId as never,
    { jobId } as never,
  ) as { _id: string } | undefined | null;
  const conversation = useQuery(
    (api as unknown as { recruiters?: { getConversation?: unknown } }).recruiters?.getConversation as never,
    (recruiter?._id ? { recruiterId: recruiter._id } : "skip") as never,
  ) as { brainstormedAnswers?: Array<{ questionType: string; answer: string }> } | undefined | null;

  return (
    <>
      <button onClick={() => setOpen(true)} className="px-2 py-1 text-xs bg-orange-500 text-white rounded">
        Manual
      </button>
      {open && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div className="bg-white max-w-xl w-full p-4 rounded shadow" onClick={(e) => e.stopPropagation()}>
            <div className="font-medium mb-2">Guided application pack</div>
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              <div>
                <div className="text-xs font-mono uppercase text-gray-500">Job URL</div>
                {job?.targetUrl ? (
                  <a className="text-blue-600 text-sm" href={job.targetUrl} target="_blank" rel="noopener">{job.targetUrl}</a>
                ) : (
                  <div className="text-sm text-gray-500">(not loaded)</div>
                )}
              </div>
              {(conversation?.brainstormedAnswers ?? []).map((a, i) => (
                <div key={i}>
                  <div className="text-xs font-mono uppercase text-gray-500">{a.questionType}</div>
                  <div className="text-sm whitespace-pre-wrap p-2 bg-gray-50 rounded">{a.answer}</div>
                </div>
              ))}
              {(conversation?.brainstormedAnswers ?? []).length === 0 && (
                <div className="text-sm text-gray-500">No brainstormed answers yet — chat with the recruiter to prepare answers.</div>
              )}
            </div>
            <button onClick={() => setOpen(false)} className="mt-3 px-3 py-1 text-xs bg-gray-200 rounded">Close</button>
          </div>
        </div>
      )}
    </>
  );
}
