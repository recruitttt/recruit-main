import type { ApplyServiceProfile, JobCandidate, ShortlistResult } from "./types";

export function shortlistJobsForProfile(args: {
  jobs: JobCandidate[];
  profile: ApplyServiceProfile;
  limit?: number;
}): ShortlistResult[] {
  const limit = Math.max(1, Math.min(20, args.limit ?? args.jobs.length));
  const profileSkills = normalizeList(args.profile.skills ?? []);
  const roles = normalizeList(args.profile.preferences?.roles ?? args.profile.prefs?.roles ?? []);
  const locations = normalizeList(args.profile.preferences?.locations ?? args.profile.prefs?.locations ?? []);

  return args.jobs
    .map((job) => {
      const haystack = normalizeText([
        job.title,
        job.company,
        job.location,
        job.description,
        ...(job.requirements ?? []),
      ].filter(Boolean).join(" "));
      const strengths: string[] = [];
      const risks: string[] = [];
      let score = 40;

      const matchedSkills = profileSkills.filter((skill) => haystack.includes(skill));
      if (matchedSkills.length > 0) {
        score += Math.min(32, matchedSkills.length * 8);
        strengths.push(`skill match: ${matchedSkills.slice(0, 4).join(", ")}`);
      } else {
        risks.push("few explicit skill matches");
      }

      const roleMatch = roles.find((role) => haystack.includes(role) || normalizeText(job.title).includes(role));
      if (roleMatch) {
        score += 18;
        strengths.push(`role preference: ${roleMatch}`);
      }

      const location = normalizeText(job.location ?? "");
      if (locations.length > 0 && location) {
        const locationMatch = locations.some((pref) => location.includes(pref) || pref.includes(location));
        if (locationMatch || /\bremote\b/.test(location)) {
          score += 10;
          strengths.push("location match");
        } else {
          score -= 8;
          risks.push("location mismatch");
        }
      }

      if (/account executive|sales|customer success/i.test(job.title)) {
        score -= 20;
        risks.push("business role mismatch");
      }

      const clamped = Math.max(0, Math.min(100, Math.round(score)));
      return {
        job,
        score: clamped,
        rationale: strengths.length > 0
          ? strengths.join("; ")
          : "Ranked from available title, description, and profile preferences.",
        strengths,
        risks,
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

function normalizeList(values: string[]): string[] {
  return values.map(normalizeText).filter(Boolean);
}

function normalizeText(value: string | undefined): string {
  return (value ?? "").toLowerCase().replace(/[^a-z0-9+#.]+/g, " ").replace(/\s+/g, " ").trim();
}
