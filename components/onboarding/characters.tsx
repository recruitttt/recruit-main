import { AGENTS, type AgentId } from "@/lib/agents";
import { rgba, cn } from "@/lib/utils";

/**
 * Five custom SVG characters. Shared design language (round body, dot eyes,
 * one distinguishing feature each) but per-agent hue + facial expression
 * for personality:
 *   Scout  — cyan     · antenna + pulse, curious smile
 *   Mimi   — pink     · hair tufts, closed happy eyes, blush, tiny tongue
 *   Pip    — violet   · one big cyclops eye, serious flat mouth
 *   Juno   — amber    · pointy ears, alert eyes, surprised "o" mouth
 *   Bodhi  — emerald  · wider body, zen closed eyes, calm smile, sparkle
 */

type Props = {
  id: AgentId;
  awake: boolean;
  size?: number;
  className?: string;
};

export function AgentCharacter({ id, awake, size = 48, className }: Props) {
  const { hue } = AGENTS[id];
  // warm stone grey for dormant state on light paper
  const DIM = "rgba(139,137,128,0.65)";
  const body = awake ? rgba(hue, 0.12) : "rgba(15,15,18,0.025)";
  const stroke = awake ? rgba(hue, 0.9) : DIM;
  const accent = awake ? rgba(hue, 1) : DIM;
  const dark = awake ? "#1a1a1f" : "rgba(139,137,128,0.75)";

  return (
    <svg
      viewBox="0 0 48 48"
      width={size}
      height={size}
      className={cn("transition-opacity duration-500", awake ? "opacity-100" : "opacity-75", className)}
      aria-hidden
    >
      {id === "scout" && <Scout awake={awake} hue={hue} body={body} stroke={stroke} accent={accent} dark={dark} />}
      {id === "mimi" && <Mimi awake={awake} hue={hue} body={body} stroke={stroke} accent={accent} dark={dark} />}
      {id === "pip" && <Pip awake={awake} hue={hue} body={body} stroke={stroke} accent={accent} dark={dark} />}
      {id === "juno" && <Juno awake={awake} hue={hue} body={body} stroke={stroke} accent={accent} dark={dark} />}
      {id === "bodhi" && <Bodhi awake={awake} hue={hue} body={body} stroke={stroke} accent={accent} dark={dark} />}
    </svg>
  );
}

type Parts = {
  awake: boolean;
  hue: string;
  body: string;
  stroke: string;
  accent: string;
  dark: string;
};

// ─── Scout: the curious leader ───────────────────────────────
function Scout({ awake, hue, body, stroke, accent, dark }: Parts) {
  return (
    <>
      {/* antenna */}
      <line x1="24" y1="14" x2="24" y2="10" stroke={accent} strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="24" cy="8" r="1.8" fill={accent} />
      {awake && (
        <circle cx="24" cy="8" r="3" fill="none" stroke={rgba(hue, 0.4)}>
          <animate attributeName="r" from="1.8" to="5.5" dur="1.8s" repeatCount="indefinite" />
          <animate attributeName="opacity" from="0.6" to="0" dur="1.8s" repeatCount="indefinite" />
        </circle>
      )}

      <ellipse cx="24" cy="28" rx="14" ry="14" fill={body} stroke={stroke} strokeWidth="1.4" />

      {/* wide curious eyes */}
      <circle cx="19.5" cy="26" r="1.7" fill={dark} />
      <circle cx="28.5" cy="26" r="1.7" fill={dark} />
      {awake && (
        <>
          <circle cx="20.1" cy="25.4" r="0.55" fill="#f4f4f5" />
          <circle cx="29.1" cy="25.4" r="0.55" fill="#f4f4f5" />
        </>
      )}

      {/* open curved smile */}
      {awake && (
        <path
          d="M20.5 31 Q24 33.8 27.5 31"
          stroke={dark}
          strokeWidth="1.3"
          strokeLinecap="round"
          fill="none"
        />
      )}
    </>
  );
}

// ─── Mimi: the sweet one ─────────────────────────────────────
function Mimi({ awake, hue, body, stroke, accent, dark }: Parts) {
  return (
    <>
      {/* hair tufts */}
      <path d="M18.5 16 Q21 10 23 16" stroke={accent} strokeWidth="1.5" strokeLinecap="round" fill="none" />
      <path d="M25 16 Q27 10 29.5 16" stroke={accent} strokeWidth="1.5" strokeLinecap="round" fill="none" />

      <ellipse cx="24" cy="28" rx="14" ry="14" fill={body} stroke={stroke} strokeWidth="1.4" />

      {/* closed happy eyes */}
      {awake ? (
        <>
          <path d="M17.5 26 Q20 28.5 22.5 26" stroke={dark} strokeWidth="1.4" strokeLinecap="round" fill="none" />
          <path d="M25.5 26 Q28 28.5 30.5 26" stroke={dark} strokeWidth="1.4" strokeLinecap="round" fill="none" />

          {/* blush */}
          <ellipse cx="17.5" cy="30.5" rx="1.5" ry="1" fill={rgba(hue, 0.45)} />
          <ellipse cx="30.5" cy="30.5" rx="1.5" ry="1" fill={rgba(hue, 0.45)} />

          {/* tiny "w" mouth */}
          <path d="M22.5 32 Q23.5 33 24 32.5 Q24.5 33 25.5 32" stroke={dark} strokeWidth="1.1" strokeLinecap="round" fill="none" />
        </>
      ) : (
        <>
          <circle cx="20" cy="27" r="1.2" fill={dark} />
          <circle cx="28" cy="27" r="1.2" fill={dark} />
        </>
      )}
    </>
  );
}

// ─── Pip: the silent observer ────────────────────────────────
function Pip({ awake, hue, body, stroke, accent, dark }: Parts) {
  return (
    <>
      <ellipse cx="24" cy="28" rx="14" ry="14" fill={body} stroke={stroke} strokeWidth="1.4" />

      {/* big eye */}
      <circle
        cx="24"
        cy="27"
        r={awake ? 5.2 : 4}
        fill={awake ? "#FFFFFF" : "rgba(139,137,128,0.25)"}
        stroke={awake ? "rgba(26,26,31,0.7)" : "rgba(139,137,128,0.6)"}
        strokeWidth="1.1"
      />
      {/* iris — colored when awake */}
      <circle
        cx={awake ? 24.8 : 24}
        cy={awake ? 27.4 : 27}
        r={awake ? 2.8 : 1.3}
        fill={awake ? hue : "rgba(113,113,122,0.85)"}
      />
      {/* pupil */}
      {awake && <circle cx="24.8" cy="27.4" r="1.2" fill="#0a0a0a" />}
      {/* catch-light */}
      {awake && <circle cx="26.2" cy="25.8" r="0.8" fill="#f4f4f5" />}

      {/* serious flat mouth */}
      {awake && (
        <line x1="21.5" y1="34" x2="26.5" y2="34" stroke={dark} strokeWidth="1.2" strokeLinecap="round" />
      )}
    </>
  );
}

// ─── Juno: the alert one ────────────────────────────────────
function Juno({ awake, body, stroke, accent, dark }: Parts) {
  return (
    <>
      {/* ears */}
      <path
        d="M16.5 15.5 L19 8 L22 15.5 Z"
        fill={body}
        stroke={accent}
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path
        d="M26 15.5 L29 8 L31.5 15.5 Z"
        fill={body}
        stroke={accent}
        strokeWidth="1.4"
        strokeLinejoin="round"
      />

      <ellipse cx="24" cy="28" rx="14" ry="14" fill={body} stroke={stroke} strokeWidth="1.4" />

      {/* big alert round eyes */}
      <circle cx="20" cy="27" r="2" fill={dark} />
      <circle cx="28" cy="27" r="2" fill={dark} />
      {awake && (
        <>
          <circle cx="20.6" cy="26.4" r="0.7" fill="#f4f4f5" />
          <circle cx="28.6" cy="26.4" r="0.7" fill="#f4f4f5" />
        </>
      )}

      {/* surprised "o" mouth */}
      {awake && (
        <circle
          cx="24"
          cy="32.5"
          r="1.2"
          fill="#0a0a0a"
          stroke="none"
        />
      )}
    </>
  );
}

// ─── Bodhi: the calm one ─────────────────────────────────────
function Bodhi({ awake, hue, body, stroke, accent, dark }: Parts) {
  return (
    <>
      <ellipse cx="24" cy="29" rx="15" ry="13" fill={body} stroke={stroke} strokeWidth="1.4" />

      {/* closed zen eyes */}
      <path
        d="M17.5 27.5 Q20 25.5 22.5 27.5"
        stroke={dark}
        strokeWidth="1.4"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M25.5 27.5 Q28 25.5 30.5 27.5"
        stroke={dark}
        strokeWidth="1.4"
        strokeLinecap="round"
        fill="none"
      />

      {/* sparkle */}
      {awake && (
        <g>
          <path d="M24 11 L24 16 M21.5 13.5 L26.5 13.5" stroke={accent} strokeWidth="1.2" strokeLinecap="round" />
          <path d="M22.5 11.5 L25.5 15.5 M25.5 11.5 L22.5 15.5" stroke={accent} strokeWidth="0.8" strokeLinecap="round" opacity="0.55" />
        </g>
      )}

      {/* calm gentle smile */}
      {awake && (
        <path
          d="M21.5 32.5 Q24 34 26.5 32.5"
          stroke={dark}
          strokeWidth="1.2"
          strokeLinecap="round"
          fill="none"
        />
      )}
    </>
  );
}
