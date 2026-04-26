"use client";

import { Html } from "@react-three/drei";
import { useQuery, useAction } from "convex/react";
import { useState } from "react";
import { api } from "@/convex/_generated/api";
import { useRoomStore } from "./room-store";
import { TerminalProgress } from "./terminal-progress";
import { ManualApplicationPack } from "./manual-application-pack";
import { detectProvider, fillModeForProvider } from "@/lib/application/provider-detection";
import { friendlyError } from "@/lib/application/error-messages";

const TERMINAL_POSITION: readonly [number, number, number] = [6, 0.05, -2];

type Props = { userId: string | null };

type AppJob = { _id: string; company?: string; title?: string; targetUrl?: string; status: string };

export function ApplicationTerminal({ userId }: Props) {
  const terminalActive = useRoomStore((s) => s.terminalActive);
  const setTerminalActive = useRoomStore((s) => s.setTerminalActive);
  const jobs = useQuery(
    (api as unknown as { applicationJobs?: { listRecentForCurrentUser?: unknown } }).applicationJobs?.listRecentForCurrentUser as never,
    userId ? ({ limit: 10 } as never) : "skip",
  ) as AppJob[] | undefined;
  const runJob = useAction(
    (api as unknown as { applicationActions?: { runApplicationJob?: unknown } }).applicationActions?.runApplicationJob as never,
  );
  const [running, setRunning] = useState<string | null>(null);

  return (
    <group position={TERMINAL_POSITION}>
      <mesh position={[0, 0.6, 0]}>
        <boxGeometry args={[0.8, 1.2, 0.4]} />
        <meshStandardMaterial color="#2a2a2a" />
      </mesh>
      <mesh position={[0, 1.05, 0.21]}>
        <boxGeometry args={[0.7, 0.45, 0.02]} />
        <meshStandardMaterial color={terminalActive ? "#1a3a1a" : "#0a0a0a"} emissive={terminalActive ? "#0a3a0a" : "#000000"} />
      </mesh>
      {terminalActive && (
        <Html position={[0, 1.05, 0.22]} transform distanceFactor={1.2} occlude>
          <div className="w-[480px] bg-white rounded shadow border border-gray-200">
            <div className="flex justify-between items-center p-3 border-b">
              <div className="font-medium text-sm">Application Terminal</div>
              <button onClick={() => setTerminalActive(false)} className="text-xs text-gray-500">Close</button>
            </div>
            <div className="p-3 max-h-[300px] overflow-y-auto space-y-2">
              {!jobs && <div className="text-gray-500 text-xs">Loading queue…</div>}
              {jobs?.length === 0 && <div className="text-gray-500 text-xs">No applications queued.</div>}
              {jobs?.map((j) => {
                const provider = detectProvider(j.targetUrl ?? "");
                const mode = fillModeForProvider(provider);
                const isFailed = j.status.startsWith("failed_");
                const friendly = isFailed ? friendlyError(j.status) : null;
                return (
                  <div key={j._id} className="p-2 border border-gray-200 rounded">
                    <div className="flex justify-between">
                      <div>
                        <div className="text-sm font-medium">{j.title ?? "(role)"}</div>
                        <div className="text-xs text-gray-500">{j.company} · {provider} · {mode}</div>
                      </div>
                      {mode === "auto" && runJob && (
                        <button
                          disabled={running === j._id}
                          onClick={async () => {
                            setRunning(j._id);
                            try { await runJob({ jobId: j._id } as never); } finally { setRunning(null); }
                          }}
                          className="px-2 py-1 text-xs bg-green-600 text-white rounded disabled:opacity-50"
                        >
                          {running === j._id ? "…" : "Submit"}
                        </button>
                      )}
                      {mode === "guided" && (
                        <ManualApplicationPack jobId={j._id} />
                      )}
                    </div>
                    {running === j._id && <TerminalProgress jobId={j._id} />}
                    {friendly && (
                      <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded text-xs">
                        <div className="font-medium">{friendly.title}</div>
                        <div className="text-gray-700">{friendly.body}</div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </Html>
      )}
    </group>
  );
}
