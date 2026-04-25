// Pure HTML-string builder for the tailored resume. We avoid React server
// rendering so Turbopack doesn't flag react-dom/server imports inside the
// API route. CSS rules borrowed from santifer/career-ops:
// print-color-adjust:exact, break-inside:avoid, system-font stack.

import type { TailoredResume } from "./tailor/types";

export type PageSize = "letter" | "a4";

export function pickPageSize(location?: string): PageSize {
  if (!location) return "letter";
  const lc = location.toLowerCase();
  const usCa = ["united states", "usa", "u.s.", "us·", "canada", "remote · americas", "remote (americas)", "remote, americas"];
  if (usCa.some((needle) => lc.includes(needle))) return "letter";
  const a4Hints = ["united kingdom", "uk", "germany", "france", "spain", "ireland", "europe", "emea", "japan", "australia", "india"];
  if (a4Hints.some((needle) => lc.includes(needle))) return "a4";
  return "letter";
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function joinDates(start?: string, end?: string): string {
  if (!start && !end) return "";
  if (start && end) return `${start} – ${end}`;
  return start ?? end ?? "";
}

function css(pageSize: PageSize): string {
  return `
  @page { size: ${pageSize}; margin: 0.6in; }
  * { box-sizing: border-box; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
  html, body { margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", "Segoe UI", Arial, sans-serif;
    color: #111;
    font-size: 10.5pt;
    line-height: 1.42;
    background: #fff;
  }
  .resume { max-width: 100%; }
  header { margin-bottom: 14px; padding-bottom: 10px; border-bottom: 1px solid #222; }
  .name { font-size: 22pt; font-weight: 600; letter-spacing: -0.01em; margin: 0 0 2px 0; line-height: 1.05; }
  .contact { font-size: 9pt; color: #555; }
  .contact-sep { color: #aaa; padding: 0 4px; }
  section { margin-top: 14px; break-inside: avoid; }
  h2 {
    font-size: 9pt;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: #222;
    margin: 0 0 8px 0;
    padding-bottom: 3px;
    border-bottom: 1px solid #ddd;
  }
  .role { margin-bottom: 12px; break-inside: avoid; }
  .role-head {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    align-items: baseline;
    margin-bottom: 2px;
  }
  .role-title { font-weight: 600; font-size: 10.5pt; }
  .role-company { color: #444; }
  .role-loc { color: #666; font-size: 9pt; }
  .role-dates { font-size: 9pt; color: #666; white-space: nowrap; font-variant-numeric: tabular-nums; }
  .role ul { margin: 4px 0 0 0; padding-left: 16px; }
  .role li { margin: 2px 0; }
  .education-item { display: flex; justify-content: space-between; gap: 12px; margin-bottom: 4px; break-inside: avoid; }
  .education-item .school { font-weight: 600; }
  .education-item .degree { color: #444; }
  .skills-line { font-size: 10pt; }
  .skills-line .sep { color: #aaa; padding: 0 4px; }
  .dot { color: #aaa; padding: 0 4px; }
  `;
}

function contactLine(r: TailoredResume): string {
  const bits = [r.email, r.links?.linkedin, r.links?.github]
    .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
    .map(escapeHtml);
  if (bits.length === 0) return "";
  return `<div class="contact">${bits
    .map((b, i) => (i === 0 ? b : `<span class="contact-sep">·</span>${b}`))
    .join("")}</div>`;
}

function experienceSection(r: TailoredResume): string {
  if (r.experience.length === 0) return "";
  const items = r.experience
    .map((role) => {
      const title = escapeHtml(role.title || "");
      const company = role.company ? `<span class="dot">·</span><span class="role-company">${escapeHtml(role.company)}</span>` : "";
      const loc = role.location ? `<span class="dot">·</span><span class="role-loc">${escapeHtml(role.location)}</span>` : "";
      const dates = escapeHtml(joinDates(role.startDate, role.endDate));
      const bullets = (role.bullets ?? [])
        .filter((b) => b && b.trim())
        .map((b) => `<li>${escapeHtml(b)}</li>`) // bullets are short, no markdown
        .join("");
      const ul = bullets ? `<ul>${bullets}</ul>` : "";
      return `<div class="role"><div class="role-head"><div><span class="role-title">${title}</span>${company}${loc}</div><div class="role-dates">${dates}</div></div>${ul}</div>`;
    })
    .join("");
  return `<section class="experience"><h2>Experience</h2>${items}</section>`;
}

function educationSection(r: TailoredResume): string {
  if (r.education.length === 0) return "";
  const items = r.education
    .map((e) => {
      const school = escapeHtml(e.school || "");
      const degBits = [e.degree, e.field].filter(Boolean).map((s) => escapeHtml(s as string)).join(", ");
      const degree = degBits ? `<span class="dot">·</span><span class="degree">${degBits}</span>` : "";
      const date = e.endDate ? `<div class="role-dates">${escapeHtml(e.endDate)}</div>` : "";
      return `<div class="education-item"><div><span class="school">${school}</span>${degree}</div>${date}</div>`;
    })
    .join("");
  return `<section class="education"><h2>Education</h2>${items}</section>`;
}

function skillsSection(r: TailoredResume): string {
  if (r.skills.length === 0) return "";
  const inner = r.skills
    .map(escapeHtml)
    .map((s, i) => (i === 0 ? s : `<span class="sep">·</span>${s}`))
    .join("");
  return `<section class="skills"><h2>Skills</h2><div class="skills-line">${inner}</div></section>`;
}

function projectsSection(r: TailoredResume): string {
  if (r.projects.length === 0) return "";
  const items = r.projects
    .map((project) => {
      const name = project.url
        ? `<a class="role-title" href="${escapeHtml(project.url)}">${escapeHtml(project.name)}</a>`
        : `<span class="role-title">${escapeHtml(project.name)}</span>`;
      const tech = project.technologies?.length
        ? `<span class="dot">·</span><span class="role-company">${escapeHtml(project.technologies.join(", "))}</span>`
        : "";
      const bullets = (project.bullets ?? [])
        .filter((b) => b && b.trim())
        .map((b) => `<li>${escapeHtml(b)}</li>`)
        .join("");
      const ul = bullets ? `<ul>${bullets}</ul>` : "";
      return `<div class="role"><div class="role-head"><div>${name}${tech}</div></div>${ul}</div>`;
    })
    .join("");
  return `<section class="projects"><h2>Projects</h2>${items}</section>`;
}

function headerSection(r: TailoredResume): string {
  const name = escapeHtml(r.name || "");
  return `<header><h1 class="name">${name}</h1>${contactLine(r)}</header>`;
}

export function renderResumeHtml(resume: TailoredResume, pageSize: PageSize = "letter"): string {
  const title = `Resume – ${resume.name || "Tailored"}`;
  return [
    `<!doctype html>`,
    `<html lang="en"><head>`,
    `<meta charset="utf-8" />`,
    `<title>${escapeHtml(title)}</title>`,
    `<style>${css(pageSize)}</style>`,
    `</head><body>`,
    `<div class="resume">`,
    headerSection(resume),
    experienceSection(resume),
    educationSection(resume),
    skillsSection(resume),
    projectsSection(resume),
    `</div>`,
    `</body></html>`,
  ].join("");
}
