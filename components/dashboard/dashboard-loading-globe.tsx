"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { motion, useReducedMotion } from "motion/react";
import * as THREE from "three";
import { cx } from "@/components/design-system";
import { useTheme, type RecruitTheme } from "@/components/theme-provider";
import worldLandOutline from "@/data/geo/world-land-outline.json";

export type DashboardLoadingPhase = "loading" | "scoring" | "ranking";

type DashboardLoadingGlobeProps = {
  phase?: DashboardLoadingPhase;
  size?: "compact" | "hero";
  className?: string;
};

type WorldLandOutline = {
  rings: number[][][];
};

const PHRASES = {
  loading: ["loading jobs...", "checking company maps...", "normalizing roles..."],
  scoring: ["scoring jobs...", "reading fit signals...", "ranking matches..."],
  ranking: ["sorting shortlist...", "placing top roles...", "settling the board..."],
} satisfies Record<DashboardLoadingPhase, string[]>;

const COMPANY_POINTS = [
  { label: "Google", lat: 37.422, lon: -122.084 },
  { label: "Apple", lat: 37.3349, lon: -122.009 },
  { label: "OpenAI", lat: 37.7749, lon: -122.4194 },
  { label: "Anthropic", lat: 37.7898, lon: -122.3942 },
  { label: "Microsoft", lat: 47.6426, lon: -122.1312 },
  { label: "Amazon", lat: 47.6062, lon: -122.3321 },
  { label: "Meta", lat: 37.4848, lon: -122.1484 },
  { label: "Stripe", lat: 37.779, lon: -122.3908 },
  { label: "DeepMind", lat: 51.5072, lon: -0.1276 },
  { label: "Samsung", lat: 37.5665, lon: 126.978 },
] as const;

const GLOBE_THEME = {
  light: {
    star: "#486454",
    starOpacity: 0.12,
    sphere: "#DCE9D8",
    sphereOpacity: 0.52,
    wire: "#4D7657",
    wireOpacity: 0.11,
    outline: "#2F5E3B",
    outlineOpacity: 0.38,
    point: "#B9832E",
    haloOpacity: 0.12,
  },
  dark: {
    star: "#F7FFF8",
    starOpacity: 0.38,
    sphere: "#163023",
    sphereOpacity: 0.38,
    wire: "#9FD3AC",
    wireOpacity: 0.14,
    outline: "#BDEFC5",
    outlineOpacity: 0.32,
    point: "#F4C26B",
    haloOpacity: 0.16,
  },
} satisfies Record<RecruitTheme, {
  star: string;
  starOpacity: number;
  sphere: string;
  sphereOpacity: number;
  wire: string;
  wireOpacity: number;
  outline: string;
  outlineOpacity: number;
  point: string;
  haloOpacity: number;
}>;

export function DashboardLoadingGlobe({
  phase = "loading",
  size = "compact",
  className,
}: DashboardLoadingGlobeProps) {
  const reduceMotion = useReducedMotion();
  const { theme } = useTheme();
  const text = useTypewriter(PHRASES[phase], Boolean(reduceMotion));
  const hero = size === "hero";
  const palette = GLOBE_THEME[theme];

  return (
    <motion.section
      initial={reduceMotion ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
      transition={{ duration: 0.72, ease: [0.22, 1, 0.36, 1] }}
      className={cx(
        "relative overflow-hidden rounded-[24px] border border-[var(--dashboard-panel-border)] bg-[var(--dashboard-panel-bg)] text-[var(--dashboard-panel-fg)] shadow-[var(--dashboard-panel-shadow)] backdrop-blur-2xl",
        hero ? "px-5 py-5 md:px-7 md:py-7" : "px-4 py-4",
        className,
      )}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(159,211,172,0.08),transparent_44%),linear-gradient(90deg,transparent,rgba(142,126,168,0.035),transparent)]" />
      <div
        className={cx(
          "relative grid items-center gap-4",
          hero ? "md:grid-cols-[minmax(240px,0.78fr)_minmax(0,1fr)] md:gap-8" : "md:grid-cols-[180px_minmax(0,1fr)]",
        )}
      >
        <div className={cx("relative", hero ? "h-[260px] md:h-[340px] lg:h-[390px]" : "h-[164px] md:h-[180px]")}>
          <motion.div
            aria-hidden="true"
            className="absolute inset-[8%] rounded-full opacity-80 blur-2xl"
            style={{
              background:
                "radial-gradient(circle at 48% 46%, rgba(159,211,172,0.34), rgba(159,211,172,0.16) 32%, rgba(244,194,107,0.09) 52%, transparent 72%)",
            }}
            animate={reduceMotion ? undefined : {
              opacity: [0.42, 0.72, 0.48],
              scale: [0.92, 1.04, 0.94],
            }}
            transition={reduceMotion ? undefined : {
              duration: 8.5,
              ease: "easeInOut",
              repeat: Infinity,
            }}
          />
          <Canvas
            camera={{ position: [0, 0, 4.1], fov: 38 }}
            gl={{ alpha: true, antialias: true, preserveDrawingBuffer: true }}
            dpr={[1, 1.7]}
            aria-hidden="true"
          >
            <GlobeScene palette={palette} reduceMotion={Boolean(reduceMotion)} />
          </Canvas>
        </div>
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--dashboard-panel-kicker)]">
            Recruit atlas
          </div>
          <div
            className={cx(
              "mt-2 min-h-[2.4rem] font-mono font-semibold tracking-normal text-[var(--dashboard-panel-fg)]",
              hero ? "text-4xl md:text-5xl" : "text-2xl md:text-3xl",
            )}
          >
            {text}
            <span className="ml-1 inline-block animate-pulse text-[var(--color-accent)]">|</span>
          </div>
          <p className={cx("mt-2 max-w-xl leading-6 text-[var(--dashboard-panel-muted)]", hero ? "text-base" : "text-sm")}>
            Mapping big-company hubs, pulling role signals, and scoring the board before it settles into rank order.
          </p>
        </div>
      </div>
    </motion.section>
  );
}

function GlobeScene({
  palette,
  reduceMotion,
}: {
  palette: (typeof GLOBE_THEME)[RecruitTheme];
  reduceMotion: boolean;
}) {
  const group = useRef<THREE.Group>(null);
  const starPositions = useMemo(() => buildStarPositions(), []);
  const outlinePositions = useMemo(() => buildLandOutlinePositions(), []);

  useFrame((_, delta) => {
    if (!group.current || reduceMotion) return;
    group.current.rotation.y += delta * 0.055;
    group.current.rotation.x = 0.42 + Math.sin(Date.now() / 12000) * 0.028;
    group.current.rotation.z = -0.18 + Math.sin(Date.now() / 15000) * 0.018;
  });

  return (
    <>
      <ambientLight intensity={1.1} />
      <points>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[starPositions, 3]}
          />
        </bufferGeometry>
        <pointsMaterial size={0.014} color={palette.star} transparent opacity={palette.starOpacity} />
      </points>
      <group ref={group} rotation={[0.42, -0.55, -0.18]}>
        <mesh>
          <sphereGeometry args={[1.18, 64, 64]} />
          <meshBasicMaterial
            color={palette.sphere}
            transparent
            opacity={palette.sphereOpacity}
            depthWrite={false}
          />
        </mesh>
        <mesh>
          <sphereGeometry args={[1.192, 32, 18]} />
          <meshBasicMaterial color={palette.wire} wireframe transparent opacity={palette.wireOpacity} />
        </mesh>
        <lineSegments>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              args={[outlinePositions, 3]}
            />
          </bufferGeometry>
          <lineBasicMaterial color={palette.outline} transparent opacity={palette.outlineOpacity} />
        </lineSegments>
        {COMPANY_POINTS.map((point, index) => (
          <CompanyStar key={point.label} palette={palette} point={point} index={index} />
        ))}
      </group>
    </>
  );
}

function CompanyStar({
  palette,
  point,
  index,
}: {
  palette: (typeof GLOBE_THEME)[RecruitTheme];
  point: { lat: number; lon: number; label: string };
  index: number;
}) {
  const coreRef = useRef<THREE.Mesh>(null);
  const coreMaterialRef = useRef<THREE.MeshStandardMaterial>(null);
  const haloRef = useRef<THREE.Mesh>(null);
  const haloMaterialRef = useRef<THREE.MeshBasicMaterial>(null);
  const position = useMemo(() => latLonToVector(point.lat, point.lon, 1.25), [point.lat, point.lon]);

  useFrame(({ clock }) => {
    const intro = smoothStep(Math.min(1, Math.max(0, (clock.elapsedTime - index * 0.3) / 2.4)));
    const pulse = (Math.sin(clock.elapsedTime * 0.72 + index * 0.7) + 1) / 2;
    const coreScale = intro * (0.92 + pulse * 0.16);
    const haloScale = intro * (1.04 + pulse * 0.32);

    coreRef.current?.scale.setScalar(coreScale);
    haloRef.current?.scale.setScalar(haloScale);
    if (coreMaterialRef.current) {
      coreMaterialRef.current.opacity = intro * (0.66 + pulse * 0.2);
      coreMaterialRef.current.emissiveIntensity = intro * (0.42 + pulse * 0.58);
    }
    if (haloMaterialRef.current) {
      haloMaterialRef.current.opacity = intro * (0.06 + pulse * palette.haloOpacity);
    }
  });

  return (
    <group position={position}>
      <mesh ref={haloRef}>
        <sphereGeometry args={[0.078 + (index % 3) * 0.01, 18, 18]} />
        <meshBasicMaterial
          ref={haloMaterialRef}
          color={palette.point}
          transparent
          opacity={0}
          depthWrite={false}
        />
      </mesh>
      <mesh ref={coreRef}>
        <sphereGeometry args={[0.034 + (index % 3) * 0.006, 14, 14]} />
        <meshStandardMaterial
          ref={coreMaterialRef}
          color={palette.point}
          emissive={palette.point}
          emissiveIntensity={0}
          transparent
          opacity={0}
        />
      </mesh>
    </group>
  );
}

function latLonToVector(lat: number, lon: number, radius: number) {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  );
}

function buildStarPositions() {
  const positions: number[] = [];
  for (let index = 0; index < 130; index += 1) {
    const seed = Math.sin(index * 91.7) * 10000;
    const a = seed - Math.floor(seed);
    const b = Math.sin(index * 41.3) * 10000;
    const c = b - Math.floor(b);
    positions.push((a - 0.5) * 5.5, (c - 0.5) * 3.4, -1.8 - ((index * 13) % 80) / 80);
  }
  return new Float32Array(positions);
}

function buildLandOutlinePositions() {
  const payload = worldLandOutline as WorldLandOutline;
  const positions: number[] = [];

  for (const ring of payload.rings) {
    for (let index = 1; index < ring.length; index += 1) {
      const previous = ring[index - 1];
      const current = ring[index];
      if (!previous || !current) continue;
      const previousLon = previous[0];
      const previousLat = previous[1];
      const currentLon = current[0];
      const currentLat = current[1];
      if (
        typeof previousLon !== "number" ||
        typeof previousLat !== "number" ||
        typeof currentLon !== "number" ||
        typeof currentLat !== "number"
      ) {
        continue;
      }
      if (Math.abs(previousLon - currentLon) > 100) continue;

      const from = latLonToVector(previousLat, previousLon, 1.212);
      const to = latLonToVector(currentLat, currentLon, 1.212);
      positions.push(from.x, from.y, from.z, to.x, to.y, to.z);
    }
  }

  return new Float32Array(positions);
}

function smoothStep(value: number) {
  return value * value * (3 - 2 * value);
}

function useTypewriter(phrases: string[], reduceMotion: boolean) {
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [length, setLength] = useState(reduceMotion ? phrases[0].length : 0);
  const phrase = phrases[phraseIndex] ?? phrases[0];

  useEffect(() => {
    if (reduceMotion) {
      const id = window.setInterval(() => {
        setPhraseIndex((current) => (current + 1) % phrases.length);
      }, 2800);
      return () => window.clearInterval(id);
    }

    let nextLength = 0;
    let nextPhrase = phraseIndex;
    const id = window.setInterval(() => {
      nextLength += 1;
      if (nextLength > phrases[nextPhrase].length + 14) {
        nextPhrase = (nextPhrase + 1) % phrases.length;
        nextLength = 0;
        setPhraseIndex(nextPhrase);
      }
      setLength(Math.min(nextLength, phrases[nextPhrase].length));
    }, 135);

    return () => window.clearInterval(id);
  }, [phraseIndex, phrases, reduceMotion]);

  if (reduceMotion) return phrase;
  return phrase.slice(0, length);
}
