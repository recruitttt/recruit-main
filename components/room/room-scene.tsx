"use client";

import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import {
  Environment,
  ContactShadows,
  AdaptiveDpr,
  PerformanceMonitor,
} from "@react-three/drei";
import * as THREE from "three";
import { RoomLighting } from "./room-lighting";
import { RoomFloor } from "./room-floor";
import { RoomStations } from "./room-stations";
import { RoomAgents } from "./room-agents";
import { RoomCamera } from "./room-camera";
import { RoomFurniture } from "./room-furniture";

export default function RoomScene() {
  return (
    <Canvas
      shadows={false}
      dpr={[1, 2]}
      gl={{
        antialias: true,
        toneMapping: THREE.ACESFilmicToneMapping,
        outputColorSpace: THREE.SRGBColorSpace,
      }}
      camera={{ position: [0, 6.8, 12.4], fov: 46, near: 0.1, far: 80 }}
      style={{
        width: "100%",
        height: "100%",
        background:
          "radial-gradient(ellipse at 50% 30%, #FBF9F4 0%, #F2EEE5 55%, #E8E3D6 100%)",
      }}
    >
      <PerformanceMonitor flipflops={3} />
      <AdaptiveDpr pixelated={false} />

      <Suspense fallback={null}>
        <Environment preset="apartment" environmentIntensity={0.35} />
      </Suspense>

      <RoomLighting />
      <RoomFloor />
      <RoomFurniture />
      <RoomStations />
      <RoomAgents />
      <ContactShadows
        position={[0, 0.004, -0.4]}
        opacity={0.38}
        scale={28}
        blur={2.8}
        far={5.5}
        resolution={1024}
        color="#2B2620"
      />
      <RoomCamera />
    </Canvas>
  );
}
