"use client";

import { InteractiveHotspot } from "./interactive-hotspot";

import { Suspense, useRef, useMemo } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { RoundedBox, useGLTF } from "@react-three/drei";
import { useBeachTexture } from "./beach-texture";

// CC0 GLB assets from the Kenney Furniture Kit
// (https://kenney.nl/assets/furniture-kit, CC0 1.0). Drop new GLBs into
// `public/models/` and import-then-preload them here. The Draco decoder
// path is forwarded to drei in case future GLBs ship Draco-compressed
// geometry; non-Draco files load fine without it. The decoder files
// live in `public/draco/`, copied once from
// `node_modules/three/examples/jsm/libs/draco/gltf/`.
const PLANT_GLB_URL = "/models/plant.glb";
const LAMP_GLB_URL = "/models/lamp.glb";
const DRACO_DECODER_URL = "/draco/";

useGLTF.preload(PLANT_GLB_URL, DRACO_DECODER_URL);
useGLTF.preload(LAMP_GLB_URL, DRACO_DECODER_URL);

/**
 * Deep-clone a loaded GLB scene so per-instance material edits do not
 * leak back into the cache that drei shares across consumers. The
 * `customize` callback receives a cloned material it can freely mutate
 * (tint, emissive, roughness, etc.) and must return the material to use.
 */
function cloneSceneWithMaterials(
  scene: THREE.Object3D,
  customize: (material: THREE.MeshStandardMaterial) => THREE.MeshStandardMaterial
): THREE.Object3D {
  const root = scene.clone(true);
  root.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) return;
    const src = obj.material;
    if (!src) return;
    const mats = Array.isArray(src) ? src : [src];
    obj.material = mats.map((mat) => {
      if (!(mat instanceof THREE.MeshStandardMaterial)) return mat;
      return customize(mat.clone());
    });
  });
  return root;
}

/**
 * Extra room dressing: sofa + coffee table, rug, TV, back-wall windows,
 * plants, bookshelf, small decorative objects. All primitives, all matte.
 */
export function RoomFurniture() {
  return (
    <group>
      <RugArea />
      <Sofa position={[0, 0, 3.0]} />
      <CoffeeTable position={[0, 0, 4.6]} />
      <WallTV position={[-9.9, 2.1, 1.5]} />
      <Bookshelf position={[9.9, 0, 1.8]} />
      <PlantInPot position={[-8.4, 0, 4.4]} variant="fern" />
      <PlantInPot position={[8.6, 0, 4.6]} variant="palm" />
      <PlantInPot position={[2.4, 0, -4.4]} variant="succulent" />
      <FloorLamp position={[-1.7, 0, 4.2]} />
      <BackWallWindows />
      <CeilingBeams />
      <CeilingFan position={[0, 7.28, 1.6]} />
      <FurnitureHotspots />
    </group>
  );
}

function FurnitureHotspots() {
  return (
    <>
      <InteractiveHotspot
        target={{ kind: "furniture", id: "sofa" }}
        hotspotKey="furniture:sofa"
        size={[3.4, 1.4, 1.6]}
        position={[0, 0.7, 3.0]}
      />
      <InteractiveHotspot
        target={{ kind: "furniture", id: "coffee-table" }}
        hotspotKey="furniture:coffee-table"
        size={[1.6, 0.8, 1.0]}
        position={[0, 0.4, 4.6]}
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

function RugArea() {
  return (
    <group position={[0, 0.008, 3.5]}>
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

function Sofa({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
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

function CoffeeTable({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
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

type PlantVariant = "fern" | "palm" | "succulent";

const PLANT_VARIANTS: Record<
  PlantVariant,
  { scale: number; rotationY: number; tint: string }
> = {
  fern: { scale: 3.4, rotationY: 0, tint: "#5C8F50" },
  palm: { scale: 4.2, rotationY: 1.1, tint: "#3E7A3A" },
  succulent: { scale: 2.6, rotationY: -0.6, tint: "#7AAE6A" },
};

function PlantInPot({
  position,
  variant,
}: {
  position: [number, number, number];
  variant: PlantVariant;
}) {
  return (
    <group position={position}>
      <Suspense fallback={null}>
        <PlantModel variant={variant} />
      </Suspense>
    </group>
  );
}

function PlantModel({ variant }: { variant: PlantVariant }) {
  const { scene } = useGLTF(PLANT_GLB_URL, DRACO_DECODER_URL);
  const cfg = PLANT_VARIANTS[variant];
  const cloned = useMemo(
    () =>
      cloneSceneWithMaterials(scene, (material) => {
        // Bias foliage toward the variant tint while keeping relative brightness.
        const tint = new THREE.Color(cfg.tint);
        material.color = material.color.lerp(tint, 0.55);
        material.roughness = 0.92;
        return material;
      }),
    [scene, cfg.tint]
  );

  return (
    <primitive
      object={cloned}
      scale={cfg.scale}
      rotation={[0, cfg.rotationY, 0]}
    />
  );
}

function FloorLamp({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      {/* Soft spill from the shade — kept as a primitive disc so the
          floor still gets a warm halo regardless of GLB load state. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.006, 0]}>
        <circleGeometry args={[0.82, 36]} />
        <meshBasicMaterial color="#FFE1A8" transparent opacity={0.16} depthWrite={false} />
      </mesh>
      <Suspense fallback={null}>
        <LampModel />
      </Suspense>
      {/* Warm point light positioned above the lamp shade. */}
      <pointLight position={[0, 1.8, 0]} intensity={0.78} distance={4.4} color="#FFD89B" decay={2} />
    </group>
  );
}

function LampModel() {
  const { scene } = useGLTF(LAMP_GLB_URL, DRACO_DECODER_URL);
  const cloned = useMemo(
    () =>
      cloneSceneWithMaterials(scene, (material) => {
        // The Kenney lamp ships flat-shaded. Light-coloured surfaces are
        // the shade — warm them so the lamp reads as glowing rather than
        // plain plastic.
        const isShade = material.color.r > 0.7 && material.color.g > 0.7;
        if (isShade) {
          material.emissive = new THREE.Color("#FFE7B0");
          material.emissiveIntensity = 0.32;
        }
        material.roughness = isShade ? 0.9 : 0.6;
        return material;
      }),
    [scene]
  );

  // Scale to match the prior 1.95m-tall primitive lamp.
  return <primitive object={cloned} scale={2.3} />;
}

function BackWallWindows() {
  const beach = useBeachTexture();
  // One long picture window spanning most of the back wall
  const WIN_W = 17.6;
  const WIN_H = 2.2;
  const FRAME_D = 0.12;
  // 3 vertical muntins split the view into 4 visual panes, 1 horizontal muntin across the middle
  const paneCenters = [-6.6, -2.2, 2.2, 6.6];

  return (
    <group position={[0, 2.55, -5.07]}>
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
      {/* 3 vertical muntins between the 4 panes */}
      {paneCenters.slice(0, -1).map((c, i) => {
        const next = paneCenters[i + 1];
        const x = (c + next) / 2;
        return (
          <mesh key={`v-${i}`} position={[x, 0, 0.065]}>
            <planeGeometry args={[0.06, WIN_H]} />
            <meshStandardMaterial color="#A89475" roughness={0.7} />
          </mesh>
        );
      })}
      {/* Horizontal muntin across the middle */}
      <mesh position={[0, 0, 0.065]}>
        <planeGeometry args={[WIN_W, 0.05]} />
        <meshStandardMaterial color="#A89475" roughness={0.7} />
      </mesh>
      {/* Outer frame sill */}
      <mesh position={[0, -WIN_H / 2 - 0.12, 0.02]}>
        <boxGeometry args={[WIN_W + 0.6, 0.16, 0.25]} />
        <meshStandardMaterial color="#D7C8A8" roughness={0.8} />
      </mesh>
      {/* Warm daylight spilling into the room, distributed along the window */}
      {paneCenters.map((x, i) => (
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
