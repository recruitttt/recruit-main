import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { BrowserFrame } from "../components/BrowserFrame";
import { Cursor } from "../components/Cursor";
import { theme } from "../theme";

const URL = "ashbyhq.com/openai/jobs/research-engineer";

export const PasteScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const enter = spring({ frame, fps, config: { damping: 20, stiffness: 80 } });
  const exit = interpolate(frame, [105, 120], [1, 0], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
  });

  const typed = Math.min(URL.length, Math.max(0, frame - 38));
  const showButton = frame > URL.length + 42;
  const buttonScale = spring({
    frame: frame - (URL.length + 42),
    fps,
    config: { damping: 18, stiffness: 110 },
  });

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        opacity: enter * exit,
      }}
    >
      <div style={{ position: "relative" }}>
        <BrowserFrame width={1320} height={720}>
          <div
            style={{
              padding: "80px 90px",
              display: "flex",
              flexDirection: "column",
              gap: 36,
              fontFamily: theme.fontUi,
              color: theme.ink,
              height: "100%",
            }}
          >
            <div
              style={{
                fontFamily: theme.fontDisplay,
                fontSize: 56,
                fontWeight: 500,
                letterSpacing: "-0.03em",
              }}
            >
              Add a job
            </div>
            <div style={{ color: theme.inkSoft, fontSize: 22 }}>
              Paste any job posting · we handle the rest
            </div>
            <div
              style={{
                marginTop: 24,
                background: theme.paper,
                border: `1.5px solid ${theme.outline}`,
                borderRadius: 18,
                padding: "26px 30px",
                fontSize: 26,
                fontFamily: theme.fontMono,
                color: theme.ink,
                minHeight: 80,
                display: "flex",
                alignItems: "center",
                position: "relative",
              }}
            >
              <span>{URL.slice(0, typed)}</span>
              <span
                style={{
                  display: "inline-block",
                  width: 2,
                  height: 30,
                  background: theme.accent,
                  marginLeft: 4,
                  opacity: Math.floor(frame / 8) % 2 === 0 ? 1 : 0,
                }}
              />
            </div>
            {showButton && (
              <div
                style={{
                  alignSelf: "flex-start",
                  marginTop: 18,
                  background: theme.ink,
                  color: theme.white,
                  padding: "20px 38px",
                  borderRadius: 14,
                  fontSize: 22,
                  fontWeight: 600,
                  transform: `scale(${buttonScale})`,
                  boxShadow: "0 8px 24px -8px rgba(34,32,28,0.45)",
                }}
              >
                Tailor & apply →
              </div>
            )}
          </div>
        </BrowserFrame>

        <Cursor
          keyframes={[
            { frame: 0, x: 1100, y: 600 },
            { frame: 28, x: 540, y: 360, click: true },
            { frame: 80, x: 540, y: 360 },
            { frame: 100, x: 360, y: 560, click: true },
          ]}
        />
      </div>
    </AbsoluteFill>
  );
};
