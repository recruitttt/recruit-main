import type { TailoredResume } from "@/lib/tailor/types";

function clean(value?: string): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function displayName(resume: TailoredResume): string {
  const name = clean(resume.name);
  if (name) return name;
  const email = clean(resume.email);
  if (email) return email.split("@")[0] || "Tailored Resume";
  return "Tailored Resume";
}

export function resumeFallbackText(resume: TailoredResume): string {
  const contact = [
    resume.email,
    resume.location,
    resume.links?.linkedin,
    resume.links?.github,
    resume.links?.website,
  ]
    .map(clean)
    .filter((item) => item.length > 0);

  const experience = (resume.experience ?? []).flatMap((item) => [
    [clean(item.title), clean(item.company)].filter(Boolean).join(" - "),
    [clean(item.location), [clean(item.startDate), clean(item.endDate)].filter(Boolean).join(" - ")]
      .filter(Boolean)
      .join(" | "),
    ...(item.bullets ?? []).map((bullet) => `- ${clean(bullet)}`).filter((line) => line !== "- "),
    "",
  ]);

  const education = (resume.education ?? []).flatMap((item) => [
    [clean(item.school), clean(item.degree), clean(item.field), clean(item.endDate)].filter(Boolean).join(" | "),
    "",
  ]);

  const projects = (resume.projects ?? []).flatMap((item) => [
    [clean(item.name), clean(item.url)].filter(Boolean).join(" | "),
    item.technologies?.length ? `Technologies: ${item.technologies.map(clean).filter(Boolean).join(", ")}` : undefined,
    ...(item.bullets ?? []).map((bullet) => `- ${clean(bullet)}`).filter((line) => line !== "- "),
    "",
  ]);

  return [
    displayName(resume),
    contact.length > 0 ? contact.join(" | ") : undefined,
    clean(resume.headline) || undefined,
    clean(resume.summary) || undefined,
    "",
    experience.length > 0 ? "EXPERIENCE" : undefined,
    ...experience,
    education.length > 0 ? "EDUCATION" : undefined,
    ...education,
    resume.skills?.length ? "SKILLS" : undefined,
    resume.skills?.length ? resume.skills.map(clean).filter(Boolean).join(", ") : undefined,
    resume.skills?.length ? "" : undefined,
    projects.length > 0 ? "PROJECTS" : undefined,
    ...projects,
  ].filter((line): line is string => typeof line === "string").join("\n");
}
