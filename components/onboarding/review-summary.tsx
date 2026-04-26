import { cx, mistRadii } from "@/components/design-system";
import { compactLinks } from "@/lib/intake/shared/url-utils";
import type { Data } from "@/app/onboarding/_data";

export function ReviewSummary({
  data,
  accountEmail,
  selectedRoles,
  linkCount,
}: {
  data: Data;
  accountEmail?: string;
  selectedRoles: string[];
  linkCount: number;
}) {
  const rows = [
    { label: "Role target", value: selectedRoles.join(", ") || "Missing" },
    { label: "Resume", value: data.resumeFilename || "Missing" },
    {
      label: "Links",
      value:
        linkCount > 0 ? compactLinks(data.links).join(", ") : "None added",
    },
    { label: "Email", value: accountEmail || data.email || "From sign-in" },
    {
      label: "Preferences",
      value:
        [data.prefs.location, data.prefs.workAuth].filter(Boolean).join(" · ") ||
        "None added",
    },
  ];

  return (
    <div className="grid gap-2">
      {rows.map((row) => (
        <div
          key={row.label}
          className={cx(
            "border border-[var(--glass-border)] bg-[var(--theme-compat-bg-soft)] px-3 py-2",
            mistRadii.nested,
          )}
        >
          <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--color-fg-subtle)]">
            {row.label}
          </div>
          <div className="mt-1 break-words text-sm leading-5 text-[var(--color-fg-muted)]">
            {row.value}
          </div>
        </div>
      ))}
    </div>
  );
}
