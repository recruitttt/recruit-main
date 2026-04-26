"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { Instance, Instances } from "@react-three/drei";
import { create } from "zustand";
import { STATIONS, type Station } from "@/lib/room/stations";
import {
  usePipelineEvents,
  type ScoreTier,
} from "@/lib/room/use-pipeline-events";

export type JobTier = ScoreTier;

export type Job = {
  readonly id: string;
  readonly color: string;
  readonly tier: JobTier | null;
  progress: number;
};

const MAX_JOBS = 30;
const TRAVEL_SECONDS = 12;
const ANCHOR_Y = 1.5;
const FOLDER_NEUTRAL = "#C9A66B";
const TIER_COLOR: Record<JobTier, string> = {
  gold: "#F0C24A",
  silver: "#CDD5DD",
  bronze: "#C7864F",
};

type JobConveyorState = {
  readonly jobs: readonly Job[];
  spawn: (color: string) => void;
  applyTier: (tier: JobTier) => void;
  recycle: (id: string) => void;
};

const useJobConveyorStore = create<JobConveyorState>((set, get) => ({
  jobs: [],
  spawn: (color) => {
    const next: Job = {
      id: `job_${Date.now().toString(36)}_${Math.random()
        .toString(36)
        .slice(2, 8)}`,
      color,
      tier: null,
      progress: 0,
    };
    const current = get().jobs;
    const trimmed =
      current.length >= MAX_JOBS ? current.slice(-MAX_JOBS + 1) : current;
    set({ jobs: [...trimmed, next] });
  },
  applyTier: (tier) => {
    const current = get().jobs;
    const idx = current.findIndex((j) => j.tier === null);
    if (idx === -1) return;
    const updated: Job = {
      ...current[idx],
      tier,
      color: TIER_COLOR[tier],
    };
    set({
      jobs: [
        ...current.slice(0, idx),
        updated,
        ...current.slice(idx + 1),
      ],
    });
  },
  recycle: (id) => {
    set((state) => ({ jobs: state.jobs.filter((j) => j.id !== id) }));
  },
}));

function findStation(id: Station["id"]): Station | undefined {
  return STATIONS.find((s) => s.id === id);
}

function buildCurve(): THREE.CatmullRomCurve3 {
  const board = findStation("jobboard");
  const bench = findStation("workbench");
  const submit = findStation("submit");
  if (!board || !bench || !submit) {
    return new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, ANCHOR_Y, 0),
      new THREE.Vector3(1, ANCHOR_Y, 0),
    ]);
  }
  const start = new THREE.Vector3(board.pos[0], ANCHOR_Y, board.pos[2]);
  const mid = new THREE.Vector3(
    bench.pos[0],
    ANCHOR_Y,
    bench.pos[2] + 1.2,
  );
  const end = new THREE.Vector3(submit.pos[0], ANCHOR_Y, submit.pos[2]);
  return new THREE.CatmullRomCurve3([start, mid, end], false, "catmullrom", 0.5);
}

function useEventSpawner(): void {
  const events = usePipelineEvents(["job-fetched", "score-stamped"]);
  const consumedRef = useRef<number>(0);
  const spawn = useJobConveyorStore((s) => s.spawn);
  const applyTier = useJobConveyorStore((s) => s.applyTier);

  useEffect(() => {
    if (events.length <= consumedRef.current) {
      consumedRef.current = events.length;
      return;
    }
    const fresh = events.slice(consumedRef.current);
    fresh.forEach((evt) => {
      if (evt.kind === "job-fetched") {
        spawn(FOLDER_NEUTRAL);
      } else if (evt.kind === "score-stamped") {
        applyTier(evt.tier);
      }
    });
    consumedRef.current = events.length;
  }, [events, spawn, applyTier]);
}

type FolderInstanceProps = {
  readonly job: Job;
  readonly curve: THREE.CatmullRomCurve3;
  readonly onArrive: (id: string) => void;
};

function FolderInstance({
  job,
  curve,
  onArrive,
}: FolderInstanceProps): React.ReactElement {
  const groupRef = useRef<THREE.Group>(null);
  const progressRef = useRef<number>(job.progress);
  const tmpVec = useMemo(() => new THREE.Vector3(), []);
  const tmpVecAhead = useMemo(() => new THREE.Vector3(), []);

  useFrame((_, dt) => {
    const group = groupRef.current;
    if (!group) return;
    const next = progressRef.current + dt / TRAVEL_SECONDS;
    if (next >= 1) {
      progressRef.current = 1;
      onArrive(job.id);
      return;
    }
    progressRef.current = next;
    curve.getPointAt(next, tmpVec);
    group.position.set(tmpVec.x, tmpVec.y, tmpVec.z);
    const lookAheadAt = Math.min(next + 0.01, 1);
    curve.getPointAt(lookAheadAt, tmpVecAhead);
    const dx = tmpVecAhead.x - tmpVec.x;
    const dz = tmpVecAhead.z - tmpVec.z;
    if (dx !== 0 || dz !== 0) {
      group.rotation.y = Math.atan2(dx, dz);
    }
  });

  return (
    <group ref={groupRef}>
      <Instance color={job.color} />
      <Instance
        position={[-0.04, 0.14, 0]}
        scale={[0.4, 0.18, 1]}
        color={job.color}
      />
    </group>
  );
}

export function JobConveyor(): React.ReactElement {
  const jobs = useJobConveyorStore((s) => s.jobs);
  const recycle = useJobConveyorStore((s) => s.recycle);
  useEventSpawner();

  const curve = useMemo(() => buildCurve(), []);

  return (
    <Instances limit={MAX_JOBS} range={MAX_JOBS} castShadow receiveShadow>
      <boxGeometry args={[0.18, 0.24, 0.02]} />
      <meshStandardMaterial roughness={0.85} metalness={0.05} />
      {jobs.map((job) => (
        <FolderInstance
          key={job.id}
          job={job}
          curve={curve}
          onArrive={recycle}
        />
      ))}
    </Instances>
  );
}
