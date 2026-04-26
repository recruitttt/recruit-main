"use client";

import { useEffect, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { AgentFigure, useAgentRefs } from "./agent-figure";
import { useCuteFaceTexture } from "./cute-face-texture";
import type { TransitionPhase } from "./scene-transition";

type Props = { phase: TransitionPhase };

export default function TransitionCanvas({ phase }: Props) {
  return (
    <Canvas
      dpr={[1, 2]}
      camera={{ position: [0, 1.35, 3.2], fov: 34 }}
      gl={{
        antialias: true,
        alpha: true,
        toneMapping: THREE.ACESFilmicToneMapping,
        outputColorSpace: THREE.SRGBColorSpace,
      }}
      style={{ width: "100%", height: "100%", background: "transparent" }}
    >
      <ambientLight intensity={0.6} color="#FBF4E5" />
      <hemisphereLight args={["#FFF2D8", "#C9D4DC", 0.3]} position={[0, 6, 0]} />
      <directionalLight position={[3.5, 5, 3]} intensity={1.3} color="#FFE9C2" />
      <directionalLight position={[-4, 4, -2]} intensity={0.28} color="#B8CFE4" />
      <TransitionScout phase={phase} />
    </Canvas>
  );
}

function TransitionScout({ phase }: Props) {
  const { camera } = useThree();
  const refs = useAgentRefs();
  const cuteFace = useCuteFaceTexture("scout");
  const phaseStartRef = useRef<{ phase: TransitionPhase; at: number }>({
    phase,
    at: performance.now(),
  });

  useEffect(() => {
    phaseStartRef.current = { phase, at: performance.now() };
  }, [phase]);

  useFrame(({ clock }) => {
    const group = refs.group.current;
    const body = refs.body.current;
    const armR = refs.armR.current;
    const armL = refs.armL.current;
    const wristR = refs.wristR.current;
    const wristL = refs.wristL.current;
    const head = refs.head.current;
    const legL = refs.legL.current;
    const legR = refs.legR.current;
    if (!group || !body || !armR || !armL || !wristR || !wristL || !head || !legL || !legR) return;

    const now = performance.now();
    const p = phaseStartRef.current.phase;
    const t = (now - phaseStartRef.current.at) / 1000;
    const ct = clock.elapsedTime;

    // Reset camera to default framing outside the exit phase.
    if (p !== "exit" && p !== "done") {
      camera.position.set(0, 1.35, 3.2);
      camera.lookAt(0, -0.2, 0);
    }

    if (p === "enter") {
      // FLIES UP into the chat from below — she rises from off-screen.
      const e = Math.min(1, t / 0.9);
      const ease = 1 - Math.pow(1 - e, 2.5);
      group.position.x = 0;
      group.position.y = -1.9 + ease * 1.9 + Math.sin(ease * Math.PI) * 0.18;
      group.position.z = 0;
      group.rotation.set(0, 0, 0);
      group.scale.setScalar(0.8 + ease * 0.2);

      // Arms resting + slightly bouncy
      armR.rotation.set(Math.sin(t * 3) * 0.05, 0, 0);
      armL.rotation.set(Math.sin(t * 3 + Math.PI) * 0.05, 0, 0);
      wristR.rotation.set(0, 0, 0);
      wristL.rotation.set(0, 0, 0);
      // Gentle idle body breath
      body.position.y = 0.47 + Math.sin(ct * 2) * 0.02;
      body.scale.setScalar(1);
      body.rotation.set(0, 0, 0);
      head.rotation.set(0, 0, 0);
      legL.rotation.set(0, 0, 0);
      legR.rotation.set(0, 0, 0);
    } else if (p === "wave") {
      // Settle + raise the right arm UP BY THE SIDE OF THE BODY (not forward).
      group.position.set(0, 0, 0);
      group.rotation.set(0, 0, 0);
      group.scale.setScalar(1);

      // Rotate around Z axis so the arm stays in the body's XY plane. It never
      // passes through a forward-pointing pose. rotation.z = π is straight up;
      // 0.82π leans the arm slightly outward for a readable silhouette.
      const shoulderBase = Math.PI * 0.82;
      // Swing the entire arm side-to-side for the wave motion.
      const swing = Math.sin(t * 7.5) * 0.2;
      const lambda = 10;
      armR.rotation.x = THREE.MathUtils.damp(armR.rotation.x, 0, lambda, 1 / 60);
      armR.rotation.y = 0;
      armR.rotation.z = THREE.MathUtils.damp(
        armR.rotation.z,
        shoulderBase + swing,
        lambda,
        1 / 60
      );

      // A tiny wrist counter-rotation so the hand doesn't feel rigidly attached.
      wristR.rotation.z = Math.sin(t * 7.5 + 0.6) * 0.18;
      wristR.rotation.x = 0;
      wristR.rotation.y = 0;

      // Left arm stays relaxed, slight sway.
      armL.rotation.x = THREE.MathUtils.damp(armL.rotation.x, Math.sin(t * 2) * 0.04, 5, 1 / 60);
      armL.rotation.z = THREE.MathUtils.damp(armL.rotation.z, 0, 5, 1 / 60);
      wristL.rotation.set(0, 0, 0);

      // Head tilts slightly toward the waving hand + little nod.
      head.rotation.y = THREE.MathUtils.damp(head.rotation.y, 0.18, 4, 1 / 60);
      head.rotation.z = THREE.MathUtils.damp(head.rotation.z, 0.08, 4, 1 / 60);
      head.rotation.x = Math.sin(t * 2.4) * 0.03;

      // Body gently shifts weight.
      body.position.y = 0.47 + Math.abs(Math.sin(t * 4)) * 0.025;
      body.rotation.z = Math.sin(t * 2) * 0.02;
      body.scale.setScalar(1);
      legL.rotation.set(0, 0, 0);
      legR.rotation.set(0, 0, 0);
    } else if (p === "exit") {
      // Scout gets dropped DOWN, and the camera pans DOWN with her into the Room.
      const e = Math.min(1, t / 1.1);
      const g = e * e;
      // Scout falls with gentle gravity + forward tilt.
      group.position.x = Math.sin(e * 1.6) * 0.08;
      group.position.y = -g * 3.2;
      group.position.z = e * 0.4;
      group.rotation.x = e * Math.PI * 0.12;
      group.rotation.z = Math.sin(e * 2.2) * 0.14;
      group.rotation.y = 0;
      group.scale.setScalar(1);

      // Camera descends with her, tilting down so we "pan into" the room floor.
      camera.position.y = 1.35 - g * 1.9;
      camera.position.z = 3.2 - g * 0.3;
      camera.lookAt(0, -0.2 - g * 2.4, 0);

      // Arm lowers back to the side as Scout drops.
      armR.rotation.x = THREE.MathUtils.damp(armR.rotation.x, 0, 5, 1 / 60);
      armR.rotation.z = THREE.MathUtils.damp(armR.rotation.z, 0, 5, 1 / 60);
      wristR.rotation.z = THREE.MathUtils.damp(wristR.rotation.z, 0, 5, 1 / 60);
      armL.rotation.x = THREE.MathUtils.damp(armL.rotation.x, 0, 5, 1 / 60);
      armL.rotation.z = THREE.MathUtils.damp(armL.rotation.z, 0, 5, 1 / 60);
      head.rotation.z = Math.sin(t * 4) * 0.05;
    } else {
      // done — offscreen
      group.position.y = -12;
      group.scale.setScalar(0);
    }
  });

  return (
    <group position={[0, -0.7, 0]}>
      <AgentFigure
        agentId="scout"
        refs={refs}
        faceTextureOverride={cuteFace}
      />
    </group>
  );
}
