import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname } from "node:path";
import { loadEnvConfig } from "@next/env";
import { ConvexHttpClient } from "convex/browser";
import { convexRefs } from "../../lib/convex-refs";
import type { UserProfile } from "../../lib/profile";

const root = "/Users/owenfisher/Desktop/recruit-main";
loadEnvConfig(root);

const sourcePath = flagValue("--source") ?? "/Users/owenfisher/Desktop/recruit/data/seed-profile.json";
const resumePath = flagValue("--resume") ?? "/Users/owenfisher/Desktop/rbc2.0/qi-waterfall-backtest/resume.pdf";
const demoUserId = flagValue("--demo-user-id") ?? "demo";
const earliestStartDate = flagValue("--earliest-start-date");
const noticePeriod = flagValue("--notice-period") ?? "Two weeks";
const rustSkillRating = flagValue("--rust-skill-rating");
const writeProfilePath = flagValue("--write-profile");

async function main() {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) throw new Error("NEXT_PUBLIC_CONVEX_URL is required");
  if (!existsSync(sourcePath)) throw new Error(`source profile not found: ${sourcePath}`);
  if (!existsSync(resumePath)) throw new Error(`resume file not found: ${resumePath}`);

  const seed = JSON.parse(readFileSync(sourcePath, "utf8")) as Record<string, any>;
  const profile = normalizeSeedProfile(seed, resumePath);
  if (writeProfilePath) {
    const targetPath = writeProfilePath.startsWith("/") ? writeProfilePath : `${root}/${writeProfilePath}`;
    mkdirSync(dirname(targetPath), { recursive: true });
    writeFileSync(targetPath, JSON.stringify(profile, null, 2));
  }
  const client = new ConvexHttpClient(convexUrl.replace(/\/+$/, ""));
  const result = await client.mutation(convexRefs.ashby.upsertDemoProfileSnapshot, {
    demoUserId,
    profile,
  });

  console.log(JSON.stringify({
    demoUserId: result.demoUserId,
    updatedAt: result.updatedAt,
    profileSummary: {
      hasName: Boolean(profile.name),
      hasEmail: Boolean(profile.email),
      hasPhone: Boolean((profile as any).phone),
      hasResumePath: Boolean((profile as any).resumePath),
      experienceCount: profile.experience.length,
      educationCount: profile.education.length,
      skillsCount: profile.skills.length,
      rolePreferenceCount: profile.prefs.roles.length,
      locationPreferenceCount: profile.prefs.locations.length,
    },
    wroteProfile: Boolean(writeProfilePath),
  }));
}

function normalizeSeedProfile(seed: Record<string, any>, localResumePath: string): UserProfile & Record<string, any> {
  const sourceProfile = objectValue(seed.profile);
  const application = objectValue(sourceProfile.application);
  const preferences = objectValue(sourceProfile.preferences);
  const firstName = stringValue(application.firstName);
  const lastName = stringValue(application.lastName);
  const name = [firstName, lastName].filter(Boolean).join(" ") || undefined;
  const now = new Date().toISOString();
  const experiences = arrayValue(seed.experiences)
    .map((item) => objectValue(item))
    .sort((left, right) => numberValue(left.order) - numberValue(right.order))
    .map((item) => ({
      company: stringValue(item.company) ?? "",
      title: stringValue(item.role) ?? "",
      startDate: stringValue(item.startDate),
      endDate: stringValue(item.endDate),
      description: arrayValue(item.bullets).map(String).filter(Boolean).join("\n"),
    }))
    .filter((item) => item.company || item.title);
  const projects = arrayValue(seed.projects).map((item) => objectValue(item));
  const projectSkills = projects.flatMap((project) => arrayValue(project.tech).map(String));
  const skills = uniqueStrings([
    ...projectSkills,
    ...stringValue(sourceProfile.bio)?.match(/\b(TypeScript|React|Next\.js|Node\.js|Python|PostgreSQL|SQL|AI|LLM|OpenAI|Convex|Puppeteer|Playwright|Rust)\b/gi) ?? [],
  ]);
  const roles = arrayValue(preferences.roleTypes).map(String).filter(Boolean);
  const locations = arrayValue(preferences.locations).map(String).filter(Boolean);

  return {
    name,
    email: stringValue(sourceProfile.email) ?? stringValue(objectValue(seed.user).email),
    phone: stringValue(sourceProfile.phone),
    location: stringValue(sourceProfile.location) ?? stringValue(application.city),
    headline: roles[0],
    summary: stringValue(sourceProfile.bio),
    links: {
      github: stringValue(sourceProfile.github),
      linkedin: stringValue(sourceProfile.linkedin),
      website: stringValue(sourceProfile.portfolio),
    },
    resume: {
      filename: basename(localResumePath),
      rawText: stringValue(objectValue(seed.resume).masterResumeLatexSource),
      uploadedAt: now,
    },
    resumePath: localResumePath,
    files: {
      resumePath: localResumePath,
    },
    experience: experiences,
    education: [{
      school: stringValue(application.school) ?? "",
      degree: stringValue(application.degree),
      field: stringValue(application.discipline),
      startDate: [stringValue(application.startMonth), stringValue(application.startYear)].filter(Boolean).join(" ") || undefined,
      endDate: [stringValue(application.endMonth), stringValue(application.endYear)].filter(Boolean).join(" ") || undefined,
    }].filter((item) => item.school || item.degree || item.field),
    skills,
    prefs: {
      roles,
      workAuth: stringValue(preferences.workAuth) ?? stringValue(application.usWorkAuthorized),
      locations,
      minSalary: numberValue(preferences.minComp) > 0 ? String(numberValue(preferences.minComp)) : undefined,
    },
    application: {
      firstName,
      lastName,
      city: stringValue(application.city),
      primaryAddress: stringValue(application.primaryAddress),
      school: stringValue(application.school),
      degree: stringValue(application.degree),
      discipline: stringValue(application.discipline),
      graduationDate: stringValue(application.graduationDate),
      salaryExpectations: stringValue(application.desiredHourlyCompensation),
      earliestStartDate,
      availableStartDate: earliestStartDate,
      noticePeriod,
      rustSkillRating,
      onsitePreference: stringValue(application.onsitePreference),
      workLocationPreference: stringValue(application.workLocationPreference),
      usWorkAuthorized: stringValue(application.usWorkAuthorized),
      visaSponsorship: stringValue(application.visaSponsorship),
      howHeard: stringValue(application.howHeard),
      whyCompany: stringValue(application.whyCompany),
    },
    suggestions: [],
    provenance: {
      name: "manual",
      email: "manual",
      phone: "manual",
      location: "manual",
      links: "manual",
      resume: "manual",
      experience: "manual",
      education: "manual",
      skills: "manual",
      prefs: "manual",
      application: "manual",
    },
    log: [{
      at: now,
      source: "manual",
      label: "Seeded Convex profile for Ashby form-fill testing",
      level: "success",
    }],
    updatedAt: now,
  };
}

function flagValue(name: string): string | null {
  const index = process.argv.indexOf(name);
  if (index < 0) return null;
  const value = process.argv[index + 1];
  return value && !value.startsWith("--") ? value : null;
}

function objectValue(value: unknown): Record<string, any> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, any> : {};
}

function arrayValue(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function stringValue(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

function numberValue(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function uniqueStrings(values: unknown[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const text = String(value).trim();
    if (!text) continue;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(text);
  }
  return result;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
