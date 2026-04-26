"use client";

import { useEffect, useState } from "react";
import { RoundedBox, Text } from "@react-three/drei";
import { readProfile, subscribeProfile, type UserProfile } from "@/lib/profile";
import { STATIONS } from "@/lib/room/stations";

const LOGO_BG_PALETTE = ["#0F172A", "#1F2937", "#0E7490", "#7C3AED", "#D97706"] as const;

const WOOD_BASE = "#B08A5F";
const WOOD_DARK = "#6E5638";
const WOOD_LIGHT = "#D9C9A7";
const WOOD_TRIM = "#8E795B";
const PEG_BG = "#3F2F1F";
const TAG_BG = "#FFFDF6";
const TEXT_DARK = "#3A332B";

function pickLogoBg(index: number): string {
  return LOGO_BG_PALETTE[index % LOGO_BG_PALETTE.length];
}

function useProfileSnapshot(): UserProfile {
  const [profile, setProfile] = useState<UserProfile>(() => readProfile());
  useEffect(() => {
    setProfile(readProfile());
    const unsubscribe = subscribeProfile((next) => {
      setProfile(next ?? readProfile());
    });
    return unsubscribe;
  }, []);
  return profile;
}

export function ProfileWorkbench() {
  const profile = useProfileSnapshot();
  const station = STATIONS.find((s) => s.id === "profile");
  if (!station) return null;
  const [x, , z] = station.pos;

  return (
    <group position={[x, 0, z]}>
      <BackWall />
      <Diploma school={profile.education[0]?.school} />
      <SkillPegboard skills={profile.skills} />
      <FramedPhotos experience={profile.experience} />
      <Desk />
      <Clipboard filename={profile.resume?.filename} />
      <CoatRack location={profile.prefs.locations[0]} minSalary={profile.prefs.minSalary} />
    </group>
  );
}

function BackWall() {
  // Wall sits behind the desk (toward -Z from station origin) so the player at
  // z = 4.8 looking in -Z direction sees it. Its visible face points +Z.
  return (
    <group position={[0, 1.5, -0.65]}>
      <RoundedBox args={[3.4, 2.8, 0.08]} radius={0.04} smoothness={4}>
        <meshStandardMaterial color={WOOD_BASE} roughness={0.85} />
      </RoundedBox>
      <RoundedBox args={[3.6, 3.0, 0.04]} radius={0.05} smoothness={4} position={[0, 0, -0.05]}>
        <meshStandardMaterial color={WOOD_DARK} roughness={0.7} />
      </RoundedBox>
    </group>
  );
}

function Diploma({ school }: { school?: string }) {
  if (!school) return null;
  return (
    <group position={[-1.2, 2.05, -0.6]}>
      <RoundedBox args={[0.7, 0.5, 0.02]} radius={0.02} smoothness={4}>
        <meshStandardMaterial color="#FDF6E2" roughness={0.85} />
      </RoundedBox>
      <RoundedBox args={[0.74, 0.54, 0.018]} radius={0.025} smoothness={4} position={[0, 0, -0.012]}>
        <meshStandardMaterial color={WOOD_TRIM} roughness={0.55} metalness={0.15} />
      </RoundedBox>
      <Text
        position={[0, 0.04, 0.012]}
        fontSize={0.05}
        color={TEXT_DARK}
        anchorX="center"
        anchorY="middle"
        maxWidth={0.6}
        textAlign="center"
        material-toneMapped={false}
      >
        {school}
      </Text>
      <mesh position={[0, -0.12, 0.012]}>
        <planeGeometry args={[0.42, 0.012]} />
        <meshBasicMaterial color="#A2927A" />
      </mesh>
      <mesh position={[0, -0.16, 0.012]}>
        <planeGeometry args={[0.32, 0.008]} />
        <meshBasicMaterial color="#A2927A" />
      </mesh>
    </group>
  );
}

function SkillPegboard({ skills }: { skills: string[] }) {
  const tools = skills.slice(0, 12);
  const cols = 4;
  const rows = 3;
  const cellW = 0.32;
  const cellH = 0.26;

  return (
    <group position={[0.55, 1.95, -0.6]}>
      <RoundedBox args={[1.4, 0.9, 0.04]} radius={0.03} smoothness={4}>
        <meshStandardMaterial color={PEG_BG} roughness={0.78} />
      </RoundedBox>
      <RoundedBox args={[1.46, 0.96, 0.02]} radius={0.04} smoothness={4} position={[0, 0, -0.012]}>
        <meshStandardMaterial color={WOOD_TRIM} roughness={0.55} metalness={0.1} />
      </RoundedBox>
      {Array.from({ length: cols * rows }).map((_, i) => {
        const c = i % cols;
        const r = Math.floor(i / cols);
        const cx = (c - (cols - 1) / 2) * cellW;
        const cy = ((rows - 1) / 2 - r) * cellH;
        return (
          <mesh key={`peg-${i}`} position={[cx, cy + 0.07, 0.024]}>
            <cylinderGeometry args={[0.012, 0.012, 0.04, 12]} />
            <meshStandardMaterial color="#5C4A30" roughness={0.6} metalness={0.25} />
          </mesh>
        );
      })}
      {tools.map((skill, i) => {
        const c = i % cols;
        const r = Math.floor(i / cols);
        const cx = (c - (cols - 1) / 2) * cellW;
        const cy = ((rows - 1) / 2 - r) * cellH;
        return (
          <group key={`tool-${i}`} position={[cx, cy - 0.02, 0.045]}>
            <RoundedBox args={[0.26, 0.14, 0.012]} radius={0.012} smoothness={4}>
              <meshStandardMaterial color={TAG_BG} roughness={0.85} />
            </RoundedBox>
            <Text
              position={[0, 0, 0.008]}
              fontSize={0.025}
              color={TEXT_DARK}
              anchorX="center"
              anchorY="middle"
              maxWidth={0.24}
              textAlign="center"
              material-toneMapped={false}
            >
              {skill}
            </Text>
            <mesh position={[0, 0.085, 0.005]}>
              <cylinderGeometry args={[0.008, 0.008, 0.022, 12]} />
              <meshStandardMaterial color="#3A332B" roughness={0.4} metalness={0.5} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

function FramedPhotos({ experience }: { experience: UserProfile["experience"] }) {
  const photos = experience.slice(0, 4);
  if (photos.length === 0) return null;

  const spacing = 0.32;
  const startX = -((photos.length - 1) * spacing) / 2;

  return (
    <group position={[0, 1.05, -0.6]}>
      {photos.map((exp, i) => {
        const px = startX + i * spacing;
        const bg = pickLogoBg(i);
        return (
          <group key={`photo-${i}`} position={[px, 0, 0]}>
            <RoundedBox args={[0.25, 0.18, 0.02]} radius={0.012} smoothness={4}>
              <meshStandardMaterial color={WOOD_TRIM} roughness={0.55} metalness={0.1} />
            </RoundedBox>
            <mesh position={[0, 0, 0.012]}>
              <planeGeometry args={[0.21, 0.14]} />
              <meshStandardMaterial color={bg} roughness={0.75} />
            </mesh>
            <Text
              position={[0, 0, 0.014]}
              fontSize={0.025}
              color="#FFFFFF"
              anchorX="center"
              anchorY="middle"
              maxWidth={0.2}
              textAlign="center"
              material-toneMapped={false}
            >
              {exp.company}
            </Text>
          </group>
        );
      })}
    </group>
  );
}

function Desk() {
  return (
    <group>
      <RoundedBox args={[2.6, 0.08, 1.0]} radius={0.025} smoothness={4} position={[0, 0.82, 0]}>
        <meshStandardMaterial color={WOOD_LIGHT} roughness={0.78} />
      </RoundedBox>
      {[
        [-1.18, 0.41, -0.42],
        [1.18, 0.41, -0.42],
        [-1.18, 0.41, 0.42],
        [1.18, 0.41, 0.42],
      ].map((p, i) => (
        <mesh key={`leg-${i}`} position={p as [number, number, number]}>
          <boxGeometry args={[0.06, 0.82, 0.06]} />
          <meshStandardMaterial color={WOOD_TRIM} roughness={0.7} />
        </mesh>
      ))}
      <RoundedBox args={[2.6, 0.04, 1.0]} radius={0.02} smoothness={3} position={[0, 0.18, 0]}>
        <meshStandardMaterial color={WOOD_DARK} roughness={0.7} />
      </RoundedBox>
    </group>
  );
}

function Clipboard({ filename }: { filename?: string }) {
  return (
    <group position={[-0.1, 0.87, 0.1]} rotation={[-Math.PI / 2, 0, 0.04]}>
      <RoundedBox args={[0.3, 0.4, 0.01]} radius={0.012} smoothness={4}>
        <meshStandardMaterial color={WOOD_DARK} roughness={0.6} />
      </RoundedBox>
      <RoundedBox args={[0.27, 0.36, 0.012]} radius={0.008} smoothness={4} position={[0, -0.005, 0.008]}>
        <meshStandardMaterial color="#FFFDF6" roughness={0.95} />
      </RoundedBox>
      <mesh position={[0, 0.16, 0.018]}>
        <boxGeometry args={[0.12, 0.04, 0.014]} />
        <meshStandardMaterial color="#A8A29E" roughness={0.4} metalness={0.7} />
      </mesh>
      <Text
        position={[0, 0, 0.016]}
        fontSize={0.03}
        color={TEXT_DARK}
        anchorX="center"
        anchorY="middle"
        maxWidth={0.26}
        textAlign="center"
        material-toneMapped={false}
      >
        {filename ?? "no resume yet"}
      </Text>
    </group>
  );
}

function CoatRack({ location, minSalary }: { location?: string; minSalary?: string }) {
  return (
    <group position={[1.45, 0, 0.2]}>
      <mesh position={[0, 0.04, 0]}>
        <cylinderGeometry args={[0.12, 0.16, 0.08, 16]} />
        <meshStandardMaterial color={WOOD_DARK} roughness={0.85} />
      </mesh>
      <mesh position={[0, 0.95, 0]}>
        <cylinderGeometry args={[0.025, 0.03, 1.8, 12]} />
        <meshStandardMaterial color={WOOD_TRIM} roughness={0.55} metalness={0.2} />
      </mesh>
      {location ? <LocationTag location={location} /> : null}
      {minSalary ? <SalaryTag minSalary={minSalary} /> : null}
    </group>
  );
}

function LocationTag({ location }: { location: string }) {
  return (
    <group position={[0.18, 1.55, 0]}>
      <mesh position={[0, 0.06, 0]} rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[0.06, 0.16, 16]} />
        <meshStandardMaterial color="#C7543D" roughness={0.55} metalness={0.2} />
      </mesh>
      <mesh position={[0, 0.12, 0.001]}>
        <sphereGeometry args={[0.025, 16, 12]} />
        <meshStandardMaterial color="#FFFDF6" roughness={0.8} />
      </mesh>
      <mesh position={[-0.08, -0.05, 0]} rotation={[0, 0, Math.PI / 5]}>
        <cylinderGeometry args={[0.004, 0.004, 0.28, 8]} />
        <meshStandardMaterial color="#5C4A30" roughness={0.7} />
      </mesh>
      <RoundedBox args={[0.36, 0.16, 0.012]} radius={0.018} smoothness={4} position={[0, -0.18, 0]}>
        <meshStandardMaterial color={TAG_BG} roughness={0.85} />
      </RoundedBox>
      <Text
        position={[0, -0.18, 0.008]}
        fontSize={0.03}
        color={TEXT_DARK}
        anchorX="center"
        anchorY="middle"
        maxWidth={0.32}
        textAlign="center"
        material-toneMapped={false}
      >
        {location}
      </Text>
    </group>
  );
}

function SalaryTag({ minSalary }: { minSalary: string }) {
  const label = formatSalary(minSalary);
  return (
    <group position={[0.18, 1.0, 0]}>
      <mesh position={[-0.12, 0.05, 0]}>
        <cylinderGeometry args={[0.005, 0.005, 0.18, 8]} />
        <meshStandardMaterial color="#5C4A30" roughness={0.7} />
      </mesh>
      <RoundedBox args={[0.32, 0.16, 0.014]} radius={0.018} smoothness={4}>
        <meshStandardMaterial color="#F4E4C9" roughness={0.85} />
      </RoundedBox>
      <RoundedBox args={[0.34, 0.18, 0.01]} radius={0.022} smoothness={4} position={[0, 0, -0.008]}>
        <meshStandardMaterial color={WOOD_TRIM} roughness={0.6} metalness={0.1} />
      </RoundedBox>
      <Text
        position={[0, 0, 0.01]}
        fontSize={0.045}
        color={TEXT_DARK}
        anchorX="center"
        anchorY="middle"
        maxWidth={0.3}
        textAlign="center"
        material-toneMapped={false}
      >
        {label}
      </Text>
    </group>
  );
}

// minSalary is a free-form string ("120k", "$120,000", "120000", "$150k").
// Normalize to "$XXk" for the tag label.
function formatSalary(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return "$";
  const digits = trimmed.replace(/[^\d]/g, "");
  if (!digits) return trimmed;
  const value = Number.parseInt(digits, 10);
  if (Number.isNaN(value)) return trimmed;
  const k = value >= 1000 ? Math.round(value / 1000) : value;
  return `$${k}k`;
}
