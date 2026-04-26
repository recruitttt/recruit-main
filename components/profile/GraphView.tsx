"use client";

//
// GraphView — interactive force-directed knowledge graph of the user's
// canonical profile + per-repo summaries.
//
// Spec: docs/superpowers/specs/2026-04-25-recruit-merge-design.md §9.2
//
// Data contract:
//   - api.userProfiles.byUser → { profile: UserProfile, ... } | null
//   - api.repoSummaries.listByUser → Array<{ repoFullName, summary, ... }>
//
// We derive nodes (person + project + company + school + skill +
// publication + honor) and edges (built / worked_at / studied_at /
// uses_skill / wrote / received) into a single GraphData blob, hand it to
// react-force-graph-2d, and let d3-force lay it out. Click a node → side
// drawer; hover an edge → tooltip; filter pills shrink the visible
// subgraph without rebuilding it from scratch.
//

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useQuery } from "convex/react";
import type {
  ForceGraphMethods,
  ForceGraphProps,
  LinkObject,
  NodeObject,
} from "react-force-graph-2d";

import { api } from "@/convex/_generated/api";
import { authClient } from "@/lib/auth-client";
import { cx } from "@/components/design-system";
import type {
  Education,
  UserProfile,
  WorkExperience,
} from "@/lib/profile";

import { GraphFilterBar } from "./GraphFilterBar";
import { NodeDrawer } from "./NodeDrawer";
import {
  EDGE_LABELS,
  NODE_COLORS,
  NODE_SIZE,
  type GraphData,
  type GraphEdge,
  type GraphFilter,
  type GraphNode,
  type GraphNodeKind,
} from "./graph-types";

// `next/dynamic` erases the generic call-signature on `react-force-graph-2d`'s
// default export (it's typed as `<NodeType, LinkType>(props) => ReactElement`
// rather than a `ComponentType<P>`). We project it back through a typed
// alias so our prop accessors stay strongly typed.
type GraphProps = ForceGraphProps<GraphNode, GraphEdge> & {
  ref?: React.MutableRefObject<
    ForceGraphMethods<GraphNode, GraphEdge> | undefined
  >;
};
const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), {
  ssr: false,
  loading: () => <GraphPlaceholder text="Loading graph engine…" />,
}) as unknown as (props: GraphProps) => React.ReactElement;

// ---------------------------------------------------------------------------
// Convex row shapes (the queries return v.any, so we type them locally).
// ---------------------------------------------------------------------------

interface ConvexUserProfileRow {
  profile?: UserProfile;
  updatedAt?: string;
}

interface ConvexRepoSummaryRow {
  repoFullName: string;
  summary?: {
    oneLineDescription?: string;
    whatItDoes?: string;
    metadataSummary?: string;
    keyTechnologies?: string[];
    accomplishments?: string[];
    starQuality?: string;
    difficulty?: string;
    userContributions?: string;
    notableImplementationDetails?: string[];
  };
  generatedAt?: string;
  generatedByModel?: string;
}

// react-force-graph mutates link source/target to point at the node objects
// after the first tick — these aliases let us reach into those mutated
// shapes from imperative ref handlers.
type GraphNodeWithCoords = NodeObject<GraphNode>;
type GraphLinkWithEnds = LinkObject<GraphNode, GraphEdge>;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function GraphView(): React.ReactElement {
  const { data: session } = authClient.useSession();
  const userId = session?.user?.id;

  const profileRow = useQuery(
    api.userProfiles.byUser,
    userId ? { userId } : "skip",
  ) as ConvexUserProfileRow | null | undefined;

  const repoRows = useQuery(
    api.repoSummaries.listByUser,
    userId ? { userId } : "skip",
  ) as ConvexRepoSummaryRow[] | undefined;

  const [filter, setFilter] = useState<GraphFilter>("all");
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [hoveredEdge, setHoveredEdge] = useState<GraphEdge | null>(null);
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(null);
  const [size, setSize] = useState<{ width: number; height: number }>({
    width: 0,
    height: 0,
  });

  const containerRef = useRef<HTMLDivElement | null>(null);
  const graphRef = useRef<
    ForceGraphMethods<GraphNodeWithCoords, GraphLinkWithEnds> | undefined
  >(undefined);

  // Track container size so the canvas matches the viewport region.
  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    const update = () => {
      const rect = node.getBoundingClientRect();
      setSize({
        width: Math.max(0, Math.floor(rect.width)),
        height: Math.max(0, Math.floor(rect.height)),
      });
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  // Build the full graph from profile + repo summaries — recomputed only
  // when those inputs actually change (Convex returns stable references
  // across re-renders when nothing changed).
  const fullGraph = useMemo<GraphData>(
    () => buildGraph(profileRow?.profile, repoRows ?? []),
    [profileRow?.profile, repoRows],
  );

  // Apply the user-selected filter.
  const filteredGraph = useMemo<GraphData>(
    () => applyFilter(fullGraph, filter),
    [fullGraph, filter],
  );

  // Counts by node kind for the legend pills.
  const nodeCounts = useMemo<Record<GraphNodeKind, number>>(
    () => countByKind(filteredGraph.nodes),
    [filteredGraph.nodes],
  );

  // react-force-graph mutates link source/target to the actual node
  // objects after the first tick. Re-cloning the data on every filter
  // change avoids that mutated state from leaking into the next graph.
  const graphData = useMemo(
    () => ({
      nodes: filteredGraph.nodes.map((n) => ({ ...n })),
      links: filteredGraph.edges.map((e) => ({ ...e })),
    }),
    [filteredGraph],
  );

  const handleNodeClick = useCallback((node: NodeObject<GraphNode>) => {
    setSelectedNode(node as GraphNode);
  }, []);

  const handleLinkHover = useCallback(
    (link: LinkObject<GraphNode, GraphEdge> | null) => {
      setHoveredEdge(link as GraphEdge | null);
      if (!link) setHoverPos(null);
    },
    [],
  );

  const handleResetZoom = useCallback(() => {
    graphRef.current?.zoomToFit(400, 40);
  }, []);

  const handleMouseMove = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (!hoveredEdge) return;
    const rect = event.currentTarget.getBoundingClientRect();
    setHoverPos({ x: event.clientX - rect.left, y: event.clientY - rect.top });
  }, [hoveredEdge]);

  // Re-fit the camera whenever the visible graph changes.
  useEffect(() => {
    if (filteredGraph.nodes.length === 0) return;
    const id = window.setTimeout(() => {
      graphRef.current?.zoomToFit(600, 60);
    }, 250);
    return () => window.clearTimeout(id);
  }, [filteredGraph]);

  const isLoading =
    profileRow === undefined || repoRows === undefined || size.width === 0;

  return (
    <div className="flex h-full w-full flex-col gap-3">
      <GraphFilterBar
        filter={filter}
        onFilterChange={setFilter}
        onResetZoom={handleResetZoom}
        nodeCounts={nodeCounts}
        visibleNodes={filteredGraph.nodes.length}
        visibleEdges={filteredGraph.edges.length}
      />

      <div
        ref={containerRef}
        onMouseMove={handleMouseMove}
        className={cx(
          "relative flex-1 overflow-hidden rounded-2xl border border-white/65 bg-gradient-to-br from-white/65 via-white/50 to-white/35",
          "shadow-[0_22px_60px_rgba(15,23,42,0.10),inset_0_1px_0_rgba(255,255,255,0.7)] backdrop-blur-2xl",
        )}
        style={{ minHeight: 480 }}
      >
        {isLoading ? (
          <GraphPlaceholder text="Building knowledge graph…" />
        ) : filteredGraph.nodes.length === 0 ? (
          <EmptyState
            hasAnyNodes={fullGraph.nodes.length > 0}
            onResetFilter={() => setFilter("all")}
          />
        ) : (
          <ForceGraph2D
            ref={graphRef}
            graphData={graphData}
            width={size.width}
            height={size.height}
            backgroundColor="rgba(255,255,255,0)"
            nodeId="id"
            nodeLabel={(n) => `${n.kind}: ${n.label}`}
            nodeColor={(n) => n.color}
            nodeRelSize={4}
            nodeVal={(n) => n.size}
            linkColor={(e) =>
              hoveredEdge && isSameEdge(e as GraphEdge, hoveredEdge)
                ? "rgba(15,23,42,0.55)"
                : "rgba(15,23,42,0.18)"
            }
            linkWidth={(e) =>
              hoveredEdge && isSameEdge(e as GraphEdge, hoveredEdge) ? 2 : 1
            }
            linkLabel={(e) => EDGE_LABELS[(e as GraphEdge).kind]}
            linkDirectionalParticles={0}
            cooldownTicks={120}
            d3VelocityDecay={0.32}
            warmupTicks={40}
            onNodeClick={handleNodeClick}
            onLinkHover={handleLinkHover}
            nodeCanvasObject={drawNode}
            nodeCanvasObjectMode={() => "after"}
          />
        )}

        {hoveredEdge && hoverPos && (
          <EdgeTooltip edge={hoveredEdge} x={hoverPos.x} y={hoverPos.y} />
        )}
      </div>

      <NodeDrawer
        open={selectedNode !== null}
        onClose={() => setSelectedNode(null)}
        title={selectedNode?.label ?? ""}
        subtitle={selectedNode ? subtitleForNode(selectedNode) : undefined}
        kind={selectedNode?.kind ?? "person"}
        color={selectedNode?.color ?? NODE_COLORS.person}
        data={selectedNode?.data ?? null}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Graph construction
// ---------------------------------------------------------------------------

function buildGraph(
  profile: UserProfile | undefined,
  repoRows: ReadonlyArray<ConvexRepoSummaryRow>,
): GraphData {
  if (!profile) return { nodes: [], edges: [] };

  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const personId = "person:self";

  nodes.push({
    id: personId,
    kind: "person",
    label: profile.name?.trim() || profile.email?.trim() || "You",
    color: NODE_COLORS.person,
    size: NODE_SIZE.person,
    data: {
      name: profile.name,
      email: profile.email,
      headline: profile.headline,
      location: profile.location,
      summary: profile.summary,
      links: profile.links,
      updatedAt: profile.updatedAt,
    },
  });

  // Skills are deduped across profile.skills + per-repo keyTechnologies.
  // We resolve every skill name to a canonical node id once.
  const skillIdByName = new Map<string, string>();
  const ensureSkill = (rawName: string): string | null => {
    const name = rawName.trim();
    if (!name) return null;
    const key = name.toLowerCase();
    const existing = skillIdByName.get(key);
    if (existing) return existing;
    const id = `skill:${key}`;
    skillIdByName.set(key, id);
    nodes.push({
      id,
      kind: "skill",
      label: name,
      color: NODE_COLORS.skill,
      size: NODE_SIZE.skill,
      data: { name, source: "merged" },
    });
    return id;
  };

  for (const skill of profile.skills ?? []) ensureSkill(skill);

  // ---- Projects: prefer rich repo summaries; fall back to UserProfile.github.topRepos
  const repoIdByFullName = new Map<string, string>();

  for (const row of repoRows) {
    if (!row?.repoFullName) continue;
    const id = `project:${row.repoFullName.toLowerCase()}`;
    repoIdByFullName.set(row.repoFullName.toLowerCase(), id);
    const summary = row.summary ?? {};
    const label = labelForRepo(row.repoFullName);
    nodes.push({
      id,
      kind: "project",
      label,
      color: NODE_COLORS.project,
      size: NODE_SIZE.project,
      data: {
        repoFullName: row.repoFullName,
        oneLineDescription: summary.oneLineDescription,
        whatItDoes: summary.whatItDoes,
        keyTechnologies: summary.keyTechnologies,
        starQuality: summary.starQuality,
        difficulty: summary.difficulty,
        accomplishments: summary.accomplishments,
        userContributions: summary.userContributions,
        generatedAt: row.generatedAt,
        generatedByModel: row.generatedByModel,
      },
    });
    edges.push({ source: personId, target: id, kind: "built" });

    for (const tech of summary.keyTechnologies ?? []) {
      const skillId = ensureSkill(tech);
      if (skillId) edges.push({ source: id, target: skillId, kind: "uses_skill" });
    }
  }

  // Fallback: profile.github.topRepos for repos with no rich summary yet.
  for (const repo of profile.github?.topRepos ?? []) {
    const fullName = inferRepoFullName(repo.url, repo.name);
    if (!fullName) continue;
    const key = fullName.toLowerCase();
    if (repoIdByFullName.has(key)) continue;
    const id = `project:${key}`;
    repoIdByFullName.set(key, id);
    nodes.push({
      id,
      kind: "project",
      label: repo.name || fullName,
      color: NODE_COLORS.project,
      size: NODE_SIZE.project,
      data: {
        repoFullName: fullName,
        description: repo.description,
        language: repo.language,
        stars: repo.stars,
        url: repo.url,
      },
    });
    edges.push({ source: personId, target: id, kind: "built" });
    if (repo.language) {
      const skillId = ensureSkill(repo.language);
      if (skillId) edges.push({ source: id, target: skillId, kind: "uses_skill" });
    }
  }

  // ---- Companies: dedupe by lowercased name
  const companyIdByName = new Map<string, string>();
  for (const exp of profile.experience ?? []) {
    const name = (exp.company ?? "").trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (!companyIdByName.has(key)) {
      const id = `company:${key}`;
      companyIdByName.set(key, id);
      nodes.push({
        id,
        kind: "company",
        label: name,
        color: NODE_COLORS.company,
        size: NODE_SIZE.company,
        data: companyDataFromExperience(exp),
      });
    }
    const companyId = companyIdByName.get(key)!;
    edges.push({
      source: personId,
      target: companyId,
      kind: "worked_at",
      detail: experienceDetail(exp),
    });
  }

  // ---- Schools: dedupe by lowercased name
  const schoolIdByName = new Map<string, string>();
  for (const edu of profile.education ?? []) {
    const name = (edu.school ?? "").trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (!schoolIdByName.has(key)) {
      const id = `school:${key}`;
      schoolIdByName.set(key, id);
      nodes.push({
        id,
        kind: "school",
        label: name,
        color: NODE_COLORS.school,
        size: NODE_SIZE.school,
        data: schoolDataFromEducation(edu),
      });
    }
    const schoolId = schoolIdByName.get(key)!;
    edges.push({
      source: personId,
      target: schoolId,
      kind: "studied_at",
      detail: educationDetail(edu),
    });
  }

  // ---- Publications + honors: surfaced via the suggestion / profile blob.
  // The canonical UserProfile shape (lib/profile.ts) does not (yet) carry
  // typed publication/honor arrays; LinkedIn populates them via the
  // suggestion buffer keyed by `linkedin.publications` / `linkedin.honors`
  // until the profile schema absorbs them. Until then we look in two
  // places: (a) suggestions whose field path mentions publications/honors,
  // and (b) the experimental `profile.linkedin` blob if present.
  const linkedinBlob = (profile as UserProfile & {
    linkedin?: {
      publications?: Array<Record<string, unknown>>;
      honors?: Array<Record<string, unknown>>;
    };
  }).linkedin;

  for (const pub of linkedinBlob?.publications ?? []) {
    const id = ensurePublicationNode(nodes, pub);
    if (id) edges.push({ source: personId, target: id, kind: "wrote" });
  }
  for (const hon of linkedinBlob?.honors ?? []) {
    const id = ensureHonorNode(nodes, hon);
    if (id) edges.push({ source: personId, target: id, kind: "received" });
  }

  for (const suggestion of profile.suggestions ?? []) {
    if (!suggestion?.field) continue;
    if (suggestion.field.toLowerCase().includes("publication")) {
      const value = unwrapSuggestionValue(suggestion.suggestedValue);
      for (const pub of value) {
        const id = ensurePublicationNode(nodes, pub);
        if (id) edges.push({ source: personId, target: id, kind: "wrote" });
      }
    } else if (suggestion.field.toLowerCase().includes("honor")) {
      const value = unwrapSuggestionValue(suggestion.suggestedValue);
      for (const hon of value) {
        const id = ensureHonorNode(nodes, hon);
        if (id) edges.push({ source: personId, target: id, kind: "received" });
      }
    }
  }

  return { nodes, edges };
}

// ---------------------------------------------------------------------------
// Filtering
// ---------------------------------------------------------------------------

const AI_KEYWORDS = [
  "ai",
  "ml",
  "machine learning",
  "neural",
  "llm",
  "gpt",
  "claude",
  "openai",
  "anthropic",
  "transformer",
  "agent",
  "rag",
  "embedding",
  "diffusion",
  "deep learning",
  "computer vision",
  "nlp",
];

const RESEARCH_KEYWORDS = [
  "research",
  "paper",
  "thesis",
  "study",
  "publication",
  "academic",
  "lab",
  "phd",
  "investigation",
  "experiment",
  "proof",
];

function applyFilter(graph: GraphData, filter: GraphFilter): GraphData {
  if (filter === "all" || graph.nodes.length === 0) return graph;

  const personIds = new Set(
    graph.nodes.filter((n) => n.kind === "person").map((n) => n.id),
  );
  const keep = new Set<string>(personIds);

  if (filter === "ai") {
    for (const node of graph.nodes) {
      if (matchesKeywords(node, AI_KEYWORDS)) keep.add(node.id);
    }
  } else if (filter === "research") {
    for (const node of graph.nodes) {
      if (
        node.kind === "publication" ||
        node.kind === "school" ||
        matchesKeywords(node, RESEARCH_KEYWORDS)
      ) {
        keep.add(node.id);
      }
    }
  } else if (filter === "recent") {
    for (const node of graph.nodes) {
      if (isRecent(node)) keep.add(node.id);
    }
  }

  // Pull in skill nodes that any kept project still uses, so the picture
  // stays connected after filtering.
  const keptProjects = graph.nodes.filter((n) => keep.has(n.id) && n.kind === "project");
  if (keptProjects.length > 0) {
    const projectIds = new Set(keptProjects.map((p) => p.id));
    for (const edge of graph.edges) {
      if (edge.kind === "uses_skill" && projectIds.has(String(edge.source))) {
        keep.add(String(edge.target));
      }
    }
  }

  const nodes = graph.nodes.filter((n) => keep.has(n.id));
  const edges = graph.edges.filter(
    (e) => keep.has(String(e.source)) && keep.has(String(e.target)),
  );
  return { nodes, edges };
}

function matchesKeywords(node: GraphNode, keywords: ReadonlyArray<string>): boolean {
  const haystack = textForNode(node).toLowerCase();
  return keywords.some((kw) => haystack.includes(kw));
}

function textForNode(node: GraphNode): string {
  const bits: string[] = [node.label];
  for (const value of Object.values(node.data)) {
    if (typeof value === "string") bits.push(value);
    else if (Array.isArray(value)) {
      for (const item of value) {
        if (typeof item === "string") bits.push(item);
      }
    }
  }
  return bits.join(" ");
}

function isRecent(node: GraphNode): boolean {
  // Look at any string field on the node that contains a 4-digit year >= 2025.
  for (const value of Object.values(node.data)) {
    if (typeof value !== "string") continue;
    const match = value.match(/\b(20\d{2})\b/);
    if (match) {
      const year = parseInt(match[1], 10);
      if (year >= 2025) return true;
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// Canvas rendering
// ---------------------------------------------------------------------------

function drawNode(
  rawNode: NodeObject<GraphNode>,
  ctx: CanvasRenderingContext2D,
  globalScale: number,
): void {
  const node = rawNode as GraphNode & { x?: number; y?: number };
  if (typeof node.x !== "number" || typeof node.y !== "number") return;
  const fontSize = Math.max(8, 12 / globalScale);
  // Suppress labels when zoomed out very far on big graphs.
  if (fontSize < 7) return;
  ctx.font = `${fontSize}px Inter, system-ui, -apple-system, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";

  const label = node.label;
  const offsetY = (node.size ?? NODE_SIZE.skill) / globalScale + 2;

  // Soft white halo for legibility against the gradient background.
  ctx.lineWidth = 3 / globalScale;
  ctx.strokeStyle = "rgba(255,255,255,0.9)";
  ctx.strokeText(label, node.x, node.y + offsetY);

  ctx.fillStyle = "rgba(15,23,42,0.85)";
  ctx.fillText(label, node.x, node.y + offsetY);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isSameEdge(a: GraphEdge, b: GraphEdge): boolean {
  const aSrc = typeof a.source === "string" ? a.source : (a.source as { id?: string })?.id ?? "";
  const aTgt = typeof a.target === "string" ? a.target : (a.target as { id?: string })?.id ?? "";
  const bSrc = typeof b.source === "string" ? b.source : (b.source as { id?: string })?.id ?? "";
  const bTgt = typeof b.target === "string" ? b.target : (b.target as { id?: string })?.id ?? "";
  return aSrc === bSrc && aTgt === bTgt && a.kind === b.kind;
}

function countByKind(nodes: ReadonlyArray<GraphNode>): Record<GraphNodeKind, number> {
  const counts: Record<GraphNodeKind, number> = {
    person: 0,
    project: 0,
    company: 0,
    school: 0,
    skill: 0,
    publication: 0,
    honor: 0,
  };
  for (const node of nodes) counts[node.kind] += 1;
  return counts;
}

function labelForRepo(fullName: string): string {
  const slashIdx = fullName.indexOf("/");
  return slashIdx === -1 ? fullName : fullName.slice(slashIdx + 1);
}

function inferRepoFullName(url: string | undefined, name: string | undefined): string | null {
  if (url) {
    const match = url.match(/github\.com\/([^/]+\/[^/?#]+)/i);
    if (match) return match[1];
  }
  return name?.trim() || null;
}

function companyDataFromExperience(exp: WorkExperience): Record<string, unknown> {
  return {
    company: exp.company,
    title: exp.title,
    startDate: exp.startDate,
    endDate: exp.endDate,
    description: exp.description,
    location: exp.location,
  };
}

function schoolDataFromEducation(edu: Education): Record<string, unknown> {
  return {
    school: edu.school,
    degree: edu.degree,
    field: edu.field,
    startDate: edu.startDate,
    endDate: edu.endDate,
  };
}

function experienceDetail(exp: WorkExperience): string {
  const range = [exp.startDate, exp.endDate].filter(Boolean).join(" – ");
  const parts = [exp.title, range].filter(Boolean);
  return parts.join(" · ");
}

function educationDetail(edu: Education): string {
  const range = [edu.startDate, edu.endDate].filter(Boolean).join(" – ");
  const parts = [edu.degree, edu.field, range].filter(Boolean);
  return parts.join(" · ");
}

function ensurePublicationNode(
  nodes: GraphNode[],
  pub: Record<string, unknown>,
): string | null {
  const title = stringField(pub, ["title", "name"]);
  if (!title) return null;
  const id = `publication:${title.toLowerCase()}`;
  if (nodes.some((n) => n.id === id)) return id;
  nodes.push({
    id,
    kind: "publication",
    label: title,
    color: NODE_COLORS.publication,
    size: NODE_SIZE.publication,
    data: pub,
  });
  return id;
}

function ensureHonorNode(
  nodes: GraphNode[],
  hon: Record<string, unknown>,
): string | null {
  const title = stringField(hon, ["title", "name"]);
  if (!title) return null;
  const id = `honor:${title.toLowerCase()}`;
  if (nodes.some((n) => n.id === id)) return id;
  nodes.push({
    id,
    kind: "honor",
    label: title,
    color: NODE_COLORS.honor,
    size: NODE_SIZE.honor,
    data: hon,
  });
  return id;
}

function stringField(obj: Record<string, unknown>, keys: ReadonlyArray<string>): string {
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === "string" && value.trim().length > 0) return value.trim();
  }
  return "";
}

function unwrapSuggestionValue(value: unknown): Array<Record<string, unknown>> {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.filter(
      (v): v is Record<string, unknown> => v !== null && typeof v === "object",
    );
  }
  if (typeof value === "object") return [value as Record<string, unknown>];
  return [];
}

function subtitleForNode(node: GraphNode): string | undefined {
  const data = node.data;
  if (node.kind === "person") {
    return stringField(data, ["headline", "email", "location"]) || undefined;
  }
  if (node.kind === "project") {
    return stringField(data, ["repoFullName", "oneLineDescription", "description"]) || undefined;
  }
  if (node.kind === "company") {
    return stringField(data, ["title", "location"]) || undefined;
  }
  if (node.kind === "school") {
    return stringField(data, ["degree", "field"]) || undefined;
  }
  if (node.kind === "publication") {
    return stringField(data, ["venue", "date"]) || undefined;
  }
  if (node.kind === "honor") {
    return stringField(data, ["issuer", "date"]) || undefined;
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Subviews
// ---------------------------------------------------------------------------

function GraphPlaceholder({ text }: { text: string }): React.ReactElement {
  return (
    <div className="flex h-full w-full items-center justify-center">
      <span className="rounded-full border border-white/65 bg-white/55 px-4 py-1.5 text-[12px] font-medium text-slate-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
        {text}
      </span>
    </div>
  );
}

function EmptyState({
  hasAnyNodes,
  onResetFilter,
}: {
  hasAnyNodes: boolean;
  onResetFilter: () => void;
}): React.ReactElement {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-3 p-8 text-center">
      <p className="max-w-sm text-sm text-slate-600">
        {hasAnyNodes
          ? "No nodes match the current filter."
          : "Sign in with GitHub or paste a LinkedIn URL during onboarding to populate your graph."}
      </p>
      {hasAnyNodes && (
        <button
          type="button"
          onClick={onResetFilter}
          className="h-8 rounded-full border border-white/70 bg-white/65 px-3 text-[12px] font-semibold text-slate-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.78)] transition hover:bg-white/82"
        >
          Show all nodes
        </button>
      )}
    </div>
  );
}

function EdgeTooltip({
  edge,
  x,
  y,
}: {
  edge: GraphEdge;
  x: number;
  y: number;
}): React.ReactElement {
  return (
    <div
      className="pointer-events-none absolute z-10 max-w-xs -translate-x-1/2 -translate-y-full rounded-lg border border-white/70 bg-white/90 px-2.5 py-1.5 text-[11px] font-medium text-slate-700 shadow-[0_10px_22px_rgba(15,23,42,0.18),inset_0_1px_0_rgba(255,255,255,0.85)] backdrop-blur-xl"
      style={{ left: x, top: y - 8 }}
    >
      <span className="font-semibold capitalize text-slate-900">
        {EDGE_LABELS[edge.kind]}
      </span>
      {edge.detail && <span className="ml-1 text-slate-500">{edge.detail}</span>}
    </div>
  );
}
