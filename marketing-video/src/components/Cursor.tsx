import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { theme } from "../theme";

type Keyframe = { frame: number; x: number; y: number; click?: boolean };

type Props = {
  keyframes: Keyframe[];
  visible?: boolean;
};

export const Cursor: React.FC<Props> = ({ keyframes, visible = true }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  let x = keyframes[0].x;
  let y = keyframes[0].y;
  let clickPulse = 0;

  for (let i = 0; i < keyframes.length - 1; i++) {
    const a = keyframes[i];
    const b = keyframes[i + 1];
    if (frame >= a.frame && frame <= b.frame) {
      const t = spring({
        frame: frame - a.frame,
        fps,
        config: { damping: 20, mass: 0.6, stiffness: 90 },
        durationInFrames: b.frame - a.frame,
      });
      x = interpolate(t, [0, 1], [a.x, b.x]);
      y = interpolate(t, [0, 1], [a.y, b.y]);
    } else if (frame > b.frame) {
      x = b.x;
      y = b.y;
    }
  }

  const clickFrames = keyframes.filter((k) => k.click);
  for (const k of clickFrames) {
    const delta = frame - k.frame;
    if (delta >= 0 && delta < 18) {
      clickPulse = Math.max(clickPulse, 1 - delta / 18);
    }
  }

  if (!visible) return null;

  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: 0,
        height: 0,
        pointerEvents: "none",
        zIndex: 50,
      }}
    >
      <div
        style={{
          position: "absolute",
          left: -28,
          top: -28,
          width: 56,
          height: 56,
          borderRadius: "50%",
          border: `3px solid ${theme.accent}`,
          opacity: clickPulse * 0.7,
          transform: `scale(${1 + (1 - clickPulse) * 1.4})`,
        }}
      />
      <svg
        width="28"
        height="32"
        viewBox="0 0 28 32"
        style={{
          filter: "drop-shadow(0 4px 6px rgba(34,32,28,0.35))",
          transform: `scale(${1 - clickPulse * 0.18})`,
          transformOrigin: "top left",
        }}
      >
        <path
          d="M2 2 L2 24 L8 19 L12 28 L16 26 L12 17 L20 17 Z"
          fill={theme.ink}
          stroke={theme.white}
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
};
