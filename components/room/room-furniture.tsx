"use client";

import { InteractiveHotspot } from "./interactive-hotspot";

import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import { useBeachTexture } from "./beach-texture";
import { tweenValue, updateTweens } from "@/lib/room/animation";
import { useRoomStore } from "./room-store";

/**
 * Extra room dressing: sofa + coffee table, rug, TV, back-wall windows,
 * plants, bookshelf, small decorative objects. All primitives, all matte.
 */
export function RoomFurniture() {
  return (
    <group>
      <DeskAnchor />
      <RugArea position={[-6.55, 0.008, 3.0]} rotation={[0, Math.PI / 2, 0]} />
      <Sofa position={[-7.45, 0, 3.0]} rotation={[0, Math.PI / 2, 0]} />
      <CoffeeTable position={[-5.85, 0, 3.0]} rotation={[0, Math.PI / 2, 0]} />
      <WallTV position={[-9.9, 2.1, 1.5]} />
      <Bookshelf position={[9.9, 0, 1.8]} />
      <PlantInPot position={[-8.4, 0, 4.4]} variant="fern" />
      <PlantInPot position={[8.6, 0, 4.6]} variant="monstera" />
      <PlantInPot position={[2.4, 0, -4.4]} variant="succulent" />
      <FloorLamp position={[-8.55, 0, 1.15]} />
      <BackWallWindows />
      <CeilingBeams />
      <CeilingFan position={[0, 7.28, 1.6]} />
      <FurnitureHotspots />
    </group>
  );
}

/**
 * DeskAnchor: subscribes to the shared `deskState` slot in the room store and
 * drives a collapse/expand scale animation. The desk geometry itself is rendered
 * by `recruiter-desk.tsx`, but the animation tick + state wiring lives here so
 * the broader furniture scene owns the global tween pump while it's mounted.
 *
 * When `deskState` changes between "collapsed" and "expanded", this component:
 *  1. Sets state to "animating" (consumers can disable interactions).
 *  2. Tweens the scale value from 0.4 -> 1 (or vice versa) over 800ms.
 *  3. Resolves back to the target state on completion.
 *
 * The resulting `deskScale` is stored in the zustand snapshot only via the
 * lifecycle setter; consumers (e.g., the recruiter desk component) read
 * `deskState` directly and can compute their own scale from it, or this
 * file can be extended later to host the desk geometry once it migrates here.
 */
function DeskAnchor() {
  const deskState = useRoomStore((s) => s.deskState);
  const setDeskState = useRoomStore((s) => s.setDeskState);
  const playerPose = useRoomStore((s) => s.playerPose);
  const [scale, setScale] = useState<number>(deskState === "expanded" ? 1 : 0.4);
  const lastTargetRef = useRef<typeof deskState>(deskState);

  // Auto-expand the desk when the player sits, collapse when they stand
  useEffect(() => {
    if (playerPose === "sitting" && deskState === "collapsed") {
      setDeskState("expanded");
    } else if (playerPose !== "sitting" && deskState === "expanded") {
      setDeskState("collapsed");
    }
  }, [playerPose, deskState, setDeskState]);

  useEffect(() => {
    if (lastTargetRef.current === deskState && deskState !== "animating") return;
    if (deskState === "animating") return;
    lastTargetRef.current = deskState;
    const target = deskState === "expanded" ? 1 : 0.4;
    const finalState = deskState;
    setDeskState("animating");
    tweenValue(scale, target, 800, "cubicInOut", setScale, () => {
      setDeskState(finalState);
      lastTargetRef.current = finalState;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deskState, setDeskState]);

  useFrame(() => updateTweens(performance.now()));

  // The user's primary desk — sits at world origin facing -z so that when the
  // player sits (E key near [0,0,1]), the desk-hub Html surface mounts cleanly
  // on the monitor at z = -0.3, y = 1.5.
  return (
    <group position={[0, 0, 0]} scale={[scale, scale, scale]}>
      <PlayerDesk />
    </group>
  );
}

function PlayerDesk() {
  return (
    <group>
      {/* Desk top */}
      <RoundedBox args={[2.6, 0.06, 1.2]} radius={0.02} smoothness={4} position={[0, 0.95, 0]}>
        <meshStandardMaterial color="#A88766" roughness={0.6} metalness={0.05} />
      </RoundedBox>
      {/* Desk legs */}
      {[
        [-1.22, 0.475, -0.55],
        [1.22, 0.475, -0.55],
        [-1.22, 0.475, 0.55],
        [1.22, 0.475, 0.55],
      ].map((p, i) => (
        <mesh key={`desk-leg-${i}`} position={p as [number, number, number]}>
          <boxGeometry args={[0.06, 0.95, 0.06]} />
          <meshStandardMaterial color="#3A2F22" roughness={0.5} metalness={0.4} />
        </mesh>
      ))}
      {/* Monitor stand */}
      <mesh position={[0, 1.04, -0.35]}>
        <boxGeometry args={[0.16, 0.08, 0.18]} />
        <meshStandardMaterial color="#2C2A28" roughness={0.4} metalness={0.5} />
      </mesh>
      <mesh position={[0, 1.22, -0.35]}>
        <boxGeometry args={[0.04, 0.36, 0.04]} />
        <meshStandardMaterial color="#2C2A28" roughness={0.4} metalness={0.5} />
      </mesh>
      {/* Monitor body — the desk-hub Html surface mounts here when sitting */}
      <RoundedBox
        args={[1.6, 1.0, 0.06]}
        radius={0.025}
        smoothness={4}
        position={[0, 1.5, -0.32]}
      >
        <meshStandardMaterial color="#15161A" roughness={0.35} metalness={0.6} />
      </RoundedBox>
      {/* Monitor screen glow (when collapsed, this is what the user sees from afar) */}
      <mesh position={[0, 1.5, -0.288]}>
        <planeGeometry args={[1.5, 0.92]} />
        <meshBasicMaterial color="#1F2A44" toneMapped={false} />
      </mesh>
      {/* Keyboard */}
      <RoundedBox args={[0.8, 0.025, 0.24]} radius={0.01} smoothness={3} position={[0, 0.99, 0.18]}>
        <meshStandardMaterial color="#1A1A1F" roughness={0.5} metalness={0.3} />
      </RoundedBox>
      {/* Mouse */}
      <RoundedBox args={[0.08, 0.018, 0.13]} radius={0.008} smoothness={3} position={[0.55, 0.985, 0.18]}>
        <meshStandardMaterial color="#1A1A1F" roughness={0.5} metalness={0.3} />
      </RoundedBox>
      {/* Mug */}
      <group position={[-0.7, 1.0, 0.1]}>
        <mesh>
          <cylinderGeometry args={[0.05, 0.045, 0.1, 16]} />
          <meshStandardMaterial color="#E8D8B8" roughness={0.9} />
        </mesh>
        <mesh position={[0, 0.052, 0]}>
          <cylinderGeometry args={[0.045, 0.045, 0.005, 16]} />
          <meshStandardMaterial color="#5B3E1E" roughness={0.6} />
        </mesh>
      </group>
      {/* Notebook */}
      <RoundedBox args={[0.32, 0.018, 0.22]} radius={0.005} smoothness={3} position={[0.65, 0.99, -0.1]}>
        <meshStandardMaterial color="#3F4A6A" roughness={0.85} />
      </RoundedBox>
      {/* Office chair (player sits here when first-person desk camera engages) */}
      <PlayerChair position={[0, 0, 1.2]} />
    </group>
  );
}

function PlayerChair({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      {/* Seat */}
      <RoundedBox args={[0.55, 0.08, 0.55]} radius={0.04} smoothness={4} position={[0, 0.5, 0]}>
        <meshStandardMaterial color="#2A2A2E" roughness={0.7} />
      </RoundedBox>
      {/* Back */}
      <RoundedBox args={[0.55, 0.7, 0.08]} radius={0.05} smoothness={4} position={[0, 0.85, 0.24]}>
        <meshStandardMaterial color="#2A2A2E" roughness={0.7} />
      </RoundedBox>
      {/* Stem */}
      <mesh position={[0, 0.28, 0]}>
        <cylinderGeometry args={[0.03, 0.03, 0.42, 12]} />
        <meshStandardMaterial color="#1A1A1F" roughness={0.4} metalness={0.6} />
      </mesh>
      {/* Base */}
      <mesh position={[0, 0.06, 0]}>
        <cylinderGeometry args={[0.03, 0.32, 0.04, 16]} />
        <meshStandardMaterial color="#1A1A1F" roughness={0.4} metalness={0.6} />
      </mesh>
      {/* Wheels */}
      {[0, 1, 2, 3, 4].map((i) => {
        const angle = (i / 5) * Math.PI * 2;
        const r = 0.3;
        return (
          <mesh
            key={`wheel-${i}`}
            position={[Math.cos(angle) * r, 0.025, Math.sin(angle) * r]}
          >
            <sphereGeometry args={[0.03, 8, 6]} />
            <meshStandardMaterial color="#0F0F12" roughness={0.6} />
          </mesh>
        );
      })}
    </group>
  );
}

function FurnitureHotspots() {
  return (
    <>
      <InteractiveHotspot
        target={{ kind: "furniture", id: "sofa" }}
        hotspotKey="furniture:sofa"
        size={[1.6, 1.4, 3.4]}
        position={[-7.45, 0.7, 3.0]}
      />
      <InteractiveHotspot
        target={{ kind: "furniture", id: "coffee-table" }}
        hotspotKey="furniture:coffee-table"
        size={[1.0, 0.8, 1.6]}
        position={[-5.85, 0.4, 3.0]}
      />
      <InteractiveHotspot
        target={{ kind: "furniture", id: "tv" }}
        hotspotKey="furniture:tv"
        size={[1.0, 1.8, 2.6]}
        position={[-9.9, 2.1, 1.5]}
      />
      <InteractiveHotspot
        target={{ kind: "furniture", id: "bookshelf" }}
        hotspotKey="furniture:bookshelf"
        size={[1.2, 4.4, 2.6]}
        position={[9.9, 2.2, 1.8]}
      />
      <InteractiveHotspot
        target={{ kind: "furniture", id: "window" }}
        hotspotKey="furniture:window"
        size={[10.0, 3.2, 0.6]}
        position={[0, 3.6, -5.0]}
      />
      <InteractiveHotspot
        target={{ kind: "furniture", id: "plant" }}
        hotspotKey="furniture:plant"
        size={[1.4, 2.6, 1.4]}
        position={[-8.4, 1.3, 4.4]}
      />
      <InteractiveHotspot
        target={{ kind: "furniture", id: "ceiling-fan" }}
        hotspotKey="furniture:ceiling-fan"
        size={[2.4, 0.8, 2.4]}
        position={[0, 6.9, 1.6]}
      />
    </>
  );
}

function RugArea({
  position,
  rotation,
}: {
  position: [number, number, number];
  rotation?: [number, number, number];
}) {
  return (
    <group position={position} rotation={rotation}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[5.4, 3.6]} />
        <meshStandardMaterial color="#8F3E36" roughness={1} metalness={0} />
      </mesh>
      {/* Low-contrast woven bands so the rug reads like fabric, not a flat plane */}
      {[-1.35, -0.9, -0.45, 0, 0.45, 0.9, 1.35].map((z, i) => (
        <mesh key={`rug-h-${i}`} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.0015 + i * 0.0001, z]}>
          <planeGeometry args={[5.05, 0.028]} />
          <meshBasicMaterial color={i % 2 === 0 ? "#A9554A" : "#6F2F2A"} transparent opacity={0.13} />
        </mesh>
      ))}
      {[-2, -1.35, -0.7, 0, 0.7, 1.35, 2].map((x, i) => (
        <mesh key={`rug-v-${i}`} rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.0023 + i * 0.0001, 0]}>
          <planeGeometry args={[0.022, 3.25]} />
          <meshBasicMaterial color="#6F2F2A" transparent opacity={0.08} />
        </mesh>
      ))}
      {[
        { position: [0, 0.0032, -1.48], args: [4.7, 0.045] },
        { position: [0, 0.0033, 1.48], args: [4.7, 0.045] },
        { position: [-2.35, 0.0034, 0], args: [0.045, 2.95] },
        { position: [2.35, 0.0035, 0], args: [0.045, 2.95] },
      ].map((line, i) => (
        <mesh
          key={`rug-inner-${i}`}
          rotation={[-Math.PI / 2, 0, 0]}
          position={line.position as [number, number, number]}
        >
          <planeGeometry args={line.args as [number, number]} />
          <meshBasicMaterial color="#5E2825" transparent opacity={0.24} />
        </mesh>
      ))}
      {/* Contained border and diamond motif */}
      {[
        { position: [0, 0.0042, -1.6], args: [5.0, 0.055], rot: 0, opacity: 0.5 },
        { position: [0, 0.0043, 1.6], args: [5.0, 0.055], rot: 0, opacity: 0.5 },
        { position: [-2.5, 0.0044, 0], args: [3.1, 0.055], rot: Math.PI / 2, opacity: 0.5 },
        { position: [2.5, 0.0045, 0], args: [3.1, 0.055], rot: Math.PI / 2, opacity: 0.5 },
        { position: [1.04, 0.0046, 0.64], args: [2.44, 0.05], rot: -0.55, opacity: 0.34 },
        { position: [1.04, 0.0047, -0.64], args: [2.44, 0.05], rot: 0.55, opacity: 0.34 },
        { position: [-1.04, 0.0048, -0.64], args: [2.44, 0.05], rot: -0.55, opacity: 0.34 },
        { position: [-1.04, 0.0049, 0.64], args: [2.44, 0.05], rot: 0.55, opacity: 0.34 },
      ].map((line, i) => (
        <mesh
          key={`rug-contained-${i}`}
          rotation={[-Math.PI / 2, 0, line.rot]}
          position={line.position as [number, number, number]}
        >
          <planeGeometry args={line.args as [number, number]} />
          <meshBasicMaterial color="#5E2825" transparent opacity={line.opacity} />
        </mesh>
      ))}
    </group>
  );
}

function Sofa({
  position,
  rotation,
}: {
  position: [number, number, number];
  rotation?: [number, number, number];
}) {
  return (
    <group position={position} rotation={rotation}>
      {/* Base */}
      <RoundedBox args={[3.6, 0.42, 1.3]} radius={0.12} smoothness={4} position={[0, 0.26, 0]}>
        <meshStandardMaterial color="#C9B89A" roughness={0.95} />
      </RoundedBox>
      {/* Back */}
      <RoundedBox args={[3.6, 0.9, 0.28]} radius={0.1} smoothness={4} position={[0, 0.8, -0.52]}>
        <meshStandardMaterial color="#D4C3A6" roughness={0.95} />
      </RoundedBox>
      {/* Seat cushions */}
      {[-1.15, 0, 1.15].map((x, i) => (
        <RoundedBox
          key={i}
          args={[1.08, 0.22, 1.1]}
          radius={0.1}
          smoothness={4}
          position={[x, 0.56, 0.04]}
        >
          <meshStandardMaterial color="#E9DBC0" roughness={0.92} />
        </RoundedBox>
      ))}
      {/* Cushion seams */}
      {[-0.575, 0.575].map((x, i) => (
        <RoundedBox key={`seat-seam-${i}`} args={[0.035, 0.014, 0.94]} radius={0.01} smoothness={3} position={[x, 0.682, 0.05]}>
          <meshStandardMaterial color="#D8CAAF" roughness={0.95} />
        </RoundedBox>
      ))}
      <RoundedBox args={[3.25, 0.018, 0.045]} radius={0.01} smoothness={3} position={[0, 0.674, 0.58]}>
        <meshStandardMaterial color="#D6C4A5" roughness={0.95} />
      </RoundedBox>
      {/* Armrests */}
      <RoundedBox args={[0.3, 0.55, 1.3]} radius={0.08} smoothness={4} position={[-1.78, 0.55, 0]}>
        <meshStandardMaterial color="#BFAD8F" roughness={0.95} />
      </RoundedBox>
      <RoundedBox args={[0.3, 0.55, 1.3]} radius={0.08} smoothness={4} position={[1.78, 0.55, 0]}>
        <meshStandardMaterial color="#BFAD8F" roughness={0.95} />
      </RoundedBox>
      {/* Throw pillow */}
      <RoundedBox args={[0.5, 0.44, 0.44]} radius={0.08} smoothness={4} position={[-1.35, 0.85, 0.08]} rotation={[0.05, 0.3, -0.05]}>
        <meshStandardMaterial color="#C7543D" roughness={0.95} />
      </RoundedBox>
      <RoundedBox args={[0.5, 0.44, 0.44]} radius={0.08} smoothness={4} position={[1.3, 0.85, 0.08]} rotation={[0.05, -0.3, 0.05]}>
        <meshStandardMaterial color="#3C7A69" roughness={0.95} />
      </RoundedBox>
      {/* Thin wooden legs */}
      {[[-1.6, -0.4], [1.6, -0.4], [-1.6, 0.5], [1.6, 0.5]].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.08, z]}>
          <cylinderGeometry args={[0.04, 0.03, 0.16, 10]} />
          <meshStandardMaterial color="#5E4B2F" roughness={0.6} metalness={0.1} />
        </mesh>
      ))}
    </group>
  );
}

function CoffeeTable({
  position,
  rotation,
}: {
  position: [number, number, number];
  rotation?: [number, number, number];
}) {
  return (
    <group position={position} rotation={rotation}>
      {/* Top */}
      <RoundedBox args={[1.5, 0.06, 0.85]} radius={0.04} smoothness={4} position={[0, 0.42, 0]}>
        <meshStandardMaterial color="#B6905C" roughness={0.55} metalness={0.08} />
      </RoundedBox>
      {/* Legs */}
      {[
        [-0.65, 0.21, -0.35],
        [0.65, 0.21, -0.35],
        [-0.65, 0.21, 0.35],
        [0.65, 0.21, 0.35],
      ].map((p, i) => (
        <mesh key={i} position={p as [number, number, number]}>
          <cylinderGeometry args={[0.025, 0.025, 0.42, 10]} />
          <meshStandardMaterial color="#3F3626" roughness={0.5} metalness={0.35} />
        </mesh>
      ))}
      {/* Stack of books */}
      <group position={[-0.35, 0.47, 0.04]}>
        <RoundedBox args={[0.48, 0.05, 0.32]} radius={0.01} smoothness={3}>
          <meshStandardMaterial color="#C95B48" roughness={0.8} />
        </RoundedBox>
        <RoundedBox args={[0.46, 0.04, 0.3]} radius={0.01} smoothness={3} position={[0.02, 0.05, 0]}>
          <meshStandardMaterial color="#2E4F6A" roughness={0.8} />
        </RoundedBox>
        <RoundedBox args={[0.42, 0.04, 0.28]} radius={0.01} smoothness={3} position={[-0.02, 0.09, 0]}>
          <meshStandardMaterial color="#E6DAB8" roughness={0.85} />
        </RoundedBox>
      </group>
      {/* Mug */}
      <group position={[0.38, 0.47, 0.1]}>
        <mesh>
          <cylinderGeometry args={[0.055, 0.045, 0.08, 16]} />
          <meshStandardMaterial color="#F4EBDA" roughness={0.9} />
        </mesh>
        <mesh position={[0, 0.04, 0]}>
          <cylinderGeometry args={[0.05, 0.05, 0.003, 16]} />
          <meshStandardMaterial color="#5B3E1E" roughness={0.6} />
        </mesh>
      </group>
    </group>
  );
}

function WallTV({ position }: { position: [number, number, number] }) {
  const screenRef = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (!screenRef.current) return;
    const m = screenRef.current.material as THREE.MeshBasicMaterial;
    const t = clock.elapsedTime;
    const base = 0.28 + Math.sin(t * 0.8) * 0.08;
    m.color.setRGB(base, base * 1.1, base * 1.3);
  });

  return (
    <group position={position} rotation={[0, Math.PI / 2, 0]}>
      {/* TV bezel */}
      <RoundedBox args={[2.4, 1.4, 0.12]} radius={0.04} smoothness={4}>
        <meshStandardMaterial color="#1A1A1F" roughness={0.4} metalness={0.35} />
      </RoundedBox>
      {/* Screen */}
      <mesh ref={screenRef} position={[0, 0, 0.065]}>
        <planeGeometry args={[2.26, 1.28]} />
        <meshBasicMaterial color="#3A5A7A" toneMapped={false} />
      </mesh>
      {/* Lower accent strip */}
      <mesh position={[-0.9, -0.58, 0.066]}>
        <planeGeometry args={[0.46, 0.04]} />
        <meshBasicMaterial color="#E8EEF2" toneMapped={false} />
      </mesh>
      <mesh position={[-0.55, -0.63, 0.066]}>
        <planeGeometry args={[0.3, 0.025]} />
        <meshBasicMaterial color="#8FA7B8" toneMapped={false} />
      </mesh>
      {/* Wall mount arm */}
      <mesh position={[0, 0, -0.12]}>
        <boxGeometry args={[0.12, 0.12, 0.18]} />
        <meshStandardMaterial color="#2A2723" roughness={0.7} />
      </mesh>
    </group>
  );
}

function Bookshelf({ position }: { position: [number, number, number] }) {
  const books = useMemo(() => {
    const palette = ["#C95B48", "#2E4F6A", "#E6DAB8", "#5E7E5E", "#B6905C", "#8A6FA0", "#D9A44A", "#A04032"];
    const out: { x: number; row: number; w: number; h: number; color: string }[] = [];
    for (let row = 0; row < 3; row++) {
      let x = -0.78;
      while (x < 0.78) {
        const w = 0.08 + Math.random() * 0.06;
        const h = 0.28 + Math.random() * 0.08;
        out.push({ x: x + w / 2, row, w, h, color: palette[Math.floor(Math.random() * palette.length)] });
        x += w + 0.008;
      }
    }
    return out;
  }, []);

  return (
    <group position={position} rotation={[0, -Math.PI / 2, 0]}>
      {/* Frame */}
      <RoundedBox args={[1.8, 2.2, 0.5]} radius={0.03} smoothness={4} position={[0, 1.1, -0.05]}>
        <meshStandardMaterial color="#A58560" roughness={0.8} />
      </RoundedBox>
      {/* Back panel (recessed) */}
      <mesh position={[0, 1.1, 0.19]}>
        <planeGeometry args={[1.7, 2.1]} />
        <meshStandardMaterial color="#7D6142" roughness={0.9} />
      </mesh>
      {/* Shelves */}
      {[0.4, 1.1, 1.8].map((y, i) => (
        <RoundedBox key={i} args={[1.7, 0.04, 0.44]} radius={0.01} smoothness={3} position={[0, y, 0]}>
          <meshStandardMaterial color="#8E6D48" roughness={0.8} />
        </RoundedBox>
      ))}
      {/* Books */}
      {books.map((b, i) => (
        <RoundedBox
          key={i}
          args={[b.w, b.h, 0.22]}
          radius={0.005}
          smoothness={3}
          position={[b.x, 0.42 + 0.7 * b.row + b.h / 2, 0.02]}
        >
          <meshStandardMaterial color={b.color} roughness={0.85} />
        </RoundedBox>
      ))}
      {/* Plant on top */}
      <group position={[0.6, 2.26, 0]}>
        <mesh>
          <cylinderGeometry args={[0.11, 0.09, 0.2, 18]} />
          <meshStandardMaterial color="#B58556" roughness={0.9} />
        </mesh>
        <mesh position={[0, 0.26, 0]}>
          <sphereGeometry args={[0.2, 14, 12]} />
          <meshStandardMaterial color="#5E8E5A" roughness={0.9} />
        </mesh>
      </group>
      {/* Framed picture */}
      <group position={[-0.55, 2.26, 0]}>
        <RoundedBox args={[0.5, 0.36, 0.04]} radius={0.02} smoothness={3}>
          <meshStandardMaterial color="#4B3C2B" roughness={0.65} />
        </RoundedBox>
        <mesh position={[0, 0, 0.022]}>
          <planeGeometry args={[0.4, 0.26]} />
          <meshBasicMaterial color="#E1D5B6" />
        </mesh>
      </group>
    </group>
  );
}

function PlantInPot({
  position,
  variant,
}: {
  position: [number, number, number];
  variant: "fern" | "monstera" | "succulent";
}) {
  return (
    <group position={position}>
      {/* Pot */}
      <mesh>
        <cylinderGeometry args={[0.28, 0.22, 0.42, 20]} />
        <meshStandardMaterial color="#C87A4A" roughness={0.85} />
      </mesh>
      {/* Rim */}
      <mesh position={[0, 0.22, 0]}>
        <cylinderGeometry args={[0.3, 0.28, 0.06, 20]} />
        <meshStandardMaterial color="#A8603A" roughness={0.75} />
      </mesh>
      {/* Soil */}
      <mesh position={[0, 0.18, 0]}>
        <cylinderGeometry args={[0.26, 0.26, 0.02, 20]} />
        <meshStandardMaterial color="#3B2A1C" roughness={1} />
      </mesh>
      {variant === "fern" && <Fern />}
      {variant === "monstera" && <Monstera />}
      {variant === "succulent" && <Succulent />}
    </group>
  );
}

function Fern() {
  const leaves = useMemo(
    () => Array.from({ length: 14 }).map((_, i) => ({
      angle: (i / 14) * Math.PI * 2 + Math.random() * 0.2,
      tilt: 0.4 + Math.random() * 0.3,
      len: 0.48 + Math.random() * 0.16,
    })),
    []
  );
  return (
    <group position={[0, 0.2, 0]}>
      {leaves.map((l, i) => (
        <group key={i} rotation={[l.tilt, l.angle, 0]}>
          <mesh position={[0, l.len / 2, 0]}>
            <coneGeometry args={[0.06, l.len, 6]} />
            <meshStandardMaterial color={i % 2 === 0 ? "#4A7A3E" : "#5C8F50"} roughness={0.9} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function Monstera() {
  const leaves = useMemo(
    () => [
      { x: -0.24, y: 0.72, z: 0.04, scale: 0.82, yaw: -0.52, roll: 0.32, color: "#2F6F3E" },
      { x: 0.22, y: 0.78, z: 0.03, scale: 0.9, yaw: 0.45, roll: -0.28, color: "#367C49" },
      { x: -0.08, y: 1.02, z: 0.0, scale: 1.0, yaw: -0.08, roll: 0.06, color: "#2E7441" },
      { x: 0.34, y: 0.55, z: -0.02, scale: 0.72, yaw: 0.82, roll: -0.42, color: "#438A54" },
      { x: -0.36, y: 0.5, z: -0.03, scale: 0.7, yaw: -0.85, roll: 0.44, color: "#3F8550" },
      { x: 0.08, y: 1.22, z: 0.02, scale: 0.78, yaw: 0.24, roll: -0.1, color: "#2C6639" },
    ],
    []
  );
  return (
    <group position={[0, 0.16, 0]}>
      {leaves.map((leaf, i) => (
        <group key={i}>
          <mesh
            position={[leaf.x * 0.45, leaf.y * 0.5, leaf.z * 0.45]}
            rotation={[0.16, leaf.yaw, leaf.roll]}
          >
            <cylinderGeometry args={[0.012, 0.018, leaf.y * 0.52, 6]} />
            <meshStandardMaterial color="#476A38" roughness={0.82} />
          </mesh>
          <group position={[leaf.x, leaf.y, leaf.z]} rotation={[0.04, leaf.yaw, leaf.roll]}>
            <mesh scale={[0.78 * leaf.scale, 1.08 * leaf.scale, 0.05]}>
              <sphereGeometry args={[0.24, 20, 14]} />
              <meshStandardMaterial color={leaf.color} roughness={0.72} metalness={0.02} />
            </mesh>
            <mesh position={[0, 0, 0.016]} rotation={[0, 0, Math.PI / 2]} scale={[leaf.scale, 1, 1]}>
              <boxGeometry args={[0.006, 0.32, 0.006]} />
              <meshStandardMaterial color="#77A96D" roughness={0.76} />
            </mesh>
          </group>
        </group>
      ))}
    </group>
  );
}

function Succulent() {
  const leaves = useMemo(
    () =>
      Array.from({ length: 14 }).map((_, i) => {
        const angle = (i / 14) * Math.PI * 2;
        const inner = i % 2 === 0;
        return {
          angle,
          radius: inner ? 0.1 : 0.17,
          y: inner ? 0.2 : 0.16,
          scale: inner ? 0.72 : 0.92,
          color: inner ? "#6FA877" : "#557F5E",
        };
      }),
    []
  );
  return (
    <group position={[0, 0.2, 0]}>
      {leaves.map((leaf, i) => (
        <mesh
          key={i}
          position={[
            Math.cos(leaf.angle) * leaf.radius,
            leaf.y,
            Math.sin(leaf.angle) * leaf.radius,
          ]}
          rotation={[0.38, -leaf.angle, 0.18]}
          scale={[leaf.scale, 0.34, 0.18]}
        >
          <sphereGeometry args={[0.16, 16, 10]} />
          <meshStandardMaterial color={leaf.color} roughness={0.78} />
        </mesh>
      ))}
      <mesh position={[0, 0.24, 0]} scale={[0.7, 0.36, 0.7]}>
        <sphereGeometry args={[0.13, 16, 10]} />
        <meshStandardMaterial color="#80B986" roughness={0.76} />
      </mesh>
    </group>
  );
}

function FloorLamp({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      {/* Soft spill from the shade */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.006, 0]}>
        <circleGeometry args={[0.82, 36]} />
        <meshBasicMaterial color="#FFE1A8" transparent opacity={0.16} depthWrite={false} />
      </mesh>
      {/* Base */}
      <mesh>
        <cylinderGeometry args={[0.2, 0.24, 0.05, 20]} />
        <meshStandardMaterial color="#2A2723" roughness={0.6} metalness={0.3} />
      </mesh>
      {/* Pole */}
      <mesh position={[0, 0.95, 0]}>
        <cylinderGeometry args={[0.012, 0.012, 1.9, 8]} />
        <meshStandardMaterial color="#3A332B" roughness={0.5} metalness={0.4} />
      </mesh>
      {/* Shade */}
      <mesh position={[0, 1.95, 0]}>
        <coneGeometry args={[0.28, 0.4, 20, 1, true]} />
        <meshStandardMaterial color="#F4EBDA" roughness={0.9} side={THREE.DoubleSide} emissive="#FFE7B0" emissiveIntensity={0.32} />
      </mesh>
      {/* Warm point light from shade */}
      <pointLight position={[0, 1.8, 0]} intensity={0.78} distance={4.4} color="#FFD89B" decay={2} />
    </group>
  );
}

function BackWallWindows() {
  const beach = useBeachTexture();
  // One long picture window spanning most of the back wall
  const WIN_W = 18.5;
  const WIN_H = 2.95;
  const FRAME_D = 0.12;
  const lightCenters = [-7.1, -2.35, 2.35, 7.1];

  return (
    <group position={[0, 3.18, -5.07]}>
      {/* Linen side panels and a slim rail integrate the panorama into the wall */}
      <mesh position={[-WIN_W / 2 - 0.22, 0, 0.088]}>
        <planeGeometry args={[0.44, WIN_H + 0.42]} />
        <meshStandardMaterial color="#D8C6A6" roughness={0.9} transparent opacity={0.78} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[WIN_W / 2 + 0.22, 0, 0.088]}>
        <planeGeometry args={[0.44, WIN_H + 0.42]} />
        <meshStandardMaterial color="#D8C6A6" roughness={0.9} transparent opacity={0.78} side={THREE.DoubleSide} />
      </mesh>
      {[-WIN_W / 2 - 0.34, -WIN_W / 2 - 0.1, WIN_W / 2 + 0.1, WIN_W / 2 + 0.34].map((x, i) => (
        <mesh key={`curtain-pleat-${i}`} position={[x, 0, 0.09]}>
          <planeGeometry args={[0.035, WIN_H + 0.28]} />
          <meshBasicMaterial color="#BDA985" transparent opacity={0.24} />
        </mesh>
      ))}
      <mesh rotation={[0, 0, Math.PI / 2]} position={[0, WIN_H / 2 + 0.28, 0.11]}>
        <cylinderGeometry args={[0.035, 0.035, WIN_W + 1.25, 16]} />
        <meshStandardMaterial color="#8E795B" roughness={0.55} metalness={0.15} />
      </mesh>
      {/* Outer frame (slim border around the entire window) */}
      <RoundedBox
        args={[WIN_W + 0.3, WIN_H + 0.3, FRAME_D]}
        radius={0.04}
        smoothness={3}
      >
        <meshStandardMaterial color="#E6DDC8" roughness={0.7} />
      </RoundedBox>
      {/* One continuous beach panorama */}
      <mesh position={[0, 0, 0.062]}>
        <planeGeometry args={[WIN_W, WIN_H]} />
        <meshBasicMaterial map={beach} toneMapped={false} />
      </mesh>
      <AnimatedBeachOverlays width={WIN_W} height={WIN_H} />
      {/* Glass sheen at top */}
      <mesh position={[0, WIN_H * 0.38, 0.064]}>
        <planeGeometry args={[WIN_W, WIN_H * 0.22]} />
        <meshBasicMaterial color="#FFFFFF" transparent opacity={0.08} toneMapped={false} />
      </mesh>
      {[-5.6, 0, 5.6].map((x, i) => (
        <mesh key={`glass-streak-${i}`} rotation={[0, 0, -0.22]} position={[x, 0.4, 0.066]}>
          <planeGeometry args={[2.5, 0.07]} />
          <meshBasicMaterial color="#FFFFFF" transparent opacity={0.1} toneMapped={false} />
        </mesh>
      ))}
      {/* Outer frame sill */}
      <mesh position={[0, -WIN_H / 2 - 0.12, 0.02]}>
        <boxGeometry args={[WIN_W + 0.6, 0.16, 0.25]} />
        <meshStandardMaterial color="#D7C8A8" roughness={0.8} />
      </mesh>
      {/* Warm daylight spilling into the room, distributed along the window */}
      {lightCenters.map((x, i) => (
        <pointLight
          key={`L-${i}`}
          position={[x, 0, 2.2]}
          intensity={0.4}
          color="#F5EBD4"
          distance={9}
          decay={2}
        />
      ))}
    </group>
  );
}

function AnimatedBeachOverlays({ width, height }: { width: number; height: number }) {
  const wavesRef = useRef<THREE.Group>(null);
  const birdsRef = useRef<THREE.Group>(null);
  const foamRef = useRef<THREE.Group>(null);
  const waves = useMemo(
    () =>
      Array.from({ length: 26 }).map((_, i) => ({
        x: -width / 2 + 0.45 + (i % 13) * 1.34,
        y: -0.18 - Math.floor(i / 13) * 0.18 - (i % 3) * 0.018,
        w: 0.55 + (i % 4) * 0.16,
        phase: i * 0.77,
        speed: 0.8 + (i % 5) * 0.08,
        opacity: 0.2 + (i % 4) * 0.035,
      })),
    [width]
  );
  const foam = useMemo(
    () =>
      Array.from({ length: 9 }).map((_, i) => ({
        x: -width / 2 + 0.8 + i * 2.0,
        y: -height * 0.28 - (i % 2) * 0.035,
        w: 1.35 + (i % 3) * 0.35,
        phase: i * 0.9,
      })),
    [height, width]
  );
  const birds = useMemo(
    () => [
      { x: -7.2, y: 0.52, speed: 0.42, scale: 0.9, phase: 0 },
      { x: -3.2, y: 0.74, speed: 0.3, scale: 0.68, phase: 1.7 },
      { x: 2.4, y: 0.62, speed: 0.36, scale: 0.78, phase: 3.1 },
    ],
    []
  );

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    wavesRef.current?.children.forEach((child, i) => {
      const wave = waves[i];
      const mesh = child as THREE.Mesh;
      mesh.position.x = wave.x + Math.sin(t * wave.speed + wave.phase) * 0.22;
      mesh.position.y = wave.y + Math.sin(t * 1.7 + wave.phase) * 0.012;
      const mat = mesh.material as THREE.MeshBasicMaterial;
      mat.opacity = wave.opacity + Math.sin(t * 1.5 + wave.phase) * 0.045;
    });
    foamRef.current?.children.forEach((child, i) => {
      const strip = foam[i];
      child.position.x = strip.x + Math.sin(t * 0.9 + strip.phase) * 0.18;
      child.position.y = strip.y + Math.sin(t * 1.25 + strip.phase) * 0.018;
    });
    birdsRef.current?.children.forEach((child, i) => {
      const bird = birds[i];
      const x = ((bird.x + t * bird.speed + width / 2) % width) - width / 2;
      child.position.x = x;
      child.position.y = bird.y + Math.sin(t * 2.1 + bird.phase) * 0.035;
      child.rotation.z = Math.sin(t * 7 + bird.phase) * 0.12;
      child.children.forEach((wing, wingI) => {
        wing.rotation.z = (wingI === 0 ? 0.48 : -0.48) + Math.sin(t * 9 + bird.phase) * (wingI === 0 ? 0.2 : -0.2);
      });
    });
  });

  return (
    <group position={[0, 0, 0.072]}>
      <group ref={wavesRef}>
        {waves.map((wave, i) => (
          <mesh key={`wave-${i}`} position={[wave.x, wave.y, 0.002]}>
            <planeGeometry args={[wave.w, 0.018]} />
            <meshBasicMaterial color="#EAF8FF" transparent opacity={wave.opacity} toneMapped={false} />
          </mesh>
        ))}
      </group>
      <group ref={foamRef}>
        {foam.map((strip, i) => (
          <mesh key={`foam-${i}`} position={[strip.x, strip.y, 0.006]} rotation={[0, 0, Math.sin(i) * 0.025]}>
            <planeGeometry args={[strip.w, 0.034]} />
            <meshBasicMaterial color="#FFFFFF" transparent opacity={0.32} toneMapped={false} />
          </mesh>
        ))}
      </group>
      <BeachPalm position={[-6.9, -0.98, 0.014]} scale={0.95} sway={0.9} />
      <BeachPalm position={[2.3, -1.02, 0.018]} scale={1.08} sway={1.15} />
      <BeachPalm position={[6.3, -0.98, 0.016]} scale={0.82} sway={0.78} flip />
      <group ref={birdsRef}>
        {birds.map((bird, i) => (
          <group key={`bird-${i}`} position={[bird.x, bird.y, 0.02]} scale={bird.scale}>
            <mesh position={[-0.04, 0, 0]} rotation={[0, 0, 0.48]}>
              <boxGeometry args={[0.12, 0.012, 0.004]} />
              <meshBasicMaterial color="#34414C" transparent opacity={0.72} />
            </mesh>
            <mesh position={[0.04, 0, 0]} rotation={[0, 0, -0.48]}>
              <boxGeometry args={[0.12, 0.012, 0.004]} />
              <meshBasicMaterial color="#34414C" transparent opacity={0.72} />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  );
}

function BeachPalm({
  position,
  scale,
  sway,
  flip = false,
}: {
  position: [number, number, number];
  scale: number;
  sway: number;
  flip?: boolean;
}) {
  const frondsRef = useRef<THREE.Group>(null);
  const sign = flip ? -1 : 1;
  const fronds = useMemo(
    () => [
      { angle: 2.75, len: 0.72, color: "#245F32" },
      { angle: 2.35, len: 0.58, color: "#2C6B3B" },
      { angle: 1.92, len: 0.5, color: "#347545" },
      { angle: 0.75, len: 0.64, color: "#245F32" },
      { angle: 0.35, len: 0.74, color: "#2D6D3A" },
      { angle: -0.12, len: 0.55, color: "#1F512C" },
      { angle: -0.62, len: 0.5, color: "#2C6B3B" },
    ],
    []
  );

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    frondsRef.current?.children.forEach((child, i) => {
      const base = fronds[i].angle * sign;
      child.rotation.z = base + Math.sin(t * (1.1 + i * 0.08) + i) * 0.075 * sway;
    });
  });

  return (
    <group position={position} scale={[scale * sign, scale, scale]}>
      <mesh position={[0, 0.46, 0]} rotation={[0, 0, -0.12 * sign]}>
        <planeGeometry args={[0.06, 0.92]} />
        <meshBasicMaterial color="#4B3424" transparent opacity={0.9} />
      </mesh>
      <group ref={frondsRef} position={[0.08 * sign, 0.92, 0.01]}>
        {fronds.map((frond, i) => (
          <group key={`frond-${i}`} rotation={[0, 0, frond.angle * sign]}>
            <mesh position={[frond.len / 2, 0, 0]}>
              <planeGeometry args={[frond.len, 0.055]} />
              <meshBasicMaterial color={frond.color} transparent opacity={0.9} side={THREE.DoubleSide} />
            </mesh>
          </group>
        ))}
      </group>
      <mesh position={[0.08 * sign, 0.89, 0.018]}>
        <circleGeometry args={[0.055, 12]} />
        <meshBasicMaterial color="#3A2A1C" transparent opacity={0.9} />
      </mesh>
    </group>
  );
}

/**
 * Exposed wooden beams across the high ceiling.
 */
function CeilingBeams() {
  return (
    <group>
      {[-6, -2, 2, 6].map((x, i) => (
        <mesh key={i} position={[x, 7.18, -1]}>
          <boxGeometry args={[0.22, 0.22, 8]} />
          <meshStandardMaterial color="#BCA686" roughness={0.8} />
        </mesh>
      ))}
    </group>
  );
}

/**
 * Slow-turning ceiling fan — subtle ambient motion, reinforces airy space.
 */
function CeilingFan({ position }: { position: [number, number, number] }) {
  const bladesRef = useRef<THREE.Group>(null);
  useFrame((_, delta) => {
    if (!bladesRef.current) return;
    bladesRef.current.rotation.y -= delta * 0.8;
  });
  return (
    <group position={position}>
      {/* Rod */}
      <mesh position={[0, 0.08, 0]}>
        <cylinderGeometry args={[0.025, 0.025, 0.3, 10]} />
        <meshStandardMaterial color="#2E2820" roughness={0.5} metalness={0.3} />
      </mesh>
      {/* Motor housing */}
      <mesh position={[0, -0.1, 0]}>
        <cylinderGeometry args={[0.12, 0.14, 0.1, 16]} />
        <meshStandardMaterial color="#4E4334" roughness={0.55} metalness={0.35} />
      </mesh>
      {/* Blades */}
      <group ref={bladesRef} position={[0, -0.12, 0]}>
        {[0, 1, 2, 3].map((i) => (
          <group key={i} rotation={[0, (i * Math.PI) / 2, 0]}>
            <mesh rotation={[0, 0, -0.08]} position={[0.5, 0, 0]}>
              <boxGeometry args={[0.96, 0.014, 0.15]} />
              <meshStandardMaterial color="#A99578" roughness={0.8} />
            </mesh>
          </group>
        ))}
      </group>
      {/* Stationary cap keeps the spinning blade assembly visually centered */}
      <mesh position={[0, -0.12, 0]}>
        <cylinderGeometry args={[0.16, 0.16, 0.045, 18]} />
        <meshStandardMaterial color="#3B332A" roughness={0.55} metalness={0.3} />
      </mesh>
      {/* Light bulb under motor */}
      <mesh position={[0, -0.2, 0]}>
        <sphereGeometry args={[0.07, 14, 14]} />
        <meshStandardMaterial
          color="#FFF5D8"
          emissive="#FFE7B0"
          emissiveIntensity={0.65}
          roughness={0.3}
        />
      </mesh>
      <pointLight position={[0, -0.3, 0]} intensity={0.4} color="#FFE7B0" distance={6} decay={2} />
    </group>
  );
}
