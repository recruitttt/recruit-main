"use client";

import { useQuery } from "convex/react";
import { convexRefs } from "@/lib/convex-refs";
import { generateAppearance } from "@/lib/recruiter/appearance";
import { deskPositionForIndex } from "@/lib/recruiter/desk-layout";
import type { RoomNearestTarget } from "@/lib/room/interactions";
import { RecruiterCharacter } from "./recruiter-character";
import { RecruiterDesk } from "./recruiter-desk";
import { useRoomStore } from "./room-store";

type Props = {
  userId: string | null;
};

type RecruiterRow = {
  _id: string;
  positionIndex: number;
  appearanceSeed: number;
  companyName: string;
  recruiterName: string;
  status: "active" | "applied" | "departed";
};

export function RoomRecruiters({ userId }: Props) {
  const recruiters = useQuery(
    convexRefs.recruiters.listForUser,
    userId ? { userId } : "skip",
  );
  // Phase C will wire `playerNearestTarget` into the room store; for now we
  // safely read it via an `as any` cast so the recruiter highlight can light
  // up when the proximity helper begins emitting recruiter targets.
  const playerNearestTarget = useRoomStore(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (s) => (s as any).playerNearestTarget as RoomNearestTarget | null | undefined,
  );

  if (!recruiters) return null;

  return (
    <group>
      {(recruiters as RecruiterRow[]).map((r) => {
        const desk = deskPositionForIndex(r.positionIndex);
        const appearance = generateAppearance(r.appearanceSeed);
        const isNear =
          playerNearestTarget?.kind === "recruiter" && playerNearestTarget.id === r._id;
        const pose: "idle" | "alert" | "talking" | "applied" =
          r.status === "applied" ? "applied" : isNear ? "alert" : "idle";
        return (
          <group key={r._id}>
            <RecruiterDesk
              desk={desk}
              companyName={r.companyName}
              recruiterName={r.recruiterName}
            />
            <RecruiterCharacter
              appearance={appearance}
              pose={pose}
              position={[desk.position[0], 0.05, desk.position[2] + 0.55]}
              facing={desk.facing + Math.PI}
            />
          </group>
        );
      })}
    </group>
  );
}
