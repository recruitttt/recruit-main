import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { theme } from "../theme";

export const OutroScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const enter = spring({ frame, fps, config: { damping: 20, stiffness: 70 } });
  const counterValue = Math.min(
    47,
    Math.floor(interpolate(frame, [0, 50], [0, 47], { extrapolateRight: "clamp" }))
  );

  const counterScale = spring({
    frame,
    fps,
    config: { damping: 16, stiffness: 100 },
  });

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        opacity: enter,
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 18,
          transform: `scale(${counterScale})`,
        }}
      >
        <div
          style={{
            fontFamily: theme.fontDisplay,
            fontSize: 320,
            fontWeight: 500,
            letterSpacing: "-0.05em",
            color: theme.ink,
            lineHeight: 1,
          }}
        >
          {counterValue}
        </div>
        <div
          style={{
            fontFamily: theme.fontUi,
            fontSize: 28,
            color: theme.inkSoft,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            fontWeight: 500,
          }}
        >
          applications today
        </div>
      </div>
    </AbsoluteFill>
  );
};
