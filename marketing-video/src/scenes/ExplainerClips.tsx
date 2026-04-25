import {
  AbsoluteFill,
  Sequence,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { BrowserFrame } from "../components/BrowserFrame";
import { Caption } from "../components/Caption";
import { Cursor } from "../components/Cursor";
import { PaperBackground } from "../components/PaperBackground";
import { theme } from "../theme";

type Tone = "accent" | "success" | "warning";

const jobs = [
  ["Linear", "Design Engineer", "Ready", "94"],
  ["Vercel", "Frontend Engineer", "Ranked", "91"],
  ["Anthropic", "Product Engineer", "Researching", "88"],
];

const steps = [
  ["Read job context", 24],
  ["Map proof points", 56],
  ["Rewrite resume bullets", 88],
  ["Generate PDF artifact", 124],
  ["Attach ranking evidence", 158],
] as const;

const fields = [
  ["Name", "Mo Hoshir", 24, false],
  ["Email", "mo@recruit.app", 42, false],
  ["LinkedIn", "linkedin.com/in/mo", 60, false],
  ["Experience", "8 years", 78, false],
  ["Work authorization", "Needs approval", 110, true],
  ["Resume", "tailored-pdf.pdf", 154, false],
] as const;

export const DiscoverClip: React.FC = () => (
  <ClipShell caption="Find roles worth applying to.">
    <BrowserFrame width={1380} height={760} url="recruit.app/dashboard/live-run">
      <Layout eyebrow="Scout" title="Scanning boards for high-fit roles" right={<ScoutPanel />}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 18 }}>
          <Metric value="3" label="agents active" />
          <Metric value="14" label="fields mapped" />
          <Metric value="91" label="avg match" />
        </div>
        <JobList />
      </Layout>
    </BrowserFrame>
  </ClipShell>
);

export const TailorClip: React.FC = () => (
  <ClipShell caption="Tailor every artifact to the role.">
    <BrowserFrame width={1380} height={760} url="recruit.app/artifacts/linear">
      <Layout eyebrow="Tailor" title="Turning job context into proof" right={<TailorPanel />}>
        <div style={{ display: "grid", gridTemplateColumns: "0.86fr 1.14fr", gap: 18 }}>
          <StepPanel />
          <ResumeCard />
        </div>
      </Layout>
    </BrowserFrame>
  </ClipShell>
);

export const ApplyClip: React.FC = () => (
  <ClipShell caption="Pause for truth. Submit when approved.">
    <div style={{ position: "relative" }}>
      <BrowserFrame width={1380} height={760} url="recruit.app/applications/linear">
        <Layout eyebrow="Apply" title="Filling forms with approval gates" right={<ApplyPanel />}>
          <ApplicationForm />
        </Layout>
      </BrowserFrame>
      <Cursor
        keyframes={[
          { frame: 0, x: 1120, y: 560 },
          { frame: 118, x: 1080, y: 490, click: true },
          { frame: 190, x: 1064, y: 630 },
          { frame: 228, x: 1118, y: 628, click: true },
        ]}
      />
    </div>
  </ClipShell>
);

const ClipShell: React.FC<{ children: React.ReactNode; caption: string }> = ({
  children,
  caption,
}) => (
  <AbsoluteFill style={{ background: theme.bg }}>
    <PaperBackground />
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
      {children}
    </AbsoluteFill>
    <Sequence from={14} durationInFrames={244}>
      <Caption text={caption} />
    </Sequence>
  </AbsoluteFill>
);

const Layout: React.FC<{
  eyebrow: string;
  title: string;
  right: React.ReactNode;
  children: React.ReactNode;
}> = ({ eyebrow, title, right, children }) => (
  <div
    style={{
      display: "grid",
      gridTemplateColumns: "220px 1fr 330px",
      gap: 1,
      height: "100%",
      background: "rgba(255,255,255,0.46)",
      fontFamily: theme.fontUi,
    }}
  >
    <Sidebar />
    <section style={{ padding: 28, background: "rgba(255,255,255,0.28)" }}>
      <div style={{ color: theme.textMuted, fontFamily: theme.fontMono, fontSize: 12, fontWeight: 800, letterSpacing: "0.18em", textTransform: "uppercase" }}>
        {eyebrow}
      </div>
      <h1 style={{ color: theme.text, fontSize: 35, letterSpacing: "-0.03em", lineHeight: 1.03, margin: "10px 0 0" }}>
        {title}
      </h1>
      <div style={{ marginTop: 24 }}>{children}</div>
    </section>
    <aside style={{ padding: 24, background: "rgba(255,255,255,0.42)" }}>{right}</aside>
  </div>
);

const Sidebar: React.FC = () => (
  <aside style={{ padding: 18, background: "rgba(255,255,255,0.40)" }}>
    <div style={glass({ padding: 12, borderRadius: 20, display: "flex", gap: 10, alignItems: "center" })}>
      <LogoMark />
      <div>
        <div style={{ color: theme.text, fontSize: 14, fontWeight: 800 }}>Recruit</div>
        <div style={{ color: theme.textSubtle, fontSize: 12 }}>command center</div>
      </div>
    </div>
    <div style={{ marginTop: 28, display: "grid", gap: 10 }}>
      {["Dashboard", "Applications", "Artifacts", "Approvals"].map((item, index) => (
        <div
          key={item}
          style={{
            ...glass({ padding: "13px 14px", borderRadius: 18, background: index === 0 ? "rgba(255,255,255,0.78)" : "transparent", boxShadow: index === 0 ? "inset 0 1px 0 rgba(255,255,255,0.95)" : "none" }),
            color: index === 0 ? theme.text : theme.textMuted,
            fontSize: 14,
            fontWeight: index === 0 ? 800 : 600,
          }}
        >
          {item}
        </div>
      ))}
    </div>
  </aside>
);

const JobList: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <div style={{ ...glass({ marginTop: 18, padding: 0, borderRadius: 26 }), overflow: "hidden" }}>
      <Header left="Ranked opportunities" right="syncing" />
      {jobs.map(([company, role, state, score], i) => {
        const enter = spring({ frame: frame - 24 - i * 28, fps, config: { damping: 18, stiffness: 120 } });
        return (
          <div key={company} style={{ display: "grid", gridTemplateColumns: "1fr 130px 72px", gap: 14, alignItems: "center", padding: "18px 20px", borderBottom: i === jobs.length - 1 ? "none" : `1px solid ${theme.border}`, opacity: enter, transform: `translateY(${interpolate(enter, [0, 1], [18, 0])}px)` }}>
            <div>
              <div style={{ color: theme.text, fontWeight: 800, fontSize: 17 }}>{company}</div>
              <div style={{ color: theme.textMuted, fontSize: 13, marginTop: 4 }}>{role}</div>
            </div>
            <Pill>{state}</Pill>
            <div style={{ color: theme.text, fontFamily: theme.fontMono, fontSize: 24 }}>{score}</div>
          </div>
        );
      })}
    </div>
  );
};

const ScoutPanel: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <>
      <DarkPanel title="Scout" tag="active">
        {["I found three strong roles.", "Linear is ready after one approval.", "Artifacts are queued for tailoring."].map((line, i) => (
          <div key={line} style={{ opacity: frame > 34 + i * 34 ? 1 : 0.22, color: "rgba(255,255,255,0.88)", fontSize: 16, lineHeight: 1.45 }}>
            {line}
          </div>
        ))}
      </DarkPanel>
      <MiniArtifact title="Human gate" detail="Work authorization answer needed" tone="warning" />
      <MiniArtifact title="Resume queued" detail="PDF generation ready" />
    </>
  );
};

const StepPanel: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <div style={glass({ padding: 22, borderRadius: 26, height: 442 })}>
      <div style={{ color: theme.text, fontSize: 17, fontWeight: 800 }}>Agent plan</div>
      <div style={{ display: "grid", gap: 18, marginTop: 24 }}>
        {steps.map(([label, at]) => {
          const done = frame >= at;
          const active = frame >= at - 22 && !done;
          return (
            <div key={label} style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ width: 25, height: 25, borderRadius: "50%", display: "grid", placeItems: "center", background: done ? theme.success : active ? theme.accent : "rgba(100,116,139,0.18)", color: theme.white, fontWeight: 900, boxShadow: active ? `0 0 0 8px ${theme.accentSoft}` : "none" }}>
                {done ? "✓" : ""}
              </div>
              <div style={{ color: done || active ? theme.text : theme.textMuted, fontWeight: done || active ? 800 : 600, fontSize: 17 }}>
                {label}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const ResumeCard: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const bullets = [
    "Built distributed inference platform serving 40M requests/day",
    "Led ML infra team and reduced p95 latency by 38%",
    "Authored multi-region failover plan adopted org-wide",
  ];
  return (
    <div style={glass({ padding: 30, borderRadius: 26, height: 442, background: "rgba(255,255,255,0.76)" })}>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <div>
          <div style={{ color: theme.text, fontFamily: theme.fontDisplay, fontSize: 39 }}>Mo Hoshir</div>
          <div style={{ color: theme.textMuted, fontSize: 14, marginTop: 4 }}>Senior Engineer · ML infra</div>
        </div>
        {frame > 164 ? <Pill tone="success">ATS 94</Pill> : null}
      </div>
      <div style={{ height: 1, background: "rgba(15,23,42,0.09)", margin: "24px 0 18px" }} />
      <div style={{ color: theme.textMuted, fontFamily: theme.fontMono, fontSize: 12, fontWeight: 800, letterSpacing: "0.16em" }}>EXPERIENCE</div>
      <div style={{ display: "grid", gap: 12, marginTop: 18 }}>
        {bullets.map((bullet, i) => {
          const enter = spring({ frame: frame - 58 - i * 35, fps, config: { damping: 18, stiffness: 105 } });
          return (
            <div key={bullet} style={{ display: "flex", gap: 12, padding: "12px 14px", borderRadius: 16, background: frame > 62 + i * 35 && frame < 108 + i * 35 ? theme.accentSoft : "transparent", opacity: enter, transform: `translateY(${interpolate(enter, [0, 1], [16, 0])}px)` }}>
              <span style={{ width: 7, height: 7, marginTop: 9, borderRadius: "50%", background: theme.accent }} />
              <span style={{ color: theme.text, fontSize: 16, lineHeight: 1.45 }}>{bullet}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const TailorPanel: React.FC = () => (
  <>
    <DarkPanel title="Tailor score" tag="ready">
      <div style={{ color: theme.white, fontFamily: theme.fontMono, fontSize: 82, lineHeight: 1 }}>94</div>
      <div style={{ color: "rgba(255,255,255,0.76)", fontSize: 15 }}>Keyword coverage up 31%</div>
    </DarkPanel>
    <MiniArtifact title="PDF ready" detail="Resume tailored for Linear" />
    <MiniArtifact title="Cover note" detail="Drafted from company research" />
  </>
);

const ApplicationForm: React.FC = () => {
  const frame = useCurrentFrame();
  const submitted = frame > 226;
  return (
    <div style={{ position: "relative" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, filter: submitted ? "blur(2px) brightness(0.98)" : "none" }}>
        {fields.map(([label, value, at, gate]) => {
          const filled = frame >= at;
          return (
            <div key={label}>
              <div style={{ color: theme.textMuted, fontSize: 13, fontWeight: 700, marginBottom: 7 }}>{label}</div>
              <div style={{ ...glass({ padding: "15px 16px", borderRadius: 17, background: filled ? "rgba(255,255,255,0.72)" : "rgba(255,255,255,0.32)", border: `1px solid ${gate && filled ? theme.warning : filled ? theme.success : theme.border}`, boxShadow: "inset 0 1px 0 rgba(255,255,255,0.88)" }), color: gate && filled ? "#A16207" : theme.text, minHeight: 22, display: "flex", justifyContent: "space-between", fontSize: 16, fontWeight: 700 }}>
                <span>{filled ? value : ""}</span>
                <span>{filled ? (gate ? "!" : "✓") : ""}</span>
              </div>
            </div>
          );
        })}
      </div>
      {frame > 118 && frame < 206 ? <ApprovalCard /> : null}
      {submitted ? <SubmittedCard /> : null}
    </div>
  );
};

const ApplyPanel: React.FC = () => (
  <>
    <DarkPanel title="Submitter" tag="guarded">
      <div style={{ color: "rgba(255,255,255,0.80)", fontSize: 16, lineHeight: 1.5 }}>
        Recruit fills known answers and stops where your truth is required.
      </div>
    </DarkPanel>
    <MiniArtifact title="Answers cached" detail="12 safe fields reused" />
    <MiniArtifact title="Audit trail" detail="Approval saved with artifact" />
  </>
);

const ApprovalCard: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame: frame - 118, fps, config: { damping: 16, stiffness: 130 } });
  return (
    <div style={{ ...glass({ position: "absolute", right: 28, top: 190, width: 430, padding: 22, borderRadius: 26, background: theme.panelDark, border: "1px solid rgba(255,255,255,0.14)" }), color: theme.white, transform: `scale(${enter})` }}>
      <div style={{ color: "rgba(255,255,255,0.62)", fontSize: 13, fontWeight: 800 }}>HUMAN GATE</div>
      <div style={{ marginTop: 12, fontSize: 18, lineHeight: 1.38 }}>Confirm work authorization before Recruit submits.</div>
      <div style={{ marginTop: 18, display: "flex", gap: 10 }}>
        <Pill dark>approve</Pill>
        <Pill dark>edit answer</Pill>
      </div>
    </div>
  );
};

const SubmittedCard: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame: frame - 226, fps, config: { damping: 13, stiffness: 125 } });
  return (
    <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}>
      <div style={{ ...glass({ padding: "34px 46px", borderRadius: 30, background: "rgba(255,255,255,0.84)" }), display: "flex", alignItems: "center", gap: 20, transform: `scale(${enter})` }}>
        <div style={{ width: 70, height: 70, borderRadius: "50%", background: theme.success, color: theme.white, display: "grid", placeItems: "center", fontSize: 40, fontWeight: 900 }}>✓</div>
        <div>
          <div style={{ color: theme.text, fontSize: 35, fontWeight: 800, letterSpacing: "-0.02em" }}>Submitted</div>
          <div style={{ color: theme.textMuted, fontSize: 16, marginTop: 3 }}>Evidence saved to the run log</div>
        </div>
      </div>
    </div>
  );
};

const Metric: React.FC<{ value: string; label: string }> = ({ value, label }) => (
  <div style={glass({ padding: 18, borderRadius: 22 })}>
    <div style={{ color: theme.text, fontFamily: theme.fontMono, fontSize: 36 }}>{value}</div>
    <div style={{ color: theme.textMuted, fontSize: 13, marginTop: 4 }}>{label}</div>
  </div>
);

const Header: React.FC<{ left: string; right: string }> = ({ left, right }) => (
  <div style={{ display: "flex", justifyContent: "space-between", padding: "17px 20px", borderBottom: `1px solid ${theme.border}`, color: theme.text, fontSize: 15, fontWeight: 800 }}>
    <span>{left}</span>
    <span style={{ color: theme.accentDark, fontSize: 13 }}>{right}</span>
  </div>
);

const DarkPanel: React.FC<{ title: string; tag: string; children: React.ReactNode }> = ({ title, tag, children }) => (
  <div style={glass({ padding: 22, borderRadius: 26, background: theme.panelDark, border: "1px solid rgba(255,255,255,0.12)" })}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
      <div style={{ color: theme.white, fontWeight: 800 }}>{title}</div>
      <Pill dark>{tag}</Pill>
    </div>
    <div style={{ display: "grid", gap: 10 }}>{children}</div>
  </div>
);

const MiniArtifact: React.FC<{ title: string; detail: string; tone?: Tone }> = ({
  title,
  detail,
  tone = "accent",
}) => (
  <div style={glass({ padding: 16, borderRadius: 22, marginTop: 14, display: "flex", gap: 12, alignItems: "center" })}>
    <div style={{ width: 38, height: 38, borderRadius: 15, display: "grid", placeItems: "center", background: tone === "warning" ? theme.warningSoft : theme.accentSoft, color: tone === "warning" ? "#A16207" : theme.accentDark, fontWeight: 900 }}>
      {tone === "warning" ? "!" : "✓"}
    </div>
    <div>
      <div style={{ color: theme.text, fontSize: 14, fontWeight: 800 }}>{title}</div>
      <div style={{ color: theme.textMuted, fontSize: 12, marginTop: 3 }}>{detail}</div>
    </div>
  </div>
);

const Pill: React.FC<{ children: React.ReactNode; dark?: boolean; tone?: Tone }> = ({
  children,
  dark,
  tone = "accent",
}) => (
  <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", borderRadius: 999, border: dark ? "1px solid rgba(255,255,255,0.16)" : `1px solid ${theme.borderStrong}`, background: dark ? "rgba(255,255,255,0.10)" : tone === "success" ? theme.successSoft : "rgba(255,255,255,0.64)", color: dark ? "rgba(255,255,255,0.82)" : tone === "success" ? theme.success : theme.accentDark, fontSize: 12, fontWeight: 800, padding: "6px 11px", textTransform: "uppercase", letterSpacing: "0.08em" }}>
    {children}
  </span>
);

const LogoMark: React.FC = () => (
  <svg width="28" height="28" viewBox="0 0 24 24">
    <rect x="2.75" y="2.75" width="18.5" height="18.5" rx="5.4" fill="none" stroke={theme.accent} strokeWidth="2" opacity="0.82" />
    <path d="M7.25 6.55C7.08 6.14 7.5 5.76 7.9 5.95L17 10.38C17.48 10.61 17.42 11.31 16.9 11.46L13.2 12.5C12.98 12.56 12.8 12.72 12.7 12.93L11.15 16.28C10.92 16.77 10.22 16.75 10.02 16.24L7.25 6.55Z" fill="none" stroke={theme.accent} strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M10.05 9.85L12.7 12.5" fill="none" stroke={theme.accent} strokeWidth="1.45" strokeLinecap="round" strokeLinejoin="round" opacity="0.72" />
  </svg>
);

const glass = (style: React.CSSProperties = {}): React.CSSProperties => ({
  background: theme.surface,
  border: `1px solid ${theme.border}`,
  boxShadow: theme.shadowSoft,
  backdropFilter: "blur(20px)",
  ...style,
});
