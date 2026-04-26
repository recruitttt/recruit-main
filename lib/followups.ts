import type { UserProfile } from "@/lib/profile";

export const applicationStatuses = [
  "draft",
  "ready_to_apply",
  "applied",
  "follow_up_due",
  "followed_up",
  "responded",
  "interview",
  "rejected",
  "offer",
  "closed",
  "blocked",
] as const;

export const followUpChannels = ["email", "linkedin", "manual"] as const;
export const followUpTaskStates = [
  "scheduled",
  "draft_ready",
  "sent_manually",
  "skipped",
  "blocked",
] as const;

export type ApplicationStatus = (typeof applicationStatuses)[number];
export type FollowUpChannel = (typeof followUpChannels)[number];
export type FollowUpTaskState = (typeof followUpTaskStates)[number];

export type FollowUpApplicationInput = {
  company: string;
  title: string;
  provider?: string;
  jobUrl?: string;
  appliedAt?: string;
  responseSummary?: string;
  metadata?: Record<string, unknown>;
};

export type DefaultFollowUpTask = {
  channel: FollowUpChannel;
  state: "scheduled";
  scheduledFor: string;
  sequence: 1 | 2;
};

export type OutreachDraftInput = {
  application: FollowUpApplicationInput;
  channel: FollowUpChannel;
  profile?: Partial<UserProfile> | null;
  recipient?: string;
  tone?: string;
  source?: string;
};

export type OutreachDraftContent = {
  subject?: string;
  body: string;
};

const BUSINESS_DAY = 24 * 60 * 60 * 1000;

export function addBusinessDays(isoDate: string, days: number): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) {
    throw new Error("invalid_iso_date");
  }

  const result = new Date(date.getTime());
  let remaining = Math.max(0, Math.floor(days));
  while (remaining > 0) {
    result.setTime(result.getTime() + BUSINESS_DAY);
    const day = result.getUTCDay();
    if (day !== 0 && day !== 6) {
      remaining--;
    }
  }
  return result.toISOString();
}

export function buildDefaultFollowUpTasks(appliedAt: string): DefaultFollowUpTask[] {
  const first = addBusinessDays(appliedAt, 5);
  const second = addBusinessDays(first, 7);
  return [
    { channel: "email", state: "scheduled", scheduledFor: first, sequence: 1 },
    { channel: "linkedin", state: "scheduled", scheduledFor: second, sequence: 2 },
  ];
}

export function nextOpenFollowUpAt(
  tasks: Array<{ state: FollowUpTaskState; scheduledFor: string }>
): string | undefined {
  return tasks
    .filter((task) => task.state === "scheduled" || task.state === "draft_ready")
    .map((task) => task.scheduledFor)
    .sort((a, b) => a.localeCompare(b))[0];
}

export function isFollowUpDue(
  task: { state: FollowUpTaskState; scheduledFor: string },
  nowIso: string
) {
  return (
    (task.state === "scheduled" || task.state === "draft_ready") &&
    task.scheduledFor <= nowIso
  );
}

export function generateOutreachDraft({
  application,
  channel,
  profile,
  recipient,
}: OutreachDraftInput): OutreachDraftContent {
  const candidate = profile?.name?.trim() || "the candidate";
  const company = application.company.trim() || "your team";
  const role = application.title.trim() || "the role";
  const appliedLine = application.appliedAt
    ? `I applied on ${formatDate(application.appliedAt)}`
    : "I recently applied";
  const urlLine = application.jobUrl ? `\n\nRole link: ${application.jobUrl}` : "";
  const recipientLine = recipient?.trim() ? `Hi ${recipient.trim()},` : "Hi,";

  if (channel === "linkedin") {
    return {
      body: [
        recipientLine,
        `${appliedLine} for ${role} at ${company}. I am still very interested and wanted to share a quick note in case it is helpful.`,
        `${candidate} has a background in ${profileSummary(profile)} and would be glad to provide any extra context.`,
        "Thanks for taking a look.",
      ].join("\n\n"),
    };
  }

  if (channel === "manual") {
    return {
      subject: `Follow up on ${company} ${role}`,
      body: [
        `Manual follow-up reminder for ${company} - ${role}.`,
        `${appliedLine}. Check the application portal or recruiter thread, then mark this task sent manually when complete.${urlLine}`,
      ].join("\n\n"),
    };
  }

  return {
    subject: `Following up on ${role}`,
    body: [
      recipientLine,
      `${appliedLine} for ${role} at ${company}, and I wanted to follow up because the role remains a strong fit.`,
      `My background in ${profileSummary(profile)} maps well to the work described for this team. I would appreciate any update you can share on timing or next steps.`,
      `Thanks,\n${candidate}${urlLine}`,
    ].join("\n\n"),
  };
}

function profileSummary(profile?: Partial<UserProfile> | null) {
  const skills = profile?.skills?.slice(0, 4).filter(Boolean) ?? [];
  if (skills.length > 0) return skills.join(", ");
  if (profile?.headline?.trim()) return profile.headline.trim();
  return "product engineering and applied AI";
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}
