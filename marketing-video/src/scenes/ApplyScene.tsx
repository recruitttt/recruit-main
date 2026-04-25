import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { BrowserFrame } from "../components/BrowserFrame";
import { theme } from "../theme";

const FIELDS = [
  { label: "First name", value: "Mo", fillAt: 14 },
  { label: "Last name", value: "Hoshir", fillAt: 24 },
  { label: "Email", value: "mohoshirmo@gmail.com", fillAt: 34 },
  { label: "LinkedIn", value: "linkedin.com/in/mohoshir", fillAt: 46 },
  { label: "Years of experience", value: "8", fillAt: 56 },
  { label: "Authorized to work in US?", value: "Yes", fillAt: 66 },
];

export const ApplyScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const enter = spring({ frame, fps, config: { damping: 20, stiffness: 80 } });
  const exit = interpolate(frame, [108, 120], [1, 0], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
  });

  const submittedAt = 82;
  const showSubmitted = frame >= submittedAt;
  const submittedScale = spring({
    frame: frame - submittedAt,
    fps,
    config: { damping: 12, stiffness: 130, mass: 0.8 },
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
        <BrowserFrame
          width={1320}
          height={760}
          url="ashbyhq.com/openai/jobs/research-engineer/apply"
        >
          <div
            style={{
              padding: "50px 70px",
              fontFamily: theme.fontUi,
              height: "100%",
              display: "flex",
              flexDirection: "column",
              gap: 18,
              filter: showSubmitted ? "blur(2px) brightness(0.96)" : "none",
              transition: "filter 0.3s",
            }}
          >
            <div
              style={{
                fontFamily: theme.fontDisplay,
                fontSize: 38,
                fontWeight: 500,
                letterSpacing: "-0.03em",
                color: theme.ink,
                marginBottom: 10,
              }}
            >
              Application · Research Engineer
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 20,
              }}
            >
              {FIELDS.map((field, i) => {
                const filled = frame >= field.fillAt;
                const enter = spring({
                  frame: frame - field.fillAt,
                  fps,
                  config: { damping: 18, stiffness: 130 },
                });
                return (
                  <div key={i}>
                    <div
                      style={{
                        fontSize: 13,
                        color: theme.inkSoft,
                        marginBottom: 6,
                        fontWeight: 500,
                      }}
                    >
                      {field.label}
                    </div>
                    <div
                      style={{
                        background: filled ? theme.paper : theme.white,
                        border: `1.5px solid ${
                          filled ? theme.green : theme.outline
                        }`,
                        borderRadius: 10,
                        padding: "14px 16px",
                        fontSize: 17,
                        color: theme.ink,
                        minHeight: 26,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        transition: "border-color 0.2s",
                      }}
                    >
                      <span
                        style={{
                          opacity: enter,
                          transform: `translateX(${interpolate(
                            enter,
                            [0, 1],
                            [-6, 0]
                          )}px)`,
                        }}
                      >
                        {filled ? field.value : ""}
                      </span>
                      {filled && (
                        <span
                          style={{
                            color: theme.green,
                            fontSize: 16,
                            opacity: enter,
                          }}
                        >
                          ✓
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </BrowserFrame>

        {showSubmitted && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              pointerEvents: "none",
            }}
          >
            <div
              style={{
                background: theme.white,
                padding: "44px 64px",
                borderRadius: 24,
                boxShadow: "0 30px 60px -20px rgba(34,32,28,0.4)",
                display: "flex",
                alignItems: "center",
                gap: 22,
                transform: `scale(${submittedScale})`,
                border: `1px solid ${theme.outline}`,
              }}
            >
              <div
                style={{
                  width: 76,
                  height: 76,
                  borderRadius: "50%",
                  background: theme.green,
                  color: theme.white,
                  fontSize: 44,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 700,
                }}
              >
                ✓
              </div>
              <div>
                <div
                  style={{
                    fontFamily: theme.fontDisplay,
                    fontSize: 40,
                    fontWeight: 500,
                    letterSpacing: "-0.02em",
                    color: theme.ink,
                  }}
                >
                  Submitted
                </div>
                <div
                  style={{
                    fontSize: 17,
                    color: theme.inkSoft,
                    fontFamily: theme.fontUi,
                    marginTop: 2,
                  }}
                >
                  Application sent in 14 seconds
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};
