"use client";

import { useRef, useMemo } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import { STATIONS } from "@/lib/room/stations";

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
    { x: -0.32, y: 0.24, rot: -0.08, bg: "#FFFDF6" },
    { x: 0.18, y: 0.3, rot: 0.05, bg: "#FFF5D6" },
    { x: -0.18, y: -0.08, rot: 0.04, bg: "#FFFDF6" },
    { x: 0.24, y: -0.14, rot: -0.07, bg: "#FDE5C4" },
    { x: 0, y: 0.02, rot: 0.01, bg: "#FFFDF6" },
  ], []);

  return (
    <group position={[x, 0, z]}>
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
        <group key={i} position={[p.x, 1.85 + p.y, 0.045]} rotation={[0, 0, p.rot]}>
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
    </group>
  );
}

function Workbench() {
  const station = STATIONS[1];
  const [x, , z] = station.pos;
  const screenRef = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (!screenRef.current) return;
    const m = screenRef.current.material as THREE.MeshBasicMaterial;
    m.color.setHSL(0.09, 0.35, 0.45 + 0.05 * Math.sin(clock.elapsedTime * 1.3));
  });

  return (
    <group position={[x, 0, z]}>
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
        <mesh ref={screenRef} position={[0, 0.42, 0.033]}><planeGeometry args={[1.08, 0.58]} /><meshBasicMaterial color="#C38A3D" toneMapped={false} /></mesh>
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
  useFrame(({ clock }) => {
    if (!ref.current) return;
    ref.current.children.forEach((child, i) => {
      child.position.y = 1.85 + Math.sin(clock.elapsedTime * 0.8 + i * 1.1) * 0.03;
    });
  });
  const cards = [
    { x: -0.85, rot: 0.35, tint: "#F4E4E8" },
    { x: 0, rot: 0, tint: "#F1EFF6" },
    { x: 0.85, rot: -0.35, tint: "#EFF4F1" },
  ];
  return (
    <group position={[x, 0, z]}>
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
    <group position={[x, 0, z]}>
      <RoundedBox args={[1.1, 1.6, 0.7]} radius={0.06} smoothness={4} position={[0, 0.8, 0]}>
        <meshStandardMaterial color="#E8DFC9" roughness={0.85} />
      </RoundedBox>
      <RoundedBox args={[1.15, 0.14, 0.75]} radius={0.04} smoothness={4} position={[0, 1.67, 0]}>
        <meshStandardMaterial color="#3A332B" roughness={0.5} metalness={0.25} />
      </RoundedBox>
      <mesh position={[0, 1.74, 0]}><boxGeometry args={[0.7, 0.012, 0.08]} /><meshBasicMaterial color="#05060A" /></mesh>
      <mesh position={[0, 1.15, 0.36]}><planeGeometry args={[0.72, 0.38]} /><meshStandardMaterial color="#101218" roughness={0.5} emissive="#0B5563" emissiveIntensity={0.6} toneMapped={false} /></mesh>
      <mesh position={[0, 1.17, 0.363]}><planeGeometry args={[0.56, 0.012]} /><meshBasicMaterial color={station.accent} toneMapped={false} /></mesh>
      <mesh position={[0, 1.14, 0.363]}><planeGeometry args={[0.44, 0.008]} /><meshBasicMaterial color="#6BA9B5" /></mesh>
      <pointLight ref={glowRef} position={[0, 1.82, 0]} intensity={0.6} distance={2.4} color={station.accent} />
    </group>
  );
}

function CalendarDesk() {
  const station = STATIONS[4];
  const [x, , z] = station.pos;
  const cells = useMemo(() => {
    const arr: { x: number; y: number; highlighted: boolean }[] = [];
    const cols = 7; const rows = 5; const cellW = 0.2; const cellH = 0.2; const highlightI = 10;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        arr.push({ x: (c - (cols - 1) / 2) * cellW, y: ((rows - 1) / 2 - r) * cellH, highlighted: r * cols + c === highlightI });
      }
    }
    return arr;
  }, []);
  return (
    <group position={[x, 0, z]}>
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
          <mesh key={i} position={[c.x, c.y - 0.05, 0.028]}><planeGeometry args={[0.18, 0.18]} /><meshBasicMaterial color={c.highlighted ? station.accent : "#EFE3C6"} /></mesh>
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
