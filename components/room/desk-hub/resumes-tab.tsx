"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

type Props = { userId: string | null };

type TailoredAppRow = {
  _id: string;
  company?: string;
  title?: string;
  status?: string;
  tailoringScore?: number;
  pdfReady?: boolean;
};

export function ResumesTab({ userId }: Props) {
  const apps = useQuery(
    api.tailoredApplications.listForUser,
    userId ? { userId, limit: 25 } : "skip",
  ) as TailoredAppRow[] | undefined;

  if (!userId) return <div className="text-gray-500">Sign in.</div>;
  if (!apps) return <div className="text-gray-500">Loading…</div>;
  if (apps.length === 0)
    return <div className="text-gray-500">No tailored resumes yet. Tailor a job from the dashboard to populate this view.</div>;

  return (
    <div className="space-y-2">
      {apps.map((a) => (
        <div key={a._id} className="p-2 border border-gray-200 rounded">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="font-medium text-sm truncate">{a.title ?? "(role)"}</div>
              <div className="text-xs text-gray-500 truncate">{a.company ?? "(company)"}</div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {typeof a.tailoringScore === "number" && (
                <span className="text-[10px] px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded">
                  {Math.round(a.tailoringScore * 100)}%
                </span>
              )}
              {a.pdfReady && (
                <span className="text-[10px] px-1.5 py-0.5 bg-green-100 text-green-700 rounded">PDF</span>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
