"use client";

import { Text } from "@react-three/drei";
import type { DeskPosition } from "@/lib/recruiter/desk-layout";

type Props = {
  desk: DeskPosition;
  companyName: string;
  recruiterName: string;
};

export function RecruiterDesk({ desk, companyName, recruiterName }: Props) {
  const [x, , z] = desk.position;
  return (
    <group position={[x, 0, z]} rotation={[0, desk.facing, 0]}>
      {/* Desk surface */}
      <mesh position={[0, 0.75, 0]}>
        <boxGeometry args={[1.4, 0.05, 0.7]} />
        <meshStandardMaterial color="#8a6e4d" roughness={0.85} />
      </mesh>
      {/* Legs */}
      {[[-0.6, -0.3], [0.6, -0.3], [-0.6, 0.3], [0.6, 0.3]].map(([dx, dz], i) => (
        <mesh key={i} position={[dx, 0.37, dz]}>
          <boxGeometry args={[0.05, 0.75, 0.05]} />
          <meshStandardMaterial color="#5e4632" />
        </mesh>
      ))}
      {/* Company sign */}
      <group position={[0, 1.2, -0.32]}>
        <mesh>
          <boxGeometry args={[0.4, 0.18, 0.02]} />
          <meshStandardMaterial color="#ffffff" />
        </mesh>
        <Text position={[0, 0.02, 0.012]} fontSize={0.05} color="#1a1a1a" anchorX="center" anchorY="middle">
          {companyName}
        </Text>
        <Text position={[0, -0.05, 0.012]} fontSize={0.025} color="#555" anchorX="center" anchorY="middle">
          {recruiterName}
        </Text>
      </group>
      {/* Decorative laptop */}
      <mesh position={[0, 0.79, -0.05]}>
        <boxGeometry args={[0.35, 0.02, 0.25]} />
        <meshStandardMaterial color="#2a2a2a" />
      </mesh>
    </group>
  );
}
