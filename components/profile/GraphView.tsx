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
// uses_skill / wrote / received) into a single GraphData blob, render it on
// a lightweight canvas, and keep the side drawer/filter interactions local.
//

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "convex/react";

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

type PositionedGraphNode = GraphNode & {
  x: number;
  y: number;
  radius: number;
};

type PositionedGraph = {
  nodes: PositionedGraphNode[];
  edges: GraphEdge[];
};

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

  const positionedGraph = useMemo(
    () => layoutGraph(filteredGraph, size.width, size.height),
    [filteredGraph, size.height, size.width],
  );

  const handleNodeClick = useCallback((node: GraphNode) => {
    setSelectedNode(node);
  }, []);

  const handleEdgeHover = useCallback(
    (edge: GraphEdge | null, position: { x: number; y: number } | null) => {
      setHoveredEdge(edge);
      setHoverPos(position);
    },
    [],
  );

  const handleResetZoom = useCallback(() => undefined, []);

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
          <CanvasGraph
            graph={positionedGraph}
            width={size.width}
            height={size.height}
            hoveredEdge={hoveredEdge}
            onNodeClick={handleNodeClick}
            onEdgeHover={handleEdgeHover}
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

function layoutGraph(graph: GraphData, width: number, height: number): PositionedGraph {
  if (width <= 0 || height <= 0 || graph.nodes.length === 0) {
    return { nodes: [], edges: [] };
  }

  const centerX = width / 2;
  const centerY = height / 2;
  const maxRadius = Math.max(90, Math.min(width, height) / 2 - 64);
  const innerRadius = Math.max(78, maxRadius * 0.56);
  const ringCount = graph.nodes.length > 26 ? 3 : graph.nodes.length > 12 ? 2 : 1;
  const people = graph.nodes.filter((node) => node.kind === "person");
  const others = graph.nodes
    .filter((node) => node.kind !== "person")
    .sort((left, right) => nodeSortKey(left).localeCompare(nodeSortKey(right)));

  const nodes: PositionedGraphNode[] = people.map((node, index) => {
    const offset = people.length === 1 ? 0 : index * 22 - ((people.length - 1) * 22) / 2;
    return {
      ...node,
      x: centerX + offset,
      y: centerY,
      radius: Math.max(9, node.size * 1.6),
    };
  });

  others.forEach((node, index) => {
    const ring = ringCount === 1 ? 0 : index % ringCount;
    const ringRadius = ringCount === 1
      ? maxRadius * 0.78
      : innerRadius + ((maxRadius - innerRadius) * ring) / Math.max(1, ringCount - 1);
    const angle = -Math.PI / 2 + (index / Math.max(1, others.length)) * Math.PI * 2 + ring * 0.16;
    nodes.push({
      ...node,
      x: centerX + Math.cos(angle) * ringRadius,
      y: centerY + Math.sin(angle) * ringRadius,
      radius: Math.max(5, node.size * 1.35),
    });
  });

  return { nodes, edges: graph.edges };
}

function CanvasGraph({
  graph,
  width,
  height,
  hoveredEdge,
  onNodeClick,
  onEdgeHover,
}: {
  graph: PositionedGraph;
  width: number;
  height: number;
  hoveredEdge: GraphEdge | null;
  onNodeClick: (node: GraphNode) => void;
  onEdgeHover: (edge: GraphEdge | null, position: { x: number; y: number } | null) => void;
}): React.ReactElement {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const pixelRatio = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.floor(width * pixelRatio));
    canvas.height = Math.max(1, Math.floor(height * pixelRatio));
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    drawGraph(ctx, graph, width, height, hoveredEdge);
  }, [graph, height, hoveredEdge, width]);

  const handleMouseMove = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const position = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
    const node = findHitNode(graph, position.x, position.y);
    const edge = node ? null : findNearestEdge(graph, position.x, position.y);
    canvas.style.cursor = node ? "pointer" : "default";
    onEdgeHover(edge, edge ? position : null);
  }, [graph, onEdgeHover]);

  const handleClick = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const node = findHitNode(
      graph,
      event.clientX - rect.left,
      event.clientY - rect.top,
    );
    if (node) onNodeClick(node);
  }, [graph, onNodeClick]);

  return (
    <canvas
      ref={canvasRef}
      aria-label="Profile knowledge graph"
      className="block h-full w-full"
      role="img"
      onClick={handleClick}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => onEdgeHover(null, null)}
    />
  );
}

function drawGraph(
  ctx: CanvasRenderingContext2D,
  graph: PositionedGraph,
  width: number,
  height: number,
  hoveredEdge: GraphEdge | null,
): void {
  ctx.clearRect(0, 0, width, height);
  const nodesById = new Map(graph.nodes.map((node) => [node.id, node]));

  for (const edge of graph.edges) {
    const source = nodesById.get(edge.source);
    const target = nodesById.get(edge.target);
    if (!source || !target) continue;
    const active = Boolean(hoveredEdge && sameEdge(edge, hoveredEdge));
    ctx.beginPath();
    ctx.moveTo(source.x, source.y);
    ctx.lineTo(target.x, target.y);
    ctx.lineWidth = active ? 2 : 1;
    ctx.strokeStyle = active ? "rgba(15,23,42,0.52)" : "rgba(15,23,42,0.16)";
    ctx.stroke();
  }

  for (const node of graph.nodes) {
    ctx.beginPath();
    ctx.arc(node.x, node.y, node.radius + 3, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,0.78)";
    ctx.fill();

    ctx.beginPath();
    ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
    ctx.fillStyle = node.color;
    ctx.fill();
    ctx.lineWidth = node.kind === "person" ? 2 : 1.5;
    ctx.strokeStyle = "rgba(255,255,255,0.92)";
    ctx.stroke();

    if (shouldDrawLabel(node, graph.nodes.length)) {
      drawNodeLabel(ctx, node);
    }
  }
}

function drawNodeLabel(ctx: CanvasRenderingContext2D, node: PositionedGraphNode): void {
  ctx.font = "12px Inter, system-ui, -apple-system, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  const label = compactLabel(node.label, node.kind === "person" ? 28 : 18);
  const y = node.y + node.radius + 7;

  ctx.lineWidth = 4;
  ctx.strokeStyle = "rgba(255,255,255,0.92)";
  ctx.strokeText(label, node.x, y);

  ctx.fillStyle = "rgba(15,23,42,0.84)";
  ctx.fillText(label, node.x, y);
}

function shouldDrawLabel(node: PositionedGraphNode, nodeCount: number): boolean {
  if (node.kind === "person") return true;
  if (nodeCount <= 28) return true;
  return node.kind !== "skill";
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function findHitNode(graph: PositionedGraph, x: number, y: number): PositionedGraphNode | null {
  for (let index = graph.nodes.length - 1; index >= 0; index -= 1) {
    const node = graph.nodes[index];
    const distance = Math.hypot(node.x - x, node.y - y);
    if (distance <= node.radius + 6) return node;
  }
  return null;
}

function findNearestEdge(graph: PositionedGraph, x: number, y: number): GraphEdge | null {
  const nodesById = new Map(graph.nodes.map((node) => [node.id, node]));
  let nearest: { edge: GraphEdge; distance: number } | null = null;

  for (const edge of graph.edges) {
    const source = nodesById.get(edge.source);
    const target = nodesById.get(edge.target);
    if (!source || !target) continue;
    const distance = pointToSegmentDistance(x, y, source.x, source.y, target.x, target.y);
    if (distance <= 7 && (!nearest || distance < nearest.distance)) {
      nearest = { edge, distance };
    }
  }

  return nearest?.edge ?? null;
}

function pointToSegmentDistance(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  if (dx === 0 && dy === 0) return Math.hypot(px - x1, py - y1);
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

function sameEdge(a: GraphEdge, b: GraphEdge): boolean {
  return a.source === b.source && a.target === b.target && a.kind === b.kind;
}

function nodeSortKey(node: GraphNode): string {
  const order: Record<GraphNodeKind, string> = {
    project: "1",
    skill: "2",
    company: "3",
    school: "4",
    publication: "5",
    honor: "6",
    person: "0",
  };
  return `${order[node.kind]}:${node.label.toLowerCase()}`;
}

function compactLabel(value: string, maxLength: number): string {
  const cleaned = value.replace(/\s+/g, " ").trim();
  if (cleaned.length <= maxLength) return cleaned;
  return `${cleaned.slice(0, maxLength - 1).trimEnd()}…`;
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
