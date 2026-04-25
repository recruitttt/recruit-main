import type { UserProfile } from "@/lib/profile";

export const DEMO_PROFILE: UserProfile = {
  name: "Demo Candidate",
  email: "demo@example.com",
  location: "San Francisco, CA",
  headline: "Full-stack product engineer",
  summary:
    "Product-minded engineer with experience building TypeScript, React, Node.js, infrastructure, and applied AI systems.",
  links: {
    github: "https://github.com/demo",
    linkedin: "https://linkedin.com/in/demo",
  },
  experience: [
    {
      company: "Nimbus Labs",
      title: "Software Engineer",
      location: "San Francisco, CA",
      startDate: "2023",
      description:
        "Built React and Node.js applications, data pipelines, internal automation, and cloud infrastructure for high-growth product teams.",
    },
    {
      company: "Atlas Systems",
      title: "Frontend Engineer",
      location: "Remote",
      startDate: "2021",
      endDate: "2023",
      description:
        "Owned customer-facing TypeScript interfaces, API integrations, performance work, and design system components.",
    },
  ],
  education: [
    {
      school: "State University",
      degree: "BS",
      field: "Computer Science",
      endDate: "2021",
    },
  ],
  skills: [
    "TypeScript",
    "React",
    "Next.js",
    "Node.js",
    "PostgreSQL",
    "AWS",
    "Docker",
    "API design",
    "AI tooling",
  ],
  prefs: {
    roles: ["Software Engineer", "Product Engineer"],
    locations: ["Remote", "San Francisco"],
  },
  provenance: {},
  log: [
    {
      at: "2026-04-25T00:00:00.000Z",
      source: "manual",
      label: "Built-in demo profile",
    },
  ],
  updatedAt: "2026-04-25T00:00:00.000Z",
};

export function isProfileUsable(profile: UserProfile | undefined): profile is UserProfile {
  return Boolean(profile?.name && profile.email && profile.experience.length > 0);
}
