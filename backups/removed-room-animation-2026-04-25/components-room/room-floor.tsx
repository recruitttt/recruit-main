"use client";

import * as THREE from "three";
import { useMemo } from "react";
import { RoundedBox } from "@react-three/drei";

/**
 * Warm wooden floor with a subtle plank pattern, back wall, side walls.
 * Establishes the space the furniture sits in.
 */
export function RoomFloor() {
  const floorGeom = useMemo(() => new THREE.PlaneGeometry(22, 12, 1, 1), []);
  const plankLines = useMemo(() => {
    const arr: { z: number; alpha: number }[] = [];
    let i = 0;
    for (let z = -5.5; z <= 5.5; z += 0.85) {
      arr.push({ z, alpha: 0.055 + (i % 4) * 0.012 });
      i += 1;
    }
    return arr;
  }, []);
  const plankSeams = useMemo(() => {
    const arr: { x: number; z: number; alpha: number }[] = [];
    let row = 0;
    for (let z = -5.08; z <= 5.08; z += 0.85) {
      const offset = row % 2 === 0 ? -8.9 : -7.3;
      for (let x = offset; x <= 9.2; x += 3.2) {
        arr.push({ x, z, alpha: 0.045 + ((row + Math.round(x)) % 3) * 0.012 });
      }
      row += 1;
    }
    return arr;
  }, []);

  return (
    <group>
      {/* Wooden floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} geometry={floorGeom}>
        <meshStandardMaterial color="#D6C2A0" roughness={0.82} metalness={0} envMapIntensity={0.2} />
      </mesh>

      {/* Subtle plank lines */}
      {plankLines.map((p, i) => (
        <mesh
          key={i}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, 0.002, p.z]}
        >
          <planeGeometry args={[22, 0.012]} />
          <meshBasicMaterial color="#8A6A40" transparent opacity={p.alpha} />
        </mesh>
      ))}
      {plankSeams.map((p, i) => (
        <mesh
          key={`seam-${i}`}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[p.x, 0.0025, p.z]}
        >
          <planeGeometry args={[0.012, 0.62]} />
          <meshBasicMaterial color="#8A6A40" transparent opacity={p.alpha} />
        </mesh>
      ))}

      {/* Warm ambient tint pooling toward back — suggests a lived-in room */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.003, -2.2]}>
        <planeGeometry args={[20, 5]} />
        <meshStandardMaterial color="#E9D7B0" roughness={1} transparent opacity={0.32} />
      </mesh>

      {/* Back wall — tall, proper room height */}
      <RoundedBox
        args={[22, 7.4, 0.2]}
        radius={0.04}
        smoothness={4}
        position={[0, 3.7, -5.2]}
      >
        <meshStandardMaterial color="#F3EAD6" roughness={0.92} metalness={0} />
      </RoundedBox>
      {/* Wainscoting strip on back wall */}
      <mesh position={[0, 0.28, -5.08]}>
        <planeGeometry args={[22, 0.56]} />
        <meshStandardMaterial color="#E0D1B0" roughness={0.95} />
      </mesh>
      <mesh position={[0, 0.58, -5.08]}>
        <planeGeometry args={[22, 0.02]} />
        <meshStandardMaterial color="#A8906A" roughness={0.85} />
      </mesh>

      {/* Side walls (full height, matching back wall) */}
      <mesh rotation={[0, Math.PI / 2, 0]} position={[-11.05, 3.7, -1]}>
        <planeGeometry args={[8.4, 7.4]} />
        <meshStandardMaterial color="#EEE3CC" roughness={0.95} side={THREE.DoubleSide} />
      </mesh>
      <mesh rotation={[0, -Math.PI / 2, 0]} position={[11.05, 3.7, -1]}>
        <planeGeometry args={[8.4, 7.4]} />
        <meshStandardMaterial color="#EEE3CC" roughness={0.95} side={THREE.DoubleSide} />
      </mesh>

      {/* Ceiling — high so the room feels airy */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 7.4, -1]}>
        <planeGeometry args={[22, 8.4]} />
        <meshStandardMaterial color="#FBF4E2" roughness={0.98} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}
