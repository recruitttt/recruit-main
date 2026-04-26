"use client";

import {
  Bloom,
  EffectComposer,
  N8AO,
  SMAA,
  ToneMapping,
  Vignette,
} from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";

export default function RoomPostprocessing() {
  return (
    <EffectComposer multisampling={0}>
      <N8AO halfRes aoRadius={0.6} distanceFalloff={0.4} intensity={2} />
      <Bloom
        mipmapBlur
        luminanceThreshold={0.95}
        intensity={0.4}
        radius={0.7}
      />
      <SMAA />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      <Vignette offset={0.3} darkness={0.5} eskil={false} />
    </EffectComposer>
  );
}
