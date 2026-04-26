"use client";

import { Suspense, useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import {
  AccumulativeShadows,
  AdaptiveDpr,
  Environment,
  PerformanceMonitor,
  RandomizedLight,
} from "@react-three/drei";
import * as THREE from "three";
import { RoomLighting } from "./room-lighting";
import { RoomFloor } from "./room-floor";
import { RoomStations } from "./room-stations";
import { RoomAgents } from "./room-agents";
import { RoomCamera } from "./room-camera";
import { RoomFurniture } from "./room-furniture";
import { IntroRevealGroup, RoomIntroCamera, RoomIntroScout, type RoomIntroPhase } from "./room-intro";
import { ScoutSpeechBubble } from "./scout-speech-bubble";
import { PlayerCharacter } from "./player-character";

export type RoomSceneProps = {
  introPhase?: RoomIntroPhase;
  onReady?: () => void;
};

export default function RoomScene({ introPhase, onReady }: RoomSceneProps) {
  const activeIntroPhase = introPhase && introPhase !== "done" ? introPhase : null;

  useEffect(() => {
    onReady?.();
  }, [onReady]);

  return (
    <Canvas
      shadows="soft"
      frameloop="always"
      dpr={[1, 2]}
      gl={{
        antialias: true,
        toneMapping: THREE.ACESFilmicToneMapping,
        outputColorSpace: THREE.SRGBColorSpace,
      }}
      camera={{ position: [0, 6.8, 12.4], fov: 46, near: 0.1, far: 80 }}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "radial-gradient(ellipse at 50% 30%, #FBF9F4 0%, #F2EEE5 55%, #E8E3D6 100%)",
      }}
    >
      <PerformanceMonitor flipflops={3} />
      <AdaptiveDpr pixelated={false} />
      <Suspense fallback={null}>
        <Environment
          files="/hdri/studio_small_09_2k.hdr"
          environmentIntensity={0.6}
          background={false}
        />
      </Suspense>
      <RoomLighting />
      <IntroRevealGroup phase={introPhase}>
        <RoomFloor />
        <RoomFurniture />
        <RoomStations />
        <RoomAgents hiddenAgentId={activeIntroPhase ? "scout" : null} />
        {activeIntroPhase ? null : <PlayerCharacter />}
        <AccumulativeShadows
          temporal
          frames={100}
          alphaTest={0.85}
          scale={28}
          position={[0, 0.005, -0.4]}
          color="#2B2620"
          opacity={0.7}
        >
          <RandomizedLight
            amount={8}
            radius={4}
            ambient={0.5}
            intensity={1}
            position={[5, 8, -10]}
            bias={0.001}
          />
        </AccumulativeShadows>
      </IntroRevealGroup>
      {activeIntroPhase ? (
        <>
          <RoomIntroScout phase={activeIntroPhase} />
          <RoomIntroCamera phase={activeIntroPhase} />
        </>
      ) : (
        <>
          <RoomCamera />
          <ScoutSpeechBubble />
        </>
      )}
    </Canvas>
  );
}
