import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { BrowserFrame } from "../components/BrowserFrame";
import { theme } from "../theme";

const RESUME_LINES = [
  { label: "Built distributed inference platform serving 40M req/day", delay: 30 },
  { label: "Led 6-engineer ML infra team, cut p95 latency by 38%", delay: 60 },
  { label: "Authored RFC for multi-region failover, adopted org-wide", delay: 90 },
  { label: "Open-source: contributor to vLLM and Ray Serve", delay: 120 },
];

export const TailorScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const enter = spring({ frame, fps, config: { damping: 22, stiffness: 75 } });
  const exit = interpolate(frame, [135, 150], [1, 0], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        opacity: enter * exit,
      }}
    >
      <BrowserFrame width={1320} height={760}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1.4fr",
            height: "100%",
            fontFamily: theme.fontUi,
          }}
        >
          <AgentPanel frame={frame} fps={fps} />
          <ResumePreview frame={frame} fps={fps} />
        </div>
      </BrowserFrame>
    </AbsoluteFill>
  );
};

const AgentPanel: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => {
  const pulse = 0.6 + Math.sin(frame / 8) * 0.4;
  return (
    <div
      style={{
        background: theme.paper,
        padding: "60px 50px",
        borderRight: `1px solid ${theme.outline}`,
        display: "flex",
        flexDirection: "column",
        gap: 26,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: "50%",
            background: theme.accent,
            opacity: pulse,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: theme.white,
            fontFamily: theme.fontDisplay,
            fontSize: 26,
            fontWeight: 600,
          }}
        >
          ✦
        </div>
        <div
          style={{
            fontSize: 22,
            fontWeight: 600,
            color: theme.ink,
          }}
        >
          Agent · tailoring
        </div>
      </div>

      <Step label="Reading job description" doneAt={20} frame={frame} fps={fps} />
      <Step label="Scoring keywords" doneAt={45} frame={frame} fps={fps} />
      <Step label="Matching your projects" doneAt={75} frame={frame} fps={fps} />
      <Step label="Rewriting bullets" doneAt={105} frame={frame} fps={fps} />
      <Step label="Generating cover letter" doneAt={130} frame={frame} fps={fps} />
    </div>
  );
};

const Step: React.FC<{
  label: string;
  doneAt: number;
  frame: number;
  fps: number;
}> = ({ label, doneAt, frame, fps }) => {
  const startAt = doneAt - 12;
  const isDone = frame >= doneAt;
  const isActive = frame >= startAt && frame < doneAt;
  const enter = spring({
    frame: frame - startAt,
    fps,
    config: { damping: 20, stiffness: 120 },
  });

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        opacity: frame >= startAt - 2 ? enter : 0.25,
        transform: `translateX(${interpolate(enter, [0, 1], [-8, 0])}px)`,
      }}
    >
      <div
        style={{
          width: 22,
          height: 22,
          borderRadius: "50%",
          background: isDone ? theme.green : isActive ? theme.accent : theme.paperShadow,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: theme.white,
          fontSize: 12,
          fontWeight: 700,
          boxShadow: isActive
            ? `0 0 0 6px ${theme.accentSoft}55`
            : "none",
        }}
      >
        {isDone ? "✓" : ""}
      </div>
      <div
        style={{
          fontSize: 18,
          color: isDone ? theme.ink : theme.inkSoft,
          fontWeight: isActive ? 600 : 500,
        }}
      >
        {label}
      </div>
    </div>
  );
};

const ResumePreview: React.FC<{ frame: number; fps: number }> = ({
  frame,
  fps,
}) => {
  return (
    <div
      style={{
        background: theme.white,
        padding: "60px 70px",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          fontFamily: theme.fontDisplay,
          fontSize: 38,
          fontWeight: 500,
          letterSpacing: "-0.03em",
          color: theme.ink,
        }}
      >
        Mo Hoshir
      </div>
      <div
        style={{
          fontSize: 16,
          color: theme.inkSoft,
          marginTop: 6,
          marginBottom: 28,
          fontFamily: theme.fontUi,
        }}
      >
        Senior Engineer · ML infra · San Francisco
      </div>

      <div
        style={{
          height: 1,
          background: theme.outline,
          marginBottom: 22,
        }}
      />

      <div
        style={{
          fontSize: 14,
          fontWeight: 700,
          color: theme.inkSoft,
          letterSpacing: "0.12em",
          marginBottom: 14,
          fontFamily: theme.fontUi,
        }}
      >
        EXPERIENCE
      </div>

      {RESUME_LINES.map((line, i) => {
        const enter = spring({
          frame: frame - line.delay,
          fps,
          config: { damping: 20, stiffness: 95 },
        });
        const highlight = frame >= line.delay && frame < line.delay + 30;
        return (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 12,
              padding: "10px 12px",
              marginLeft: -12,
              borderRadius: 10,
              background: highlight ? `${theme.accentSoft}40` : "transparent",
              transition: "background 0.2s",
              opacity: enter,
              transform: `translateY(${interpolate(enter, [0, 1], [10, 0])}px)`,
            }}
          >
            <div
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: theme.accent,
                marginTop: 10,
                flexShrink: 0,
              }}
            />
            <div
              style={{
                fontFamily: theme.fontUi,
                fontSize: 17,
                color: theme.ink,
                lineHeight: 1.45,
              }}
            >
              {line.label}
            </div>
          </div>
        );
      })}

      {frame > 130 && (
        <div
          style={{
            position: "absolute",
            top: 60,
            right: 70,
            background: theme.green,
            color: theme.white,
            padding: "8px 16px",
            borderRadius: 999,
            fontSize: 13,
            fontWeight: 600,
            fontFamily: theme.fontUi,
            transform: `scale(${spring({
              frame: frame - 130,
              fps,
              config: { damping: 14, stiffness: 140 },
            })})`,
          }}
        >
          ATS-tailored
        </div>
      )}
    </div>
  );
};
