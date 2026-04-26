"use client";

import { useMemo } from "react";
import * as THREE from "three";
import type { AgentId } from "@/lib/agents";

/**
 * Minimal hero face for the onboarding transition: two small black
 * squares for eyes, nothing else. Simple and readable at small sizes.
 */
const W = 512;
const H = 512;

function buildCuteFace(_agentId: AgentId): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, W, H);

  const eyeSize = 42;
  const eyeY = H * 0.5 - eyeSize / 2;
  ctx.fillStyle = "#0A0A0A";
  ctx.fillRect(W * 0.34 - eyeSize / 2, eyeY, eyeSize, eyeSize);
  ctx.fillRect(W * 0.66 - eyeSize / 2, eyeY, eyeSize, eyeSize);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  return tex;
}

export function useCuteFaceTexture(agentId: AgentId) {
  return useMemo(() => buildCuteFace(agentId), [agentId]);
}
