"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { Html, RoundedBox } from "@react-three/drei";

const POS: [number, number, number] = [-3.2, 0, 3.6];
const FACING = (3 * Math.PI) / 4; // 3/4 turn to the back-left so user sees character's side + the board
const BODY_HUE = "#64748B";
const SHIRT_HUE = "#475569";
const BEANIE_HUE = "#B84A2E";

const NOTE_FRAMES = [
  ["latency budget", "  p50 < 320ms", "  p99 < 900ms", "throughput", "  600 req/min", "scaling plan", "  shard by user_id"],
  ["matching weights", "  skills × 0.4", "  recency × 0.25", "  proximity × 0.15", "  comp × 0.2", "tune via grid search"],
  ["funnel insight", "  apply → 41%", "  reply → 14%", "  call → 6%", "  offer → 1.8%", "lever: cold reply rate"],
  ["agent feedback loop", "  log every rejection", "  embed reason text", "  cluster top 5 weekly", "  re-tune prompt"],
];

export function CornerResearcher() {
  const groupRef = useRef<THREE.Group>(null);
  const writingArmRef = useRef<THREE.Group>(null);
  const bodyRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (writingArmRef.current) {
      writingArmRef.current.rotation.x = -1.1 + Math.sin(t * 3.2) * 0.22;
      writingArmRef.current.rotation.z = 0.18 + Math.sin(t * 3.2 + 0.7) * 0.12;
    }
    if (bodyRef.current) {
      bodyRef.current.position.y = 0.47 + Math.sin(t * 1.1) * 0.012;
      bodyRef.current.rotation.z = Math.sin(t * 0.9) * 0.014;
    }
  });

  return (
    <group ref={groupRef} position={POS} rotation={[0, FACING, 0]}>
      <Whiteboard />
      <group position={[0, 0, 0]}>
        <group position={[-0.11, 0.22, 0]}>
          <RoundedBox args={[0.15, 0.22, 0.2]} radius={0.038} smoothness={4} position={[0, -0.11, 0]} castShadow>
            <meshStandardMaterial color="#1E3A5F" roughness={0.82} />
          </RoundedBox>
        </group>
        <group position={[0.11, 0.22, 0]}>
          <RoundedBox args={[0.15, 0.22, 0.2]} radius={0.038} smoothness={4} position={[0, -0.11, 0]} castShadow>
            <meshStandardMaterial color="#1E3A5F" roughness={0.82} />
          </RoundedBox>
        </group>
        <group ref={bodyRef} position={[0, 0.47, 0]}>
          <RoundedBox args={[0.44, 0.52, 0.36]} radius={0.07} smoothness={5} castShadow>
            <meshStandardMaterial color={SHIRT_HUE} roughness={0.65} />
          </RoundedBox>
          <group position={[-0.25, 0.2, 0]}>
            <RoundedBox args={[0.13, 0.18, 0.15]} radius={0.04} smoothness={4} position={[0, -0.09, 0]} castShadow>
              <meshStandardMaterial color={SHIRT_HUE} roughness={0.7} />
            </RoundedBox>
            <RoundedBox args={[0.13, 0.22, 0.15]} radius={0.04} smoothness={4} position={[0, -0.29, 0]} castShadow>
              <meshStandardMaterial color={BODY_HUE} roughness={0.75} />
            </RoundedBox>
          </group>
          <group ref={writingArmRef} position={[0.25, 0.2, 0]}>
            <RoundedBox args={[0.13, 0.18, 0.15]} radius={0.04} smoothness={4} position={[0, -0.09, 0]} castShadow>
              <meshStandardMaterial color={SHIRT_HUE} roughness={0.7} />
            </RoundedBox>
            <group position={[0, -0.18, 0]} rotation={[0, 0, -0.3]}>
              <RoundedBox args={[0.13, 0.22, 0.15]} radius={0.04} smoothness={4} position={[0, -0.11, 0]} castShadow>
                <meshStandardMaterial color={BODY_HUE} roughness={0.75} />
              </RoundedBox>
              <mesh position={[0, -0.27, 0.05]} rotation={[0.4, 0, 0]}>
                <cylinderGeometry args={[0.012, 0.018, 0.18, 12]} />
                <meshStandardMaterial color="#1E1E1E" roughness={0.4} metalness={0.5} />
              </mesh>
            </group>
          </group>
          <group position={[0, 0.55, 0]}>
            <RoundedBox args={[0.62, 0.58, 0.5]} radius={0.13} smoothness={5} castShadow>
              <meshStandardMaterial color="#E8C9A8" roughness={0.65} />
            </RoundedBox>
            <mesh position={[0, 0.32, 0.04]}>
              <cylinderGeometry args={[0.34, 0.36, 0.16, 24]} />
              <meshStandardMaterial color={BEANIE_HUE} roughness={0.7} />
            </mesh>
            <mesh position={[0, 0.42, 0.04]}>
              <sphereGeometry args={[0.08, 16, 16]} />
              <meshStandardMaterial color={BEANIE_HUE} roughness={0.85} />
            </mesh>
            <mesh position={[-0.13, 0.05, 0.27]}>
              <sphereGeometry args={[0.04, 12, 12]} />
              <meshStandardMaterial color="#101827" roughness={0.4} />
            </mesh>
            <mesh position={[0.13, 0.05, 0.27]}>
              <sphereGeometry args={[0.04, 12, 12]} />
              <meshStandardMaterial color="#101827" roughness={0.4} />
            </mesh>
          </group>
        </group>
      </group>
    </group>
  );
}

function Whiteboard() {
  return (
    <group position={[0, 0, 0.95]}>
      <mesh position={[0, 0.08, 0]}>
        <cylinderGeometry args={[0.42, 0.48, 0.12, 24]} />
        <meshStandardMaterial color="#A18A66" roughness={0.85} />
      </mesh>
      <mesh position={[-0.32, 0.5, 0]}>
        <boxGeometry args={[0.04, 1.0, 0.04]} />
        <meshStandardMaterial color="#7E6A4C" roughness={0.7} />
      </mesh>
      <mesh position={[0.32, 0.5, 0]}>
        <boxGeometry args={[0.04, 1.0, 0.04]} />
        <meshStandardMaterial color="#7E6A4C" roughness={0.7} />
      </mesh>
      <RoundedBox args={[1.4, 0.95, 0.05]} radius={0.025} smoothness={4} position={[0, 1.18, 0]}>
        <meshStandardMaterial color="#EBE3D2" roughness={0.92} />
      </RoundedBox>
      <RoundedBox args={[1.5, 1.05, 0.025]} radius={0.03} smoothness={4} position={[0, 1.18, -0.026]}>
        <meshStandardMaterial color="#6E5638" roughness={0.6} />
      </RoundedBox>
      <Html
        transform
        position={[0, 1.18, 0.028]}
        rotation={[0, 0, 0]}
        distanceFactor={0.6}
        occlude="blending"
        style={{ pointerEvents: "none" }}
      >
        <WhiteboardNotes />
      </Html>
      <mesh position={[-0.55, 0.18, 0.06]} rotation={[0, 0, -0.1]}>
        <cylinderGeometry args={[0.025, 0.03, 0.22, 16]} />
        <meshStandardMaterial color="#F5E9D0" roughness={0.85} />
      </mesh>
    </group>
  );
}

function WhiteboardNotes() {
  const [frame, setFrame] = useState(0);
  const [step, setStep] = useState(0);
  useEffect(() => {
    const lines = NOTE_FRAMES[frame];
    if (step < lines.length) {
      const id = window.setTimeout(() => setStep(step + 1), 700);
      return () => window.clearTimeout(id);
    }
    const id = window.setTimeout(() => {
      setStep(0);
      setFrame((f) => (f + 1) % NOTE_FRAMES.length);
    }, 2400);
    return () => window.clearTimeout(id);
  }, [frame, step]);

  const lines = NOTE_FRAMES[frame].slice(0, step);

  return (
    <div
      style={{
        width: 320,
        height: 220,
        padding: "16px 22px",
        background: "transparent",
        color: "#1E3A5F",
        fontFamily: "ui-monospace, 'JetBrains Mono', monospace",
        fontSize: 13,
        lineHeight: 1.5,
      }}
    >
      {lines.map((line, i) => (
        <div
          key={i}
          style={{
            color: line.startsWith(" ") ? "#586474" : "#1E3A5F",
            fontWeight: line.startsWith(" ") ? 400 : 600,
            whiteSpace: "pre",
            opacity: 0,
            animation: `wb-fade-in 0.25s ease-out ${i * 0.05}s forwards`,
          }}
        >
          {line}
        </div>
      ))}
      <style>{`@keyframes wb-fade-in { to { opacity: 1 } }`}</style>
    </div>
  );
}
