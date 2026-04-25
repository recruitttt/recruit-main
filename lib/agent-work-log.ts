import type { AgentId } from "./agents";

export type AgentWorkKind = "diff" | "keywords" | "research";

export type DiffPayload = {
  section: string;
  before: string;
  after: string;
  reason: string;
};

export type KeywordsPayload = {
  extracted: string[];
  matched: string[];
  added: string[];
  missing: string[];
  coverageBefore: number;
  coverageAfter: number;
};

export type ResearchPayload = {
  sources: string;
  insights: Array<{ text: string; tag: "tech stack" | "culture" | "growth" | "team" }>;
};

export type AgentWorkEntry = {
  id: string;
  agentId: AgentId;
  applicationId: string;
  company: string;
  role: string;
  timestamp: string;
  kind: AgentWorkKind;
  label: string;
  status: "done" | "live";
  payload: DiffPayload | KeywordsPayload | ResearchPayload;
};

export const mockAgentWorkLog: AgentWorkEntry[] = [
  {
    id: "aw-01",
    agentId: "scout",
    applicationId: "app-stripe",
    company: "Stripe",
    role: "Senior Software Engineer",
    timestamp: "just now",
    kind: "diff",
    label: "Rewriting experience bullet",
    status: "live",
    payload: {
      section: "Experience · Stripe Intern (2022)",
      before: "Developed backend services for payment processing infrastructure.",
      after:
        "Built distributed payment pipelines processing 50M transactions/day, achieving <100ms P99 latency across 12 global regions.",
      reason: "matched 'high-throughput systems' and 'latency SLOs' in job description",
    } satisfies DiffPayload,
  },
  {
    id: "aw-02",
    agentId: "mimi",
    applicationId: "app-openai",
    company: "OpenAI",
    role: "Research Engineer",
    timestamp: "1m ago",
    kind: "research",
    label: "Researched OpenAI before tailoring",
    status: "done",
    payload: {
      sources: "OpenAI blog · LinkedIn · arXiv",
      insights: [
        { text: "RLHF and post-training research team is growing rapidly", tag: "team" },
        { text: "Core stack is Python, PyTorch, CUDA. Heavy GPU infra.", tag: "tech stack" },
        { text: "Recent GPT-4o and o3 launches signal multimodal + reasoning focus", tag: "growth" },
        { text: "Mission-driven culture: safety and capability research in tension", tag: "culture" },
      ],
    } satisfies ResearchPayload,
  },
  {
    id: "aw-03",
    agentId: "scout",
    applicationId: "app-stripe",
    company: "Stripe",
    role: "Senior Software Engineer",
    timestamp: "2m ago",
    kind: "keywords",
    label: "Keyword coverage 58% → 81%",
    status: "done",
    payload: {
      extracted: [
        "distributed systems",
        "high-throughput",
        "latency SLOs",
        "payments",
        "Go",
        "Kubernetes",
        "observability",
        "incident response",
        "API design",
        "cross-functional",
      ],
      matched: ["distributed systems", "payments", "API design", "Go", "cross-functional"],
      added: ["high-throughput", "latency SLOs", "Kubernetes", "observability"],
      missing: ["incident response"],
      coverageBefore: 58,
      coverageAfter: 81,
    } satisfies KeywordsPayload,
  },
  {
    id: "aw-04",
    agentId: "mimi",
    applicationId: "app-openai",
    company: "OpenAI",
    role: "Research Engineer",
    timestamp: "3m ago",
    kind: "diff",
    label: "Tailored summary for ML research focus",
    status: "done",
    payload: {
      section: "Professional Summary",
      before: "Full-stack engineer with experience in ML systems and backend infrastructure.",
      after:
        "ML systems engineer specializing in training pipelines and RLHF infra, with experience shipping models from research to production at scale.",
      reason: "matched 'RLHF', 'training infrastructure', and 'research to production' from JD",
    } satisfies DiffPayload,
  },
  {
    id: "aw-05",
    agentId: "pip",
    applicationId: "app-figma",
    company: "Figma",
    role: "Design Engineer",
    timestamp: "4m ago",
    kind: "research",
    label: "Researched Figma before tailoring",
    status: "done",
    payload: {
      sources: "Figma blog · Config 2024 talks · LinkedIn Engineering",
      insights: [
        { text: "Design systems and component tokenization is a core engineering investment", tag: "tech stack" },
        { text: "TypeScript, React, and WebAssembly are primary frontend technologies", tag: "tech stack" },
        { text: "Engineering culture values polish, pixel-level attention, and craft", tag: "culture" },
        { text: "Recently expanded into Dev Mode and AI-assisted design tooling", tag: "growth" },
      ],
    } satisfies ResearchPayload,
  },
  {
    id: "aw-06",
    agentId: "pip",
    applicationId: "app-figma",
    company: "Figma",
    role: "Design Engineer",
    timestamp: "5m ago",
    kind: "keywords",
    label: "Keyword coverage 44% → 79%",
    status: "done",
    payload: {
      extracted: [
        "design systems",
        "component architecture",
        "TypeScript",
        "React",
        "accessibility",
        "token pipeline",
        "Storybook",
        "Figma API",
        "animation",
        "prototyping",
      ],
      matched: ["TypeScript", "React", "accessibility", "animation"],
      added: ["design systems", "component architecture", "token pipeline"],
      missing: ["Storybook", "Figma API", "prototyping"],
      coverageBefore: 44,
      coverageAfter: 79,
    } satisfies KeywordsPayload,
  },
  {
    id: "aw-07",
    agentId: "juno",
    applicationId: "app-notion",
    company: "Notion",
    role: "Product Engineer",
    timestamp: "6m ago",
    kind: "research",
    label: "Researched Notion before tailoring",
    status: "done",
    payload: {
      sources: "Notion blog · Y Combinator · Crunchbase",
      insights: [
        { text: "Series C at $10B valuation, post-Notion AI launch growth phase", tag: "growth" },
        { text: "Engineers own product areas end-to-end, no PM handoffs", tag: "culture" },
        { text: "Electron + React frontend, Node.js backend, Postgres at scale", tag: "tech stack" },
        { text: "AI team is small and moving fast, focused on editor integrations", tag: "team" },
      ],
    } satisfies ResearchPayload,
  },
  {
    id: "aw-08",
    agentId: "juno",
    applicationId: "app-notion",
    company: "Notion",
    role: "Product Engineer",
    timestamp: "7m ago",
    kind: "diff",
    label: "Reframed headline for product ownership",
    status: "done",
    payload: {
      section: "Professional Headline",
      before: "Software Engineer · Backend Systems",
      after: "Product Engineer · building user-facing features from zero to one",
      reason: "matched 'product ownership' and 'zero to one' in job description",
    } satisfies DiffPayload,
  },
  {
    id: "aw-09",
    agentId: "bodhi",
    applicationId: "app-linear",
    company: "Linear",
    role: "Software Engineer",
    timestamp: "8m ago",
    kind: "research",
    label: "Researched Linear before tailoring",
    status: "done",
    payload: {
      sources: "Linear changelog · Twitter/X · Figma community",
      insights: [
        { text: "Small team (<50 engineers), each owns a full product surface", tag: "team" },
        { text: "Obsessed with speed: sub-50ms interactions is a stated goal", tag: "culture" },
        { text: "TypeScript, React, Electron, custom sync engine (CRDT-based)", tag: "tech stack" },
        { text: "Growing enterprise segment while keeping indie-dev feel", tag: "growth" },
      ],
    } satisfies ResearchPayload,
  },
  {
    id: "aw-10",
    agentId: "bodhi",
    applicationId: "app-linear",
    company: "Linear",
    role: "Software Engineer",
    timestamp: "9m ago",
    kind: "diff",
    label: "Tailored experience for developer tooling",
    status: "done",
    payload: {
      section: "Experience · Side Project (2023)",
      before: "Built a project management tool using Next.js and Supabase.",
      after:
        "Built a real-time project tracker with optimistic UI and conflict-free sync, achieving <30ms local interactions via CRDT-based state.",
      reason: "matched 'real-time sync', 'developer experience', and 'optimistic UI' from JD",
    } satisfies DiffPayload,
  },
  {
    id: "aw-11",
    agentId: "bodhi",
    applicationId: "app-linear",
    company: "Linear",
    role: "Software Engineer",
    timestamp: "10m ago",
    kind: "keywords",
    label: "Keyword coverage 52% → 88%",
    status: "done",
    payload: {
      extracted: [
        "real-time",
        "TypeScript",
        "developer experience",
        "CRDT",
        "optimistic UI",
        "sync engine",
        "Electron",
        "performance",
        "small team",
        "product craft",
      ],
      matched: ["TypeScript", "performance", "product craft"],
      added: ["real-time", "developer experience", "optimistic UI", "CRDT"],
      missing: ["Electron", "sync engine", "small team"],
      coverageBefore: 52,
      coverageAfter: 88,
    } satisfies KeywordsPayload,
  },
  {
    id: "aw-12",
    agentId: "pip",
    applicationId: "app-figma",
    company: "Figma",
    role: "Design Engineer",
    timestamp: "11m ago",
    kind: "diff",
    label: "Added design systems bullet to experience",
    status: "done",
    payload: {
      section: "Experience · Previous Company",
      before: "Worked on frontend components and maintained the UI library.",
      after:
        "Architected a multi-brand design token pipeline serving 6 product teams, reducing component drift by 80% and cutting designer-to-engineer handoff time in half.",
      reason: "matched 'design systems', 'token pipeline', and 'cross-functional' from JD",
    } satisfies DiffPayload,
  },
  {
    id: "aw-13",
    agentId: "mimi",
    applicationId: "app-openai",
    company: "OpenAI",
    role: "Research Engineer",
    timestamp: "13m ago",
    kind: "keywords",
    label: "Keyword coverage 47% → 76%",
    status: "done",
    payload: {
      extracted: [
        "RLHF",
        "training infrastructure",
        "PyTorch",
        "distributed training",
        "Python",
        "GPU clusters",
        "model evaluation",
        "safety research",
        "research to production",
        "LLM",
      ],
      matched: ["PyTorch", "Python", "LLM", "model evaluation", "distributed training"],
      added: ["RLHF", "training infrastructure", "research to production"],
      missing: ["GPU clusters", "safety research"],
      coverageBefore: 47,
      coverageAfter: 76,
    } satisfies KeywordsPayload,
  },
  {
    id: "aw-14",
    agentId: "juno",
    applicationId: "app-notion",
    company: "Notion",
    role: "Product Engineer",
    timestamp: "15m ago",
    kind: "keywords",
    label: "Keyword coverage 55% → 83%",
    status: "done",
    payload: {
      extracted: [
        "product ownership",
        "React",
        "Node.js",
        "end-to-end",
        "zero to one",
        "user research",
        "AI features",
        "editor",
        "Postgres",
        "collaboration",
      ],
      matched: ["React", "Node.js", "Postgres", "end-to-end", "collaboration"],
      added: ["product ownership", "zero to one", "AI features"],
      missing: ["user research", "editor"],
      coverageBefore: 55,
      coverageAfter: 83,
    } satisfies KeywordsPayload,
  },
  {
    id: "aw-15",
    agentId: "scout",
    applicationId: "app-stripe",
    company: "Stripe",
    role: "Senior Software Engineer",
    timestamp: "18m ago",
    kind: "research",
    label: "Researched Stripe before tailoring",
    status: "done",
    payload: {
      sources: "Stripe blog · Stripe Sessions 2024 · LinkedIn",
      insights: [
        { text: "Stripe is investing heavily in AI-powered financial infrastructure", tag: "growth" },
        { text: "Go and Ruby are primary backend languages, TypeScript on the frontend", tag: "tech stack" },
        { text: "Culture prizes writing, documentation, and async-first decision making", tag: "culture" },
        { text: "Infra org is scaling to support Stripe's expansion into new markets", tag: "team" },
      ],
    } satisfies ResearchPayload,
  },
];
