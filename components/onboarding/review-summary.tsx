import { cx, mistRadii } from "@/components/design-system";
import { compactLinks } from "@/lib/intake/shared/url-utils";
import type { Data } from "@/app/onboarding/_data";

export function ReviewSummary({
  data,
  selectedRoles,
  linkCount,
}: {
  data: Data;
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
    { label: "Email", value: data.email || "From sign-in" },
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
            "border border-white/55 bg-white/30 px-3 py-2",
            mistRadii.nested,
          )}
        >
          <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-slate-500">
            {row.label}
          </div>
          <div className="mt-1 break-words text-sm leading-5 text-slate-800">
            {row.value}
          </div>
        </div>
      ))}
    </div>
  );
}
