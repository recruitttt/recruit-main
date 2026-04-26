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
        background: theme.white,
        borderRadius: 22,
        boxShadow:
          "0 30px 80px -20px rgba(34,32,28,0.35), 0 8px 22px -8px rgba(34,32,28,0.18)",
        overflow: "hidden",
        border: `1px solid ${theme.outline}`,
        display: "flex",
        flexDirection: "column",
        ...style,
      }}
    >
      <div
        style={{
          height: 44,
          background: theme.paperDeep,
          display: "flex",
          alignItems: "center",
          padding: "0 18px",
          gap: 8,
          borderBottom: `1px solid ${theme.outline}`,
        }}
      >
        <Dot color="#E27664" />
        <Dot color="#E2B25A" />
        <Dot color="#7CB179" />
        <div
          style={{
            flex: 1,
            margin: "0 24px",
            height: 26,
            background: theme.white,
            borderRadius: 8,
            display: "flex",
            alignItems: "center",
            paddingLeft: 14,
            color: theme.inkSoft,
            fontFamily: theme.fontUi,
            fontSize: 13,
            border: `1px solid ${theme.outline}`,
          }}
        >
          <span style={{ marginRight: 8 }}>🔒</span>
          {url}
        </div>
        <div style={{ width: 60 }} />
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
