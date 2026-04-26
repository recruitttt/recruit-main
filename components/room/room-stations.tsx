"use client";

import { useEffect, useRef, useMemo, useState } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { Html, RoundedBox } from "@react-three/drei";
import { STATIONS } from "@/lib/room/stations";
import { InteractiveHotspot } from "./interactive-hotspot";
import { useRoomStore } from "./room-store";

function StationHoverRing({ stationKey, accent }: { stationKey: string; accent: string }) {
  const hoveredKey = useRoomStore((s) => s.hoveredObjectKey);
  const focused = useRoomStore(
    (s) => s.focusTarget?.kind === "station" && `station:${s.focusTarget.id}` === stationKey,
  );
  const visible = hoveredKey === stationKey || focused;
  return (
    <mesh position={[0, 0.06, 0]} rotation={[-Math.PI / 2, 0, 0]} visible={visible}>
      <ringGeometry args={[0.78, 0.92, 48]} />
      <meshBasicMaterial color={accent} transparent opacity={0.55} toneMapped={false} />
    </mesh>
  );
}

export function RoomStations() {
  return (
    <group>
      <JobBoard />
      <Workbench />
      <ReviewPanel />
      <SubmitTerminal />
      <CalendarDesk />
    </group>
  );
}

function JobBoard() {
  const station = STATIONS[0];
  const [x, , z] = station.pos;
  const papers = useMemo(() => [
    { x: -0.32, y: 0.24, rot: -0.08, bg: "#FFFDF6", phase: 0.0 },
    { x: 0.18, y: 0.3, rot: 0.05, bg: "#FFF5D6", phase: 0.7 },
    { x: -0.18, y: -0.08, rot: 0.04, bg: "#FFFDF6", phase: 1.4 },
    { x: 0.24, y: -0.14, rot: -0.07, bg: "#FDE5C4", phase: 2.1 },
    { x: 0, y: 0.02, rot: 0.01, bg: "#FFFDF6", phase: 2.8 },
  ], []);
  const paperRefs = useRef<(THREE.Group | null)[]>([]);
  const newPinRef = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    paperRefs.current.forEach((g, i) => {
      if (!g) return;
      const p = papers[i];
      g.rotation.z = p.rot + Math.sin(t * 0.9 + p.phase) * 0.018;
      g.position.z = 0.045 + Math.sin(t * 1.2 + p.phase) * 0.004;
    });
    if (newPinRef.current) {
      const cycle = (t % 8) / 8; // every 8 seconds, pin a fresh paper
      const fade = cycle < 0.08 ? cycle / 0.08 : cycle < 0.7 ? 1 : Math.max(0, 1 - (cycle - 0.7) / 0.3);
      newPinRef.current.scale.setScalar(0.6 + fade * 0.4);
      newPinRef.current.visible = fade > 0.02;
    }
  });

  return (
    <group position={[x, 0, z]} rotation={[0, station.rotation, 0]}>
      <InteractiveHotspot
        target={{ kind: "station", id: "jobboard" }}
        hotspotKey="station:jobboard"
        size={[2.4, 2.6, 1.2]}
        position={[0, 1.3, 0]}
      />
      <StationHoverRing stationKey="station:jobboard" accent={station.accent} />
      <mesh position={[0, 0.04, 0]}>
        <cylinderGeometry args={[0.55, 0.6, 0.08, 24]} />
        <meshStandardMaterial color="#C8BDA0" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.75, 0]}>
        <cylinderGeometry args={[0.055, 0.055, 1.4, 16]} />
        <meshStandardMaterial color="#8E7F62" roughness={0.75} metalness={0.15} />
      </mesh>
      <RoundedBox args={[2.0, 1.4, 0.08]} radius={0.06} smoothness={4} position={[0, 1.85, 0]}>
        <meshStandardMaterial color="#B08A5F" roughness={0.95} />
      </RoundedBox>
      <RoundedBox args={[2.14, 1.54, 0.04]} radius={0.06} smoothness={4} position={[0, 1.85, -0.04]}>
        <meshStandardMaterial color="#6E5638" roughness={0.6} />
      </RoundedBox>
      {papers.map((p, i) => (
        <group
          key={i}
          ref={(node) => { paperRefs.current[i] = node; }}
          position={[p.x, 1.85 + p.y, 0.045]}
          rotation={[0, 0, p.rot]}
        >
          <RoundedBox args={[0.38, 0.48, 0.01]} radius={0.008} smoothness={4}>
            <meshStandardMaterial color={p.bg} roughness={0.9} />
          </RoundedBox>
          <mesh position={[0, 0.14, 0.006]}><planeGeometry args={[0.28, 0.015]} /><meshBasicMaterial color="#5C4A30" /></mesh>
          <mesh position={[0, 0.08, 0.006]}><planeGeometry args={[0.22, 0.008]} /><meshBasicMaterial color="#A2927A" /></mesh>
          <mesh position={[0, 0.02, 0.006]}><planeGeometry args={[0.24, 0.008]} /><meshBasicMaterial color="#A2927A" /></mesh>
          <mesh position={[0, 0.2, 0.015]}>
            <sphereGeometry args={[0.018, 12, 12]} />
            <meshStandardMaterial color={station.accent} roughness={0.4} metalness={0.3} />
          </mesh>
        </group>
      ))}
      <group ref={newPinRef} position={[-0.05, 1.95, 0.1]} rotation={[0, 0, -0.12]}>
        <RoundedBox args={[0.36, 0.46, 0.012]} radius={0.008} smoothness={4}>
          <meshStandardMaterial color="#FFFDF6" roughness={0.9} emissive={station.accent} emissiveIntensity={0.18} />
        </RoundedBox>
        <mesh position={[0, 0.14, 0.008]}><planeGeometry args={[0.26, 0.013]} /><meshBasicMaterial color="#5C4A30" /></mesh>
        <mesh position={[0, 0.08, 0.008]}><planeGeometry args={[0.2, 0.007]} /><meshBasicMaterial color="#A2927A" /></mesh>
        <mesh position={[0, 0.02, 0.008]}><planeGeometry args={[0.22, 0.007]} /><meshBasicMaterial color="#A2927A" /></mesh>
        <mesh position={[0, 0.2, 0.018]}>
          <sphereGeometry args={[0.022, 12, 12]} />
          <meshStandardMaterial color={station.accent} roughness={0.4} metalness={0.4} emissive={station.accent} emissiveIntensity={0.6} toneMapped={false} />
        </mesh>
      </group>
    </group>
  );
}

function Workbench() {
  const station = STATIONS[1];
  const [x, , z] = station.pos;

  return (
    <group position={[x, 0, z]} rotation={[0, station.rotation, 0]}>
      <InteractiveHotspot
        target={{ kind: "station", id: "workbench" }}
        hotspotKey="station:workbench"
        size={[2.0, 1.8, 1.4]}
        position={[0, 0.9, 0]}
      />
      <StationHoverRing stationKey="station:workbench" accent={station.accent} />
      <RoundedBox args={[1.8, 0.08, 1.05]} radius={0.025} smoothness={4} position={[0, 0.82, 0]}>
        <meshStandardMaterial color="#D9C9A7" roughness={0.78} />
      </RoundedBox>
      {[[-0.82, 0.41, -0.45],[0.82, 0.41, -0.45],[-0.82, 0.41, 0.45],[0.82, 0.41, 0.45]].map((p, i) => (
        <mesh key={i} position={p as [number,number,number]}>
          <boxGeometry args={[0.06, 0.82, 0.06]} />
          <meshStandardMaterial color="#AE9A72" roughness={0.7} />
        </mesh>
      ))}
      <group position={[0, 0.86, -0.25]} rotation={[-0.18, 0, 0]}>
        <RoundedBox args={[1.2, 0.7, 0.06]} radius={0.03} smoothness={4} position={[0, 0.42, 0]}>
          <meshStandardMaterial color="#2A2723" roughness={0.5} metalness={0.25} />
        </RoundedBox>
        <mesh position={[0, 0.42, 0.032]}><planeGeometry args={[1.12, 0.62]} /><meshBasicMaterial color="#0F0E0C" /></mesh>
        <mesh position={[0, 0.42, 0.033]}><planeGeometry args={[1.08, 0.58]} /><meshBasicMaterial color="#1A1612" toneMapped={false} /></mesh>
        <Html
          transform
          position={[0, 0.42, 0.034]}
          rotation={[0, 0, 0]}
          distanceFactor={0.6}
          occlude="blending"
          style={{ pointerEvents: "none" }}
        >
          <WorkbenchScreen />
        </Html>
        <mesh position={[0, 0.08, 0]}><cylinderGeometry args={[0.05, 0.08, 0.12, 16]} /><meshStandardMaterial color="#3A332B" roughness={0.55} metalness={0.3} /></mesh>
      </group>
      <RoundedBox args={[0.72, 0.02, 0.26]} radius={0.01} smoothness={3} position={[0, 0.88, 0.3]}>
        <meshStandardMaterial color="#F4EBDA" roughness={0.85} />
      </RoundedBox>
      <group position={[0.6, 0.88, 0.22]}>
        <RoundedBox args={[0.32, 0.012, 0.42]} radius={0.006} smoothness={3} rotation={[0, 0.08, 0]}>
          <meshStandardMaterial color="#FFFDF6" roughness={0.95} />
        </RoundedBox>
        <RoundedBox args={[0.32, 0.012, 0.42]} radius={0.006} smoothness={3} position={[0, 0.014, 0]} rotation={[0, -0.04, 0]}>
          <meshStandardMaterial color="#FDF6E2" roughness={0.95} />
        </RoundedBox>
      </group>
      <group position={[-0.65, 0.89, 0.28]}>
        <mesh><cylinderGeometry args={[0.07, 0.06, 0.14, 24]} /><meshStandardMaterial color="#EEE4CF" roughness={0.85} /></mesh>
        <mesh position={[0, 0.08, 0]}><cylinderGeometry args={[0.065, 0.065, 0.005, 24]} /><meshStandardMaterial color="#5B3E1E" roughness={0.7} /></mesh>
      </group>
      <pointLight position={[0, 1.3, 0.3]} intensity={0.2} distance={2.2} color={station.accent} />
    </group>
  );
}

function ReviewPanel() {
  const station = STATIONS[2];
  const [x, , z] = station.pos;
  const ref = useRef<THREE.Group>(null);
  const markRefs = useRef<(THREE.Mesh | null)[]>([]);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (ref.current) {
      ref.current.children.forEach((child, i) => {
        child.position.y = 1.85 + Math.sin(t * 0.8 + i * 1.1) * 0.03;
      });
    }
    markRefs.current.forEach((m, i) => {
      if (!m) return;
      const mat = m.material as THREE.MeshBasicMaterial;
      const phase = (t * 0.6 + i * 0.7) % 3;
      mat.opacity = phase < 0.4 ? phase / 0.4 : phase < 1.6 ? 1 : Math.max(0, 1 - (phase - 1.6) / 0.6);
    });
  });
  const cards = [
    { x: -0.85, rot: 0.35, tint: "#F4E4E8", mark: "✓", markColor: "#3C7A69" },
    { x: 0, rot: 0, tint: "#F1EFF6", mark: "✓", markColor: "#3C7A69" },
    { x: 0.85, rot: -0.35, tint: "#EFF4F1", mark: "?", markColor: "#C7543D" },
  ];
  return (
    <group position={[x, 0, z]} rotation={[0, station.rotation, 0]}>
      <InteractiveHotspot
        target={{ kind: "station", id: "review" }}
        hotspotKey="station:review"
        size={[2.4, 2.6, 1.2]}
        position={[0, 1.3, 0]}
      />
      <StationHoverRing stationKey="station:review" accent={station.accent} />
      <mesh position={[0, 0.04, 0]}><cylinderGeometry args={[0.68, 0.72, 0.08, 32]} /><meshStandardMaterial color="#D9C9A7" roughness={0.88} /></mesh>
      <mesh position={[0, 0.1, 0]}><cylinderGeometry args={[0.55, 0.55, 0.04, 32]} /><meshStandardMaterial color="#CBB990" roughness={0.85} /></mesh>
      <group ref={ref}>
        {cards.map((c, i) => (
          <group key={i} position={[c.x, 1.85, 0]} rotation={[0, c.rot, 0]}>
            <RoundedBox args={[0.72, 0.46, 0.03]} radius={0.04} smoothness={4}>
              <meshStandardMaterial color={c.tint} roughness={0.7} />
            </RoundedBox>
            <mesh position={[0, 0.18, 0.018]}><planeGeometry args={[0.64, 0.03]} /><meshBasicMaterial color={station.accent} opacity={0.55} transparent /></mesh>
            {[0.06, 0, -0.06, -0.12].map((y, j) => (
              <mesh key={j} position={[0, y, 0.018]}><planeGeometry args={[j === 0 ? 0.5 : 0.56, 0.018]} /><meshBasicMaterial color="#A49880" /></mesh>
            ))}
            <mesh
              ref={(node) => { markRefs.current[i] = node; }}
              position={[0.26, -0.16, 0.022]}
            >
              <circleGeometry args={[0.05, 24]} />
              <meshBasicMaterial color={c.markColor} transparent opacity={0} toneMapped={false} />
            </mesh>
          </group>
        ))}
      </group>
      <pointLight position={[0, 2.4, 0.6]} intensity={0.28} distance={3.2} color={station.accent} />
    </group>
  );
}

function SubmitTerminal() {
  const station = STATIONS[3];
  const [x, , z] = station.pos;
  const glowRef = useRef<THREE.PointLight>(null);
  useFrame(({ clock }) => {
    if (!glowRef.current) return;
    glowRef.current.intensity = 0.6 + 0.3 * Math.sin(clock.elapsedTime * 2.1);
  });
  return (
    <group position={[x, 0, z]} rotation={[0, station.rotation, 0]}>
      <InteractiveHotspot
        target={{ kind: "station", id: "submit" }}
        hotspotKey="station:submit"
        size={[1.6, 2.4, 1.2]}
        position={[0, 1.2, 0]}
      />
      <StationHoverRing stationKey="station:submit" accent={station.accent} />
      <RoundedBox args={[1.1, 1.6, 0.7]} radius={0.06} smoothness={4} position={[0, 0.8, 0]}>
        <meshStandardMaterial color="#E8DFC9" roughness={0.85} />
      </RoundedBox>
      <RoundedBox args={[1.15, 0.14, 0.75]} radius={0.04} smoothness={4} position={[0, 1.67, 0]}>
        <meshStandardMaterial color="#3A332B" roughness={0.5} metalness={0.25} />
      </RoundedBox>
      <mesh position={[0, 1.74, 0]}><boxGeometry args={[0.7, 0.012, 0.08]} /><meshBasicMaterial color="#05060A" /></mesh>
      <mesh position={[0, 1.15, 0.36]}><planeGeometry args={[0.72, 0.38]} /><meshStandardMaterial color="#0A1419" roughness={0.5} emissive="#0B5563" emissiveIntensity={0.35} toneMapped={false} /></mesh>
      <Html
        transform
        position={[0, 1.15, 0.366]}
        rotation={[0, 0, 0]}
        distanceFactor={0.45}
        occlude="blending"
        style={{ pointerEvents: "none" }}
      >
        <SubmitTerminalScreen accent={station.accent} />
      </Html>
      <pointLight ref={glowRef} position={[0, 1.82, 0]} intensity={0.6} distance={2.4} color={station.accent} />
    </group>
  );
}

function CalendarDesk() {
  const station = STATIONS[4];
  const [x, , z] = station.pos;
  const cells = useMemo(() => {
    const arr: { x: number; y: number; index: number }[] = [];
    const cols = 7; const rows = 5; const cellW = 0.2; const cellH = 0.2;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        arr.push({ x: (c - (cols - 1) / 2) * cellW, y: ((rows - 1) / 2 - r) * cellH, index: r * cols + c });
      }
    }
    return arr;
  }, []);
  const cellRefs = useRef<(THREE.Mesh | null)[]>([]);
  const meetingSlots = useMemo(() => [10, 12, 17, 22, 23, 28, 30], []);
  const activeSlot = useRef(0);
  const accentColor = useMemo(() => new THREE.Color(station.accent), [station.accent]);
  const baseColor = useMemo(() => new THREE.Color("#EFE3C6"), []);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const slotIndex = Math.floor(t / 3.5) % meetingSlots.length;
    if (slotIndex !== activeSlot.current) activeSlot.current = slotIndex;
    const activeCell = meetingSlots[slotIndex];
    const pulse = 0.5 + 0.5 * Math.sin(t * 2.6);
    cellRefs.current.forEach((m, i) => {
      if (!m) return;
      const mat = m.material as THREE.MeshBasicMaterial;
      const cell = cells[i];
      if (cell.index === activeCell) {
        mat.color.copy(accentColor).multiplyScalar(0.85 + pulse * 0.3);
      } else if (meetingSlots.includes(cell.index)) {
        mat.color.copy(accentColor).lerp(baseColor, 0.65);
      } else {
        mat.color.copy(baseColor);
      }
    });
  });
  return (
    <group position={[x, 0, z]} rotation={[0, station.rotation, 0]}>
      <InteractiveHotspot
        target={{ kind: "station", id: "calendar" }}
        hotspotKey="station:calendar"
        size={[2.0, 3.0, 1.3]}
        position={[0, 1.6, 0]}
      />
      <StationHoverRing stationKey="station:calendar" accent={station.accent} />
      <RoundedBox args={[1.5, 0.08, 1.0]} radius={0.025} smoothness={4} position={[0, 0.82, 0]}>
        <meshStandardMaterial color="#D9C9A7" roughness={0.78} />
      </RoundedBox>
      {[[-0.68, 0.41, -0.42],[0.68, 0.41, -0.42],[-0.68, 0.41, 0.42],[0.68, 0.41, 0.42]].map((p, i) => (
        <mesh key={i} position={p as [number,number,number]}><boxGeometry args={[0.06, 0.82, 0.06]} /><meshStandardMaterial color="#AE9A72" roughness={0.7} /></mesh>
      ))}
      <group position={[0, 2.25, -0.34]}>
        <RoundedBox args={[1.56, 1.18, 0.05]} radius={0.035} smoothness={4}><meshStandardMaterial color="#FDF6E2" roughness={0.9} /></RoundedBox>
        <mesh position={[0, 0.48, 0.03]}><planeGeometry args={[1.44, 0.16]} /><meshStandardMaterial color={station.accent} roughness={0.75} /></mesh>
        {cells.map((c, i) => (
          <mesh
            key={i}
            ref={(node) => { cellRefs.current[i] = node; }}
            position={[c.x, c.y - 0.05, 0.028]}
          >
            <planeGeometry args={[0.18, 0.18]} />
            <meshBasicMaterial color="#EFE3C6" />
          </mesh>
        ))}
        <RoundedBox args={[1.62, 1.24, 0.018]} radius={0.04} smoothness={4} position={[0, 0, -0.026]}><meshStandardMaterial color="#6E5638" roughness={0.6} /></RoundedBox>
      </group>
      <group position={[0.55, 0.9, 0.2]}>
        <mesh><cylinderGeometry args={[0.06, 0.07, 0.12, 20]} /><meshStandardMaterial color="#E6DAB8" roughness={0.85} /></mesh>
        {[-0.015, 0.02, -0.03].map((dx, i) => (
          <mesh key={i} position={[dx, 0.12, 0]}><cylinderGeometry args={[0.006, 0.006, 0.22, 8]} /><meshStandardMaterial color={i === 0 ? "#C7543D" : i === 1 ? "#3C7A69" : "#54607A"} roughness={0.7} /></mesh>
        ))}
      </group>
      <RoundedBox args={[0.42, 0.015, 0.3]} radius={0.008} smoothness={3} position={[-0.45, 0.88, 0.2]} rotation={[0, 0.12, 0]}>
        <meshStandardMaterial color="#B24B2E" roughness={0.78} />
      </RoundedBox>
    </group>
  );
}

const RESUME_LINES = [
  ["// tailoring resume.tex", "Mo Hosy · Software Engineer", "", "* Recruit · Lead Engineer", "  - shipped agent dashboard", "  - +38% conversion lift", "* Acme Inc · 2024–2026", "  - led 4-eng platform team"],
  ["// matching role keywords", "match: react · typescript · llm", "match: agent orchestration", "match: applicant tracking", "boost: cloud deploy", "boost: rapid prototyping", "// 7/9 keywords aligned"],
  ["// bullet rewrite", "before: built features for app", "after: shipped onboarding flow", "        used by 12k MAU", "diff: +specificity, +metric", "saving variant 3/5..."],
];

function WorkbenchScreen() {
  const [snippet, setSnippet] = useState(0);
  const [chars, setChars] = useState(0);

  useEffect(() => {
    const lines = RESUME_LINES[snippet];
    const total = lines.reduce((s, l) => s + l.length, 0) + lines.length;
    if (chars < total) {
      const id = window.setTimeout(() => setChars(chars + 2), 30);
      return () => window.clearTimeout(id);
    }
    const id = window.setTimeout(() => {
      setChars(0);
      setSnippet((s) => (s + 1) % RESUME_LINES.length);
    }, 1800);
    return () => window.clearTimeout(id);
  }, [chars, snippet]);

  const lines = RESUME_LINES[snippet];
  let consumed = 0;
  let cursorLine = -1;
  const rendered = lines.map((line, idx) => {
    const remaining = chars - consumed;
    consumed += line.length + 1;
    if (remaining <= 0) return { text: "", isActive: false };
    if (remaining >= line.length) return { text: line, isActive: false };
    cursorLine = idx;
    return { text: line.slice(0, remaining), isActive: true };
  });

  return (
    <div
      style={{
        width: 480,
        height: 260,
        padding: "18px 22px",
        background: "linear-gradient(180deg, #0E1A22 0%, #0A1419 100%)",
        color: "#A8E6F3",
        fontFamily: "ui-monospace, 'JetBrains Mono', monospace",
        fontSize: 12,
        lineHeight: 1.55,
        borderRadius: 4,
        boxShadow: "inset 0 0 24px rgba(8,145,178,0.14)",
        overflow: "hidden",
      }}
    >
      {rendered.map((line, i) => {
        const text = line.text;
        const color = text.startsWith("//") ? "#5B7C86" : text.startsWith("*") ? "#F5E9D0" : "#A8E6F3";
        return (
          <div key={i} style={{ color, whiteSpace: "pre", minHeight: "1.55em" }}>
            {text}
            {i === cursorLine ? (
              <span style={{ display: "inline-block", width: 7, height: 13, background: "#0891B2", marginLeft: 2, verticalAlign: "middle", animation: "wb-blink 1s steps(2) infinite" }} />
            ) : null}
          </div>
        );
      })}
      <style>{`@keyframes wb-blink { 0%, 50% { opacity: 1 } 50.01%, 100% { opacity: 0 } }`}</style>
    </div>
  );
}

const TERMINAL_LINES: { text: string; tone: "muted" | "ok" | "warn" | "info" }[] = [
  { text: "$ recruit submit --app=mimi-resume.pdf", tone: "info" },
  { text: "  ↳ POST jobs.ashbyhq.com/api/applications", tone: "muted" },
  { text: "  ↳ filling form fields (12)", tone: "muted" },
  { text: "  ↳ uploading resume (217 KB)", tone: "muted" },
  { text: "  ▮▮▮▮▮▮▮▮▮▮ 100%", tone: "info" },
  { text: "  ✓ 200 OK · application accepted", tone: "ok" },
  { text: "  ✓ confirmation: APP-9F2D-X8K", tone: "ok" },
  { text: "$ next in queue: senior-pm@stripe", tone: "info" },
];

function SubmitTerminalScreen({ accent }: { accent: string }) {
  const [visible, setVisible] = useState(0);
  useEffect(() => {
    if (visible < TERMINAL_LINES.length) {
      const id = window.setTimeout(() => setVisible(visible + 1), 380);
      return () => window.clearTimeout(id);
    }
    const id = window.setTimeout(() => setVisible(0), 1800);
    return () => window.clearTimeout(id);
  }, [visible]);

  const toneColor = (tone: string) => {
    if (tone === "ok") return "#7BD8B0";
    if (tone === "warn") return "#F4C770";
    if (tone === "muted") return "#5B7C86";
    return accent;
  };

  return (
    <div
      style={{
        width: 320,
        height: 170,
        padding: "12px 14px",
        background: "linear-gradient(180deg, #061018 0%, #0A1419 100%)",
        color: "#A8E6F3",
        fontFamily: "ui-monospace, 'JetBrains Mono', monospace",
        fontSize: 9.5,
        lineHeight: 1.55,
        borderRadius: 2,
        boxShadow: `inset 0 0 18px ${accent}22`,
        overflow: "hidden",
      }}
    >
      {TERMINAL_LINES.slice(0, visible).map((l, i) => (
        <div key={i} style={{ color: toneColor(l.tone), whiteSpace: "pre" }}>{l.text}</div>
      ))}
      {visible < TERMINAL_LINES.length ? (
        <span style={{ display: "inline-block", width: 5, height: 10, background: accent, animation: "term-blink 1s steps(2) infinite" }} />
      ) : null}
      <style>{`@keyframes term-blink { 0%, 50% { opacity: 1 } 50.01%, 100% { opacity: 0 } }`}</style>
    </div>
  );
}
