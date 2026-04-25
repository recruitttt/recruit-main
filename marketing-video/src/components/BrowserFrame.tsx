import { theme } from "../theme";

type Props = {
  url?: string;
  children: React.ReactNode;
  width?: number;
  height?: number;
  style?: React.CSSProperties;
};

export const BrowserFrame: React.FC<Props> = ({
  url = "recruit.app",
  children,
  width = 1320,
  height = 760,
  style,
}) => {
  return (
    <div
      style={{
        width,
        height,
        background: theme.surface,
        borderRadius: theme.radiusPanel,
        boxShadow: theme.shadow,
        overflow: "hidden",
        border: `1px solid ${theme.borderStrong}`,
        display: "flex",
        flexDirection: "column",
        backdropFilter: "blur(28px)",
        ...style,
      }}
    >
      <div
        style={{
          height: 58,
          background: "rgba(255,255,255,0.54)",
          display: "flex",
          alignItems: "center",
          padding: "0 22px",
          gap: 8,
          borderBottom: `1px solid ${theme.border}`,
        }}
      >
        <Dot color="#E27664" />
        <Dot color="#E2B25A" />
        <Dot color="#7CB179" />
        <div
          style={{
            flex: 1,
            margin: "0 34px",
            height: 34,
            background: "rgba(255,255,255,0.70)",
            borderRadius: 999,
            display: "flex",
            alignItems: "center",
            paddingLeft: 18,
            color: theme.textMuted,
            fontFamily: theme.fontUi,
            fontSize: 13,
            border: `1px solid ${theme.borderStrong}`,
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.92)",
          }}
        >
          <span style={{ marginRight: 8, color: theme.textSubtle }}>secure</span>
          {url}
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            height: 32,
            padding: "0 14px",
            borderRadius: 999,
            background: "rgba(255,255,255,0.64)",
            border: `1px solid ${theme.borderStrong}`,
            color: theme.success,
            fontFamily: theme.fontUi,
            fontSize: 12,
            fontWeight: 700,
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: theme.success,
            }}
          />
          live
        </div>
      </div>
      <div style={{ flex: 1, overflow: "hidden", position: "relative" }}>
        {children}
      </div>
    </div>
  );
};

const Dot: React.FC<{ color: string }> = ({ color }) => (
  <div
    style={{
      width: 12,
      height: 12,
      borderRadius: "50%",
      background: color,
    }}
  />
);
