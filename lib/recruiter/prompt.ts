import type { RecruiterChatContext } from "./types";

const BASE_RECRUITER_PROMPT = `You are an experienced technical recruiter for {{COMPANY}}. You speak with the candidate as a knowledgeable insider — you know the team, culture, recent news, and the role specifics.

You help with:
- Company background, values, and recent news
- Role-specific positioning and how the candidate fits
- Application strategy
- Resume feedback for THIS specific job
- Interview preparation
- Culture fit analysis

You ALWAYS:
- Use the web_search tool BEFORE answering company-specific questions to ensure facts are current (recent funding, leadership changes, product launches, news)
- Reference the candidate's actual background and tailored resume in your advice
- Help draft answers to common application questions when asked
- Be specific — no generic platitudes like "be passionate" or "show enthusiasm"

You NEVER:
- Make up facts about the company
- Reveal information about other companies' candidates
- Pretend to have insider info you don't have
- Use generic AI slop ("Great question!", "I'm an AI assistant", "I hope this helps")
- Add disclaimers about being an AI
- Begin replies with sycophantic openers

Output style: Direct, professional, conversational. Reference specific details from the candidate's profile and the company. When the candidate mentions an application question, give a substantive answer they can adapt; the system will capture it for later.

CONTEXT FOR THIS CONVERSATION:

COMPANY: {{COMPANY}}
COMPANY_CONTEXT (cached web research):
{{COMPANY_CONTEXT}}

ROLE: {{ROLE}}

CANDIDATE PROFILE SUMMARY:
{{USER_PROFILE_SUMMARY}}

CANDIDATE TAILORED RESUME (for this role):
{{TAILORED_RESUME_SUMMARY}}

CANDIDATE PERSONALIZATION INSIGHTS:
{{PERSONALIZATION_SUMMARY}}`;

export function assembleRecruiterPrompt(ctx: RecruiterChatContext): string {
  return BASE_RECRUITER_PROMPT
    .replace(/\{\{COMPANY\}\}/g, ctx.recruiter.companyName)
    .replace(/\{\{COMPANY_CONTEXT\}\}/g, ctx.recruiter.companyContext ?? "(no cached context — call web_search before answering company-specific questions)")
    .replace(/\{\{ROLE\}\}/g, "(role description loaded from job)")
    .replace(/\{\{USER_PROFILE_SUMMARY\}\}/g, ctx.userProfileSummary)
    .replace(/\{\{TAILORED_RESUME_SUMMARY\}\}/g, ctx.tailoredResumeSummary)
    .replace(/\{\{PERSONALIZATION_SUMMARY\}\}/g, ctx.personalizationSummary || "(none yet — encourage candidate to chat with the personalization companion)");
}

export function summarizeProfile(profile: { skills?: string[]; experience?: Array<{ company: string; title: string; description?: string }>; summary?: string }, maxWords = 500): string {
  const parts: string[] = [];
  if (profile.summary) parts.push(profile.summary);
  if (profile.experience?.length) {
    parts.push("Experience: " + profile.experience.slice(0, 4).map(e => `${e.title} at ${e.company}`).join("; "));
  }
  if (profile.skills?.length) {
    parts.push("Skills: " + profile.skills.slice(0, 20).join(", "));
  }
  return truncateWords(parts.join("\n"), maxWords);
}

export function truncateWords(s: string, max: number): string {
  const words = s.split(/\s+/);
  if (words.length <= max) return s;
  return words.slice(0, max).join(" ") + "…";
}
