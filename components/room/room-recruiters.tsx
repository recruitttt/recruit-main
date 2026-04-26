"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import type { ThreeEvent } from "@react-three/fiber";
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
  const setActiveRecruiterId = useRoomStore((s) => s.setActiveRecruiterId);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  // Phase C will wire `playerNearestTarget` into the room store; for now we
  // safely read it via an `as any` cast so the recruiter highlight can light
  // up when the proximity helper begins emitting recruiter targets.
  const playerNearestTarget = useRoomStore(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (s) => (s as any).playerNearestTarget as RoomNearestTarget | null | undefined,
  );

  if (!recruiters) return null;

  function openRecruiter(id: string) {
    setActiveRecruiterId(id);
  }

  return (
    <group>
      {(recruiters as RecruiterRow[]).map((r) => {
        const desk = deskPositionForIndex(r.positionIndex);
        const appearance = generateAppearance(r.appearanceSeed);
        const isNear =
          playerNearestTarget?.kind === "recruiter" && playerNearestTarget.id === r._id;
        const isHovered = hoveredId === r._id;
        const pose: "idle" | "alert" | "talking" | "applied" =
          r.status === "applied"
            ? "applied"
            : isHovered || isNear
              ? "alert"
              : "idle";
        const handleClick = (event: ThreeEvent<MouseEvent>) => {
          event.stopPropagation();
          openRecruiter(r._id);
        };
        const handlePointerOver = (event: ThreeEvent<PointerEvent>) => {
          event.stopPropagation();
          setHoveredId(r._id);
          document.body.style.cursor = "pointer";
        };
        const handlePointerOut = (event: ThreeEvent<PointerEvent>) => {
          event.stopPropagation();
          setHoveredId((current) => (current === r._id ? null : current));
          document.body.style.cursor = "auto";
        };
        return (
          <group
            key={r._id}
            onClick={handleClick}
            onPointerOver={handlePointerOver}
            onPointerOut={handlePointerOut}
          >
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
