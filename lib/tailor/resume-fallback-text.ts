import type { TailoredResume } from "@/lib/tailor/types";

export function resumeFallbackText(resume: TailoredResume): string {
  const contact = [
    resume.email,
    resume.location,
    resume.links?.linkedin,
    resume.links?.github,
    resume.links?.website,
  ].filter((item): item is string => typeof item === "string" && item.trim().length > 0);

  return [
    resume.name || "Tailored Resume",
    contact.length > 0 ? contact.join(" | ") : undefined,
    resume.headline,
    "",
    resume.summary,
    "",
    resume.skills?.length ? `Skills: ${resume.skills.join(", ")}` : undefined,
    "",
    ...(resume.experience ?? []).flatMap((item) => [
      [item.title, item.company].filter(Boolean).join(" - "),
      [item.location, [item.startDate, item.endDate].filter(Boolean).join(" - ")]
        .filter(Boolean)
        .join(" | "),
      ...(item.bullets ?? []).map((bullet) => `- ${bullet}`),
      "",
    ]),
    ...(resume.education ?? []).flatMap((item) => [
      [item.school, item.degree, item.field, item.endDate].filter(Boolean).join(" | "),
      "",
    ]),
    ...(resume.projects ?? []).flatMap((item) => [
      [item.name, item.url].filter(Boolean).join(" | "),
      item.technologies?.length ? `Technologies: ${item.technologies.join(", ")}` : undefined,
      ...(item.bullets ?? []).map((bullet) => `- ${bullet}`),
      "",
    ]),
  ].filter((line): line is string => typeof line === "string").join("\n");
}
