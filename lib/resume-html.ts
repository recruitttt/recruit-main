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

function cleanText(value?: string): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function hasText(value?: string): value is string {
  return cleanText(value).length > 0;
}

function joinDates(start?: string, end?: string): string {
  if (!start && !end) return "";
  if (start && end) return `${start} – ${end}`;
  return start ?? end ?? "";
}

function displayName(r: TailoredResume): string {
  const name = cleanText(r.name);
  if (name) return name;
  const email = cleanText(r.email);
  if (email) return email.split("@")[0] || "Tailored Resume";
  return "Tailored Resume";
}

function compactUrl(value: string): string {
  return value
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .replace(/\/$/g, "");
}

function contactLabel(value: string): string {
  const compact = compactUrl(value);
  if (/linkedin\.com\//i.test(compact)) return "LinkedIn";
  if (/github\.com\//i.test(compact)) return "GitHub";
  return compact;
}

function css(pageSize: PageSize): string {
  return `
  @page { size: ${pageSize}; margin: 0.48in; }
  * { box-sizing: border-box; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
  html, body { margin: 0; padding: 0; }
  body {
    font-family: ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;
    color: #151515;
    font-size: 9.85pt;
    line-height: 1.36;
    background: #fff;
  }
  a { color: inherit; text-decoration: none; }
  .resume { max-width: 100%; }
  header > div { min-width: 0; }
  header {
    display: grid;
    grid-template-columns: minmax(0, 1.2fr) minmax(180px, 0.8fr);
    gap: 14px;
    margin-bottom: 12px;
    padding-bottom: 9px;
    border-bottom: 1.35px solid #151515;
  }
  .name {
    margin: 0;
    color: #0f172a;
    font-size: 22pt;
    font-weight: 720;
    letter-spacing: 0;
    line-height: 1.02;
  }
  .headline {
    margin-top: 4px;
    color: #334155;
    font-size: 9.6pt;
    font-weight: 560;
    line-height: 1.25;
  }
  .contact {
    align-self: end;
    color: #475569;
    font-size: 8.25pt;
    line-height: 1.38;
    min-width: 0;
    overflow-wrap: anywhere;
    text-align: right;
  }
  .contact span { display: inline; }
  .contact-sep { color: #94a3b8; padding: 0 4px; }
  section { margin-top: 10px; }
  h2 {
    display: grid;
    grid-template-columns: auto 1fr;
    align-items: center;
    gap: 8px;
    color: #0f172a;
    font-size: 8.2pt;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.16em;
    margin: 0 0 6px 0;
  }
  h2::after { content: ""; height: 1px; background: #cbd5e1; }
  .role { margin-bottom: 8.5px; break-inside: avoid; page-break-inside: avoid; }
  .role:last-child { margin-bottom: 0; }
  .role-head {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 12px;
    align-items: baseline;
    margin-bottom: 2px;
  }
  .role-title { color: #0f172a; font-weight: 720; font-size: 10pt; }
  .role-company { color: #334155; font-weight: 560; }
  .role-loc { color: #64748b; font-size: 8.6pt; }
  .role-dates { color: #64748b; font-size: 8.35pt; white-space: nowrap; font-variant-numeric: tabular-nums; }
  .role ul { margin: 3px 0 0 0; padding-left: 14px; }
  .role li { margin: 1px 0 0 0; padding-left: 2px; }
  .education-item {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 12px;
    margin-bottom: 3px;
    break-inside: avoid;
    page-break-inside: avoid;
  }
  .education-item .school { color: #0f172a; font-weight: 720; }
  .education-item .degree { color: #334155; }
  .skills-line { color: #1e293b; font-size: 9pt; line-height: 1.45; }
  .skills-line .sep { color: #94a3b8; padding: 0 4px; }
  .dot { color: #94a3b8; padding: 0 4px; }
  `;
}

function contactLine(r: TailoredResume): string {
  const bits = [r.email, r.location, r.links?.linkedin, r.links?.github, r.links?.website]
    .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
    .map((item) => cleanText(item))
    .map((item) => item.startsWith("http")
      ? `<a href="${escapeHtml(item)}">${escapeHtml(contactLabel(item))}</a>`
      : escapeHtml(item));
  if (bits.length === 0) return "";
  return `<div class="contact">${bits
    .map((b, i) => (i === 0 ? `<span>${b}</span>` : `<span class="contact-sep">·</span><span>${b}</span>`))
    .join("")}</div>`;
}

function experienceSection(r: TailoredResume): string {
  if (r.experience.length === 0) return "";
  const items = r.experience
    .map((role) => {
      const title = escapeHtml(cleanText(role.title) || "Experience");
      const company = hasText(role.company) ? `<span class="dot">·</span><span class="role-company">${escapeHtml(cleanText(role.company))}</span>` : "";
      const loc = hasText(role.location) ? `<span class="dot">·</span><span class="role-loc">${escapeHtml(cleanText(role.location))}</span>` : "";
      const dates = escapeHtml(joinDates(cleanText(role.startDate), cleanText(role.endDate)));
      const bullets = (role.bullets ?? [])
        .filter((b) => b && b.trim())
        .map((b) => `<li>${escapeHtml(cleanText(b))}</li>`) // bullets are short, no markdown
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
      const school = escapeHtml(cleanText(e.school) || "Education");
      const degBits = [e.degree, e.field].filter(Boolean).map((s) => escapeHtml(cleanText(s as string))).join(", ");
      const degree = degBits ? `<span class="dot">·</span><span class="degree">${degBits}</span>` : "";
      const date = hasText(e.endDate) ? `<div class="role-dates">${escapeHtml(cleanText(e.endDate))}</div>` : "";
      return `<div class="education-item"><div><span class="school">${school}</span>${degree}</div>${date}</div>`;
    })
    .join("");
  return `<section class="education"><h2>Education</h2>${items}</section>`;
}

function skillsSection(r: TailoredResume): string {
  if (r.skills.length === 0) return "";
  const inner = r.skills
    .map(cleanText)
    .filter(Boolean)
    .map(escapeHtml)
    .map((s, i) => (i === 0 ? s : `<span class="sep">·</span>${s}`))
    .join("");
  if (!inner) return "";
  return `<section class="skills"><h2>Skills</h2><div class="skills-line">${inner}</div></section>`;
}

function projectsSection(r: TailoredResume): string {
  if (r.projects.length === 0) return "";
  const items = r.projects
    .map((project) => {
      const name = project.url
        ? `<a class="role-title" href="${escapeHtml(cleanText(project.url))}">${escapeHtml(cleanText(project.name))}</a>`
        : `<span class="role-title">${escapeHtml(cleanText(project.name))}</span>`;
      const tech = project.technologies?.length
        ? `<span class="dot">·</span><span class="role-company">${escapeHtml(project.technologies.map(cleanText).filter(Boolean).join(", "))}</span>`
        : "";
      const bullets = (project.bullets ?? [])
        .filter((b) => b && b.trim())
        .map((b) => `<li>${escapeHtml(cleanText(b))}</li>`)
        .join("");
      const ul = bullets ? `<ul>${bullets}</ul>` : "";
      return `<div class="role"><div class="role-head"><div>${name}${tech}</div></div>${ul}</div>`;
    })
    .join("");
  return `<section class="projects"><h2>Projects</h2>${items}</section>`;
}

function headerSection(r: TailoredResume): string {
  const name = escapeHtml(displayName(r));
  const headline = cleanText(r.headline);
  return `<header><div><h1 class="name">${name}</h1>${headline ? `<div class="headline">${escapeHtml(headline)}</div>` : ""}</div>${contactLine(r)}</header>`;
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
