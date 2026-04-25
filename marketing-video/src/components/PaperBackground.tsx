import { AbsoluteFill, useCurrentFrame } from "remotion";
import { theme } from "../theme";

export const PaperBackground: React.FC = () => {
  const frame = useCurrentFrame();
  const drift = Math.sin(frame / 90) * 6;

  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(circle at ${50 + drift}% ${
          40 - drift
        }%, ${theme.paper} 0%, ${theme.paperDeep} 70%, ${theme.paperShadow} 100%)`,
      }}
    >
      <svg
        width="100%"
        height="100%"
        style={{ position: "absolute", inset: 0, opacity: 0.18, mixBlendMode: "multiply" }}
      >
        <filter id="paper-noise">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.85"
            numOctaves="2"
            stitchTiles="stitch"
          />
          <feColorMatrix values="0 0 0 0 0.13  0 0 0 0 0.12  0 0 0 0 0.10  0 0 0 0.55 0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#paper-noise)" />
      </svg>
    </AbsoluteFill>
  );
};
