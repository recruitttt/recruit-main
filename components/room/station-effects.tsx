"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { RoundedBox, Sparkles } from "@react-three/drei";
import { STATIONS, type Station } from "@/lib/room/stations";
import {
  useExtendedLiveRoom,
  usePipelineEvents,
} from "@/lib/room/use-pipeline-events";

const WORKBENCH_ACCENT = "#D97706";
const SUBMIT_ACCENT = "#3F7A56";
const PIN_RED = "#C7543D";

function findStationPos(id: Station["id"]): readonly [number, number, number] {
  const station = STATIONS.find((s) => s.id === id);
  return station ? station.pos : ([0, 0, 0] as const);
}

const TAILORING_CYCLE_SECONDS = 4;
const NEEDLE_HZ = 1.5;
const NEEDLE_AMPLITUDE = 0.02;
const PAGE_SLIDE_RANGE = 0.45;
const COMPLETION_FLASH_SECONDS = 0.8;

/** Maps a 0..1 cycle phase to the page's local x position on the desk. */
function pageOffset(t: number): number {
  if (t < 0.25) return PAGE_SLIDE_RANGE * (1 - t / 0.25);
  if (t < 0.75) return 0;
  return -PAGE_SLIDE_RANGE * ((t - 0.75) / 0.25);
}

export function TailoringCraft(): React.ReactElement {
  const live = useExtendedLiveRoom();
  const inProgress = live.tailoring.inProgress;
  const completed = live.tailoring.completed;
  const [bx, , bz] = findStationPos("workbench");

  const pageRef = useRef<THREE.Group>(null);
  const needleRef = useRef<THREE.Group>(null);
  const lightRef = useRef<THREE.PointLight>(null);
  const cycleRef = useRef<number>(0);
  const flashRemainingRef = useRef<number>(0);
  const lastCompletedRef = useRef<number>(completed);

  useEffect(() => {
    if (completed > lastCompletedRef.current) {
      flashRemainingRef.current = COMPLETION_FLASH_SECONDS;
    }
    lastCompletedRef.current = completed;
  }, [completed]);

  useFrame(({ clock }, dt) => {
    const page = pageRef.current;
    const needle = needleRef.current;
    const light = lightRef.current;

    if (page) {
      if (inProgress) {
        cycleRef.current = (cycleRef.current + dt) % TAILORING_CYCLE_SECONDS;
        const t = cycleRef.current / TAILORING_CYCLE_SECONDS;
        page.visible = true;
        page.position.x = pageOffset(t);
      } else {
        page.visible = false;
        cycleRef.current = 0;
      }
    }

    if (needle) {
      if (inProgress) {
        const phase = clock.elapsedTime * NEEDLE_HZ * Math.PI * 2;
        needle.position.y = 0.08 + Math.sin(phase) * NEEDLE_AMPLITUDE;
      } else {
        needle.position.y = 0.08;
      }
    }

    if (light) {
      if (flashRemainingRef.current > 0) {
        flashRemainingRef.current = Math.max(
          0,
          flashRemainingRef.current - dt,
        );
        const t = flashRemainingRef.current / COMPLETION_FLASH_SECONDS;
        light.intensity = t * 1.6;
      } else if (light.intensity !== 0) {
        light.intensity = 0;
      }
    }
  });

  return (
    <group position={[bx, 0.9, bz]}>
      <group ref={pageRef} visible={false}>
        <RoundedBox args={[0.2, 0.005, 0.28]} radius={0.005} smoothness={3}>
          <meshStandardMaterial color="#FFFDF6" roughness={0.9} />
        </RoundedBox>
      </group>
      <group ref={needleRef} position={[0.06, 0.08, 0.04]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.005, 0.005, 0.1, 12]} />
          <meshStandardMaterial color="#A2927A" metalness={0.6} roughness={0.3} />
        </mesh>
      </group>
      <pointLight
        ref={lightRef}
        position={[0, 0.3, 0.1]}
        intensity={0}
        distance={1.6}
        color={WORKBENCH_ACCENT}
      />
    </group>
  );
}

const LAUNCH_DURATION_SECONDS = 0.6;
const LAUNCH_FLASH_SECONDS = 0.4;
const LAUNCH_ARC_HEIGHT = 0.9;
const LAUNCH_TOP_OFFSET = 1.3;

type LaunchAnimation = {
  active: boolean;
  progress: number;
  flashRemaining: number;
};

export function SubmitLaunch(): React.ReactElement {
  const events = usePipelineEvents(["submission-confirmed"]);
  const consumedRef = useRef<number>(0);
  const folderRef = useRef<THREE.Group>(null);
  const lightRef = useRef<THREE.PointLight>(null);
  const sparklesRef = useRef<THREE.Points>(null);
  const animRef = useRef<LaunchAnimation>({
    active: false,
    progress: 0,
    flashRemaining: 0,
  });
  const [sx, , sz] = findStationPos("submit");

  useEffect(() => {
    if (events.length <= consumedRef.current) {
      consumedRef.current = events.length;
      return;
    }
    const fresh = events.slice(consumedRef.current);
    fresh.forEach((evt) => {
      if (evt.kind !== "submission-confirmed") return;
      animRef.current = {
        active: true,
        progress: 0,
        flashRemaining: LAUNCH_FLASH_SECONDS,
      };
    });
    consumedRef.current = events.length;
  }, [events]);

  useFrame((_, dt) => {
    const folder = folderRef.current;
    const light = lightRef.current;
    const sparkles = sparklesRef.current;
    const anim = animRef.current;

    if (folder) {
      if (anim.active) {
        anim.progress = Math.min(
          1,
          anim.progress + dt / LAUNCH_DURATION_SECONDS,
        );
        const eased = anim.progress * anim.progress * (3 - 2 * anim.progress);
        folder.visible = true;
        folder.position.y = 1.0 + LAUNCH_ARC_HEIGHT * eased;
        folder.rotation.x = -Math.PI * 0.25 * eased;
        if (anim.progress >= 1) {
          animRef.current = { ...anim, active: false, progress: 0 };
          folder.visible = false;
        }
      } else {
        folder.visible = false;
      }
    }

    if (light) {
      if (anim.flashRemaining > 0) {
        anim.flashRemaining = Math.max(0, anim.flashRemaining - dt);
        const t = anim.flashRemaining / LAUNCH_FLASH_SECONDS;
        light.intensity = t;
      } else if (light.intensity !== 0) {
        light.intensity = 0;
      }
    }

    if (sparkles) {
      sparkles.visible = anim.flashRemaining > 0;
    }
  });

  return (
    <group position={[sx, 0, sz]}>
      <group ref={folderRef} visible={false}>
        <RoundedBox args={[0.2, 0.27, 0.02]} radius={0.012} smoothness={3}>
          <meshStandardMaterial color={SUBMIT_ACCENT} roughness={0.85} />
        </RoundedBox>
      </group>
      <Sparkles
        ref={sparklesRef}
        count={20}
        size={2}
        scale={1.5}
        position={[0, LAUNCH_TOP_OFFSET, 0]}
        color={SUBMIT_ACCENT}
        visible={false}
      />
      <pointLight
        ref={lightRef}
        position={[0, LAUNCH_TOP_OFFSET, 0]}
        intensity={0}
        distance={2.4}
        color={SUBMIT_ACCENT}
      />
    </group>
  );
}

const CALENDAR_COLS = 7;
const CALENDAR_ROWS = 5;
const CALENDAR_CELL = 0.2;
const CALENDAR_BASE_Y = 2.25;
const CALENDAR_BASE_Z = -0.34;
const CALENDAR_SURFACE_Z = 0.028;

function pinPosition(index: number): readonly [number, number, number] {
  const slot = index % (CALENDAR_COLS * CALENDAR_ROWS);
  const r = Math.floor(slot / CALENDAR_COLS);
  const c = slot % CALENDAR_COLS;
  const x = (c - (CALENDAR_COLS - 1) / 2) * CALENDAR_CELL;
  const y =
    CALENDAR_BASE_Y +
    ((CALENDAR_ROWS - 1) / 2 - r) * CALENDAR_CELL -
    0.05;
  return [x, y, CALENDAR_BASE_Z + CALENDAR_SURFACE_Z] as const;
}

export function CalendarPin(): React.ReactElement {
  const live = useExtendedLiveRoom();
  const interviewCount = live.followUps.interviewCount;
  const [cx, , cz] = findStationPos("calendar");
  const pins = useMemo(() => {
    const out: Array<readonly [number, number, number]> = [];
    for (let i = 0; i < interviewCount; i += 1) {
      out.push(pinPosition(i));
    }
    return out;
  }, [interviewCount]);

  return (
    <group position={[cx, 0, cz]}>
      {pins.map((p, idx) => (
        <group key={idx} position={p}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <coneGeometry args={[0.015, 0.04, 12]} />
            <meshStandardMaterial color={PIN_RED} roughness={0.5} />
          </mesh>
          <mesh position={[0, 0, 0.025]}>
            <sphereGeometry args={[0.02, 16, 12]} />
            <meshStandardMaterial
              color={PIN_RED}
              roughness={0.4}
              metalness={0.1}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
}
