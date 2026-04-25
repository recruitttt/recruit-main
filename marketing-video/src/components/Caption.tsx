import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { theme } from "../theme";

type Props = {
  text: string;
  emphasis?: boolean;
};

export const Caption: React.FC<Props> = ({ text, emphasis = false }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const enter = spring({
    frame,
    fps,
    config: { damping: 14, mass: 0.7, stiffness: 110 },
  });

  const exitStart = durationInFrames - 18;
  const exit =
    frame > exitStart
      ? interpolate(frame, [exitStart, durationInFrames], [1, 0], {
          extrapolateRight: "clamp",
        })
      : 1;

  const opacity = enter * exit;
  const translateY = interpolate(enter, [0, 1], [24, 0]);

  const words = text.split(" ");

  return (
    <AbsoluteFill
      style={{
        justifyContent: "flex-end",
        alignItems: "center",
        paddingBottom: emphasis ? "44%" : 110,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          opacity,
          transform: `translateY(${translateY}px)`,
          fontFamily: emphasis ? theme.fontDisplay : theme.fontUi,
          fontWeight: emphasis ? 500 : 600,
          fontSize: emphasis ? 184 : 56,
          letterSpacing: emphasis ? "-0.04em" : "-0.02em",
          color: theme.ink,
          textAlign: "center",
          padding: emphasis ? 0 : "18px 36px",
          background: emphasis ? "transparent" : "rgba(251, 248, 242, 0.78)",
          backdropFilter: emphasis ? undefined : "blur(8px)",
          borderRadius: emphasis ? 0 : 18,
          border: emphasis ? "none" : `1px solid ${theme.outline}`,
          boxShadow: emphasis
            ? "none"
            : "0 12px 30px -12px rgba(34,32,28,0.25)",
          display: "flex",
          gap: emphasis ? 0 : 12,
        }}
      >
        {emphasis ? (
          <span>{text}</span>
        ) : (
          words.map((word, i) => {
            const wordEnter = spring({
              frame: frame - i * 3,
              fps,
              config: { damping: 16, stiffness: 130 },
            });
            return (
              <span
                key={i}
                style={{
                  opacity: wordEnter,
                  transform: `translateY(${interpolate(
                    wordEnter,
                    [0, 1],
                    [16, 0]
                  )}px)`,
                  display: "inline-block",
                }}
              >
                {word}
              </span>
            );
          })
        )}
      </div>
    </AbsoluteFill>
  );
};
