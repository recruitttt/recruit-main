"use client";

import { Suspense, useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import { ContactShadows, AdaptiveDpr, Environment, PerformanceMonitor } from "@react-three/drei";
import * as THREE from "three";
import { RoomLighting } from "./room-lighting";
import { RoomFloor } from "./room-floor";
import { RoomStations } from "./room-stations";
import { RoomAgents } from "./room-agents";
import { RoomCamera } from "./room-camera";
import { RoomFurniture } from "./room-furniture";
import { RoomRecruiters } from "./room-recruiters";
import { DeskHub } from "./desk-hub";
import { ApplicationTerminal } from "./application-terminal";
import { PersonalizationCompanion } from "./personalization-companion";
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
        <Environment preset="apartment" background={false} environmentIntensity={0.55} />
      </Suspense>
      <RoomLighting />
      <IntroRevealGroup phase={introPhase}>
        <RoomFloor />
        <RoomFurniture />
        <RoomStations />
        <RoomAgents hiddenAgentId={activeIntroPhase ? "scout" : null} />
        {/* Phase C will plumb the real signed-in userId through this prop. */}
        <RoomRecruiters userId={null} />
        {/* Phase C will plumb the real signed-in userId through DeskHub too. */}
        <DeskHub userId={null} />
        {/* Phase C will plumb the real signed-in userId through ApplicationTerminal too. */}
        <ApplicationTerminal userId={null} />
        <PersonalizationCompanion />
        {activeIntroPhase ? null : <PlayerCharacter />}
        <ContactShadows
          position={[0, 0.004, -0.4]}
          opacity={0.38}
          scale={28}
          blur={2.8}
          far={5.5}
          resolution={1024}
          color="#2B2620"
        />
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
