import { AbsoluteFill, useCurrentFrame } from "remotion";
import { theme } from "../theme";

export const PaperBackground: React.FC = () => {
  const frame = useCurrentFrame();
  const driftA = Math.sin(frame / 78) * 44;
  const driftB = Math.cos(frame / 96) * 36;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: theme.bg,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "linear-gradient(to right, rgba(15,23,42,0.045) 1px, transparent 1px), linear-gradient(to bottom, rgba(15,23,42,0.045) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
          opacity: 0.34,
          maskImage:
            "radial-gradient(ellipse 80% 62% at 50% 32%, black 0%, transparent 78%)",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(to bottom, rgba(255,255,255,0.42), rgba(255,255,255,0.12) 42%, rgba(205,213,223,0))",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 160 + driftA,
          top: 170 - driftB,
          width: 520,
          height: 520,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(255,255,255,0.40), transparent 62%)",
          filter: "blur(42px)",
        }}
      />
      <div
        style={{
          position: "absolute",
          right: 110 - driftB,
          bottom: 90 + driftA * 0.3,
          width: 560,
          height: 560,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(14,165,233,0.18), transparent 64%)",
          filter: "blur(48px)",
        }}
      />
      <svg
        width="100%"
        height="100%"
        style={{ position: "absolute", inset: 0, opacity: 0.05 }}
      >
        <filter id="mist-noise">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.72"
            numOctaves="2"
            stitchTiles="stitch"
          />
          <feColorMatrix values="0 0 0 0 0.06  0 0 0 0 0.09  0 0 0 0 0.13  0 0 0 0.45 0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#mist-noise)" />
      </svg>
    </AbsoluteFill>
  );
};
