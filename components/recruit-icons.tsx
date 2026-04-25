import type * as React from "react";

export type RecruitIconProps = React.SVGProps<SVGSVGElement> & {
  accent?: string;
  accent2?: string;
};

function IconBase({
  children,
  accent: _accent,
  accent2: _accent2,
  ...props
}: RecruitIconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

export function AgentCoreIcon({ accent = "#0EA5E9", accent2 = "#16A34A", ...props }: RecruitIconProps) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="12" r="7.2" strokeOpacity="0.82" />
      <path d="M12 5.8a6.2 6.2 0 0 1 5.5 3.4" stroke={accent} />
      <path d="M6.7 15.3a6.2 6.2 0 0 1-.1-6.4" stroke={accent2} />
      <circle cx="12" cy="12" r="3.2" fill={accent} fillOpacity="0.13" stroke={accent} />
      <circle cx="12" cy="12" r="1.55" fill={accent} stroke="none" />
    </IconBase>
  );
}

export function RoleRadarIcon({ accent = "#0EA5E9", accent2 = "#16A34A", ...props }: RecruitIconProps) {
  return (
    <IconBase {...props}>
      <path d="M5 16.4a7.4 7.4 0 0 1 14 0" strokeOpacity="0.78" />
      <path d="M8 15.2a4.3 4.3 0 0 1 8 0" stroke={accent} />
      <path d="M12 16.4V6.2" />
      <path d="M12 16.4l5.2-7.2" stroke={accent2} />
      <circle cx="17.2" cy="9.2" r="1.65" fill={accent2} stroke="none" />
      <path d="M4.6 19h14.8" strokeOpacity="0.42" />
    </IconBase>
  );
}

export function MatchSignalIcon({ accent = "#0EA5E9", accent2 = "#16A34A", ...props }: RecruitIconProps) {
  return (
    <IconBase {...props}>
      <path d="M7.2 8.3h5.2c2.5 0 4.4 1.9 4.4 4.2s-1.9 4.2-4.4 4.2H7.2" strokeOpacity="0.78" />
      <path d="M7.2 8.3l3.4-3.1M7.2 8.3l3.4 3.1" stroke={accent} />
      <path d="M16.8 16.7l-3.4-3.1M16.8 16.7l-3.4 3.1" stroke={accent2} />
      <circle cx="7.2" cy="8.3" r="1.55" fill={accent} stroke="none" />
      <circle cx="16.8" cy="16.7" r="1.55" fill={accent2} stroke="none" />
    </IconBase>
  );
}

export function ResumeTailorIcon({ accent = "#0EA5E9", accent2 = "#16A34A", ...props }: RecruitIconProps) {
  return (
    <IconBase {...props}>
      <path d="M7.4 5.2h6.3l2.9 2.9v10.7H7.4z" strokeOpacity="0.82" />
      <path d="M13.6 5.3v3h3" strokeOpacity="0.58" />
      <path d="M9.8 12.1h4.4" stroke={accent} />
      <path d="M9.8 15h2.4" stroke={accent} />
      <path d="M15.2 14.6l1.2 1.2 2.7-3.1" stroke={accent2} />
      <circle cx="9.8" cy="12.1" r="0.85" fill={accent} stroke="none" />
    </IconBase>
  );
}

export function ApplicationSendIcon({ accent = "#0EA5E9", accent2 = "#16A34A", ...props }: RecruitIconProps) {
  return (
    <IconBase {...props}>
      <path d="M5.2 6.7l14.2-2.8-4.7 14.4-3.2-5.6z" strokeOpacity="0.82" />
      <path d="M11.5 12.7l7.9-8.8" stroke={accent} />
      <path d="M5.2 6.7l6.3 6" stroke={accent2} />
      <path d="M4.5 18.6h7.9" strokeOpacity="0.48" />
      <circle cx="14.7" cy="18.3" r="1.45" fill={accent2} stroke="none" />
    </IconBase>
  );
}

export function PipelinePathIcon({ accent = "#0EA5E9", accent2 = "#16A34A", ...props }: RecruitIconProps) {
  return (
    <IconBase {...props}>
      <path d="M5.2 8.1c4.2 0 2.9 7.8 6.8 7.8s2.6-7.8 6.8-7.8" strokeOpacity="0.82" />
      <circle cx="5.2" cy="8.1" r="2" fill="rgba(255,255,255,0.18)" />
      <circle cx="12" cy="15.9" r="2.15" fill={accent} fillOpacity="0.14" stroke={accent} />
      <circle cx="18.8" cy="8.1" r="2" fill={accent2} fillOpacity="0.16" stroke={accent2} />
      <path d="M12 9.2v2.3" stroke={accent} />
      <path d="M10.9 10.4h2.2" stroke={accent} />
    </IconBase>
  );
}
