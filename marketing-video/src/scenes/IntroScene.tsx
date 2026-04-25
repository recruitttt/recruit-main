import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { theme } from "../theme";

export const IntroScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const logoEnter = spring({
    frame,
    fps,
    config: { damping: 18, mass: 0.8, stiffness: 90 },
  });

  const ringScale = interpolate(frame, [0, 60], [0.6, 1.05], {
    extrapolateRight: "clamp",
  });
  const ringOpacity = interpolate(frame, [0, 30, 75, 90], [0, 0.4, 0.4, 0]);
  const fadeOut = interpolate(frame, [70, 90], [1, 0], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        opacity: fadeOut,
      }}
    >
      <div
        style={{
          position: "absolute",
          width: 520,
          height: 520,
          borderRadius: "50%",
          border: `2px solid ${theme.accentSoft}`,
          opacity: ringOpacity,
          transform: `scale(${ringScale})`,
        }}
      />
      <div
        style={{
          position: "absolute",
          width: 380,
          height: 380,
          borderRadius: "50%",
          border: `1.5px solid ${theme.accent}`,
          opacity: ringOpacity * 0.6,
          transform: `scale(${ringScale * 0.92})`,
        }}
      />

      <div
        style={{
          opacity: logoEnter,
          transform: `scale(${interpolate(logoEnter, [0, 1], [0.85, 1])})`,
          display: "flex",
          alignItems: "center",
          gap: 22,
        }}
      >
        <Mark />
        <div
          style={{
            fontFamily: theme.fontDisplay,
            fontWeight: 500,
            fontSize: 132,
            color: theme.ink,
            letterSpacing: "-0.04em",
          }}
        >
          Recruit
        </div>
      </div>
    </AbsoluteFill>
  );
};

const Mark: React.FC = () => (
  <svg width="120" height="120" viewBox="0 0 120 120">
    <circle cx="60" cy="60" r="56" fill={theme.accent} />
    <path
      d="M40 78 L40 42 L62 42 Q78 42 78 56 Q78 66 68 70 L82 86 L70 86 L58 70 L52 70 L52 86 Z M52 50 L52 62 L62 62 Q68 62 68 56 Q68 50 62 50 Z"
      fill={theme.white}
    />
  </svg>
);
