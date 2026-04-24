"use client";

import { useEffect, useState } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as THREE from "three";
import { AgentCharacter } from "@/components/onboarding/characters";
import type { AgentId } from "@/lib/agents";

const TEXTURE_SIZE = 512;

/**
 * Rasterize the AgentCharacter SVG to a THREE.CanvasTexture.
 * Re-bakes only when `id` or `awake` changes. 5 agents × 2 states = 10 textures max across a session.
 * Cached per agent-id+awake combo inside the hook.
 */
export function useAgentFaceTexture(id: AgentId, awake: boolean) {
  const [texture, setTexture] = useState<THREE.CanvasTexture | null>(null);

  useEffect(() => {
    let cancelled = false;
    const svg = renderToStaticMarkup(
      <AgentCharacter id={id} awake={awake} size={TEXTURE_SIZE} />
    );
    const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    const img = new Image();
    img.decoding = "sync";
    img.onload = () => {
      if (cancelled) {
        URL.revokeObjectURL(url);
        return;
      }
      const canvas = document.createElement("canvas");
      canvas.width = TEXTURE_SIZE;
      canvas.height = TEXTURE_SIZE;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(url);
        return;
      }
      ctx.clearRect(0, 0, TEXTURE_SIZE, TEXTURE_SIZE);
      ctx.drawImage(img, 0, 0, TEXTURE_SIZE, TEXTURE_SIZE);

      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 8;
      tex.magFilter = THREE.LinearFilter;
      tex.minFilter = THREE.LinearMipmapLinearFilter;
      tex.generateMipmaps = true;
      tex.needsUpdate = true;
      setTexture(tex);
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
    };
    img.src = url;

    return () => {
      cancelled = true;
    };
  }, [id, awake]);

  return texture;
}
