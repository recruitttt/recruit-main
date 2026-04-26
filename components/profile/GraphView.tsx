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

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "convex/react";
import type {
  ForceGraphMethods,
  ForceGraphProps,
  LinkObject,
  NodeObject,
} from "react-force-graph-2d";

import { api } from "@/convex/_generated/api";
import { cx } from "@/components/design-system";
import type {
  Education,
  ProfileLinks,
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
  type GraphEdgeKind,
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

type ForceNode = GraphNode & {
  id: string;
  val: number;
  x?: number;
  y?: number;
  fx?: number;
  fy?: number;
};

type ForceLink = Omit<GraphEdge, "source" | "target"> & {
  id: string;
  source: string | ForceNode;
  target: string | ForceNode;
};

type ForceGraphNode = NodeObject<ForceNode>;
type ForceGraphLink = LinkObject<ForceNode, ForceLink>;
type ForceGraphHandle = ForceGraphMethods<ForceGraphNode, ForceGraphLink>;

type ForceGraphData = {
  nodes: ForceNode[];
  links: ForceLink[];
};

const CLUSTER_ANCHORS: Record<GraphNodeKind, { x: number; y: number }> = {
  person: { x: 0, y: 0 },
  project: { x: -118, y: 10 },
  skill: { x: 136, y: 36 },
  company: { x: -28, y: -128 },
  school: { x: 112, y: -106 },
  link: { x: -150, y: 118 },
  publication: { x: 34, y: 142 },
  honor: { x: 158, y: 112 },
};

const CLUSTER_SPREAD: Record<GraphNodeKind, number> = {
  person: 0,
  project: 68,
  skill: 82,
  company: 48,
  school: 42,
  link: 36,
  publication: 42,
  honor: 36,
};

type ForceGraphLoaderProps = ForceGraphProps<ForceGraphNode, ForceGraphLink> & {
  graphRef: React.MutableRefObject<ForceGraphHandle | undefined>;
};

const ForceGraph2D = dynamic<ForceGraphLoaderProps>(
  async () => {
    const ForceGraph = (await import("react-force-graph-2d")).default;
    return function ForceGraphWithRef({
      graphRef,
      ...props
    }: ForceGraphLoaderProps): React.ReactElement {
      return <ForceGraph {...props} ref={graphRef} />;
    };
  },
  { ssr: false },
);

export interface GraphViewProps {
  userId: string;
  active: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function GraphView({ userId, active }: GraphViewProps): React.ReactElement {
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
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [hoveredEdge, setHoveredEdge] = useState<GraphEdge | null>(null);
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(null);
  const [size, setSize] = useState<{ width: number; height: number }>({
    width: 0,
    height: 0,
  });

  const containerRef = useRef<HTMLDivElement | null>(null);
  const graphRef = useRef<ForceGraphHandle | undefined>(undefined);
  const pointerRef = useRef<{ x: number; y: number } | null>(null);

  // Track container size so the canvas matches the viewport region.
  useEffect(() => {
    const node = containerRef.current;
    if (!node || !active) return;
    let frame = 0;
    const update = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const rect = node.getBoundingClientRect();
        const nextSize = {
          width: Math.max(0, Math.floor(rect.width)),
          height: Math.max(0, Math.floor(rect.height)),
        };
        setSize((previous) =>
          previous.width === nextSize.width && previous.height === nextSize.height
            ? previous
            : nextSize,
        );
      });
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    window.addEventListener("resize", update);
    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [active]);

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

  const forceGraphData = useMemo(
    () => toForceGraphData(filteredGraph),
    [filteredGraph],
  );

  const handleNodeClick = useCallback((node: GraphNode) => {
    setSelectedNode(node);
  }, []);

  const handlePointerMove = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    pointerRef.current = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
  }, []);

  const handleLinkHover = useCallback((link: ForceGraphLink | null) => {
    if (!link) {
      setHoveredEdge(null);
      setHoverPos(null);
      return;
    }
    setHoveredEdge(edgeFromForceLink(link));
    setHoverPos(pointerRef.current);
  }, []);

  const handleResetZoom = useCallback(() => {
    graphRef.current?.zoomToFit(360, 48);
  }, []);

  useEffect(() => {
    if (!active || size.width === 0 || size.height === 0 || forceGraphData.nodes.length === 0) {
      return;
    }
    const timeout = window.setTimeout(() => {
      graphRef.current?.zoomToFit(480, 56);
    }, 120);
    return () => window.clearTimeout(timeout);
  }, [active, filter, forceGraphData, size.height, size.width]);

  const isLoading =
    profileRow === undefined ||
    repoRows === undefined ||
    (active && (size.width === 0 || size.height === 0));

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
          "relative overflow-hidden rounded-[28px] border border-white/70 bg-[#eef4eb]/70",
          "shadow-[0_28px_80px_rgba(45,69,50,0.14),inset_0_1px_0_rgba(255,255,255,0.86)] backdrop-blur-2xl",
        )}
        style={{ height: "clamp(520px, 68vh, 820px)" }}
        onMouseMove={handlePointerMove}
        onMouseLeave={() => {
          pointerRef.current = null;
          handleLinkHover(null);
        }}
      >
        <ConstellationBackdrop />
        {isLoading ? (
          <GraphPlaceholder text="Mapping profile constellation..." />
        ) : filteredGraph.nodes.length === 0 ? (
          <EmptyState
            hasAnyNodes={fullGraph.nodes.length > 0}
            onResetFilter={() => setFilter("all")}
          />
        ) : (
          <ForceGraphCanvas
            graphRef={graphRef}
            graphData={forceGraphData}
            width={size.width}
            height={size.height}
            selectedNodeId={selectedNode?.id ?? null}
            hoveredNodeId={hoveredNodeId}
            hoveredEdge={hoveredEdge}
            onNodeClick={handleNodeClick}
            onNodeHover={setHoveredNodeId}
            onLinkHover={handleLinkHover}
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

  // ---- Source/profile links: make saved links visible as graph connections.
  const linkIdByKey = new Map<keyof ProfileLinks, string>();
  for (const link of profileLinkNodes(profile.links)) {
    const id = ensureLinkNode(nodes, link);
    linkIdByKey.set(link.key, id);
    edges.push({
      source: personId,
      target: id,
      kind: "links_to",
      detail: link.platform,
    });
  }

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

  for (const skill of profile.skills ?? []) {
    const skillId = ensureSkill(skill);
    if (skillId) {
      edges.push({
        source: personId,
        target: skillId,
        kind: "uses_skill",
        detail: "profile skill",
      });
    }
  }

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
    const githubLinkId = linkIdByKey.get("github");
    if (githubLinkId) {
      edges.push({ source: githubLinkId, target: id, kind: "links_to", detail: "repository" });
    }

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
    const githubLinkId = linkIdByKey.get("github");
    if (githubLinkId) {
      edges.push({ source: githubLinkId, target: id, kind: "links_to", detail: "repository" });
    }
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

  return normalizeGraph(nodes, edges);
}

function normalizeGraph(
  nodes: ReadonlyArray<GraphNode>,
  edges: ReadonlyArray<GraphEdge>,
): GraphData {
  const nodesById = new Map<string, GraphNode>();
  for (const node of nodes) {
    if (!nodesById.has(node.id)) nodesById.set(node.id, node);
  }

  const validIds = new Set(nodesById.keys());
  const seenEdges = new Set<string>();
  const dedupedEdges: GraphEdge[] = [];
  for (const edge of edges) {
    if (!validIds.has(edge.source) || !validIds.has(edge.target)) continue;
    const key = `${edge.source}->${edge.target}:${edge.kind}:${edge.detail ?? ""}`;
    if (seenEdges.has(key)) continue;
    seenEdges.add(key);
    dedupedEdges.push(edge);
  }

  return {
    nodes: [...nodesById.values()],
    edges: dedupedEdges,
  };
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

function ForceGraphCanvas({
  graphRef,
  graphData,
  width,
  height,
  selectedNodeId,
  hoveredNodeId,
  hoveredEdge,
  onNodeClick,
  onNodeHover,
  onLinkHover,
}: {
  graphRef: React.MutableRefObject<ForceGraphHandle | undefined>;
  graphData: ForceGraphData;
  width: number;
  height: number;
  selectedNodeId: string | null;
  hoveredNodeId: string | null;
  hoveredEdge: GraphEdge | null;
  onNodeClick: (node: GraphNode) => void;
  onNodeHover: (nodeId: string | null) => void;
  onLinkHover: (link: ForceGraphLink | null) => void;
}): React.ReactElement {
  const nodeCount = graphData.nodes.length;
  const activeNodeId = hoveredNodeId ?? selectedNodeId;

  const focusNodeIds = useMemo(() => {
    const ids = new Set<string>();
    if (activeNodeId) ids.add(activeNodeId);
    if (hoveredEdge) {
      ids.add(hoveredEdge.source);
      ids.add(hoveredEdge.target);
    }

    for (const link of graphData.links) {
      const [sourceId, targetId] = forceLinkEndpointIds(link);
      if (activeNodeId && (sourceId === activeNodeId || targetId === activeNodeId)) {
        ids.add(sourceId);
        ids.add(targetId);
      }
    }

    return ids.size > 0 ? ids : null;
  }, [activeNodeId, graphData.links, hoveredEdge]);

  const activeLinkIds = useMemo(() => {
    const ids = new Set<string>();
    if (!activeNodeId && !hoveredEdge) return ids;

    for (const link of graphData.links) {
      const [sourceId, targetId] = forceLinkEndpointIds(link);
      if (activeNodeId && (sourceId === activeNodeId || targetId === activeNodeId)) {
        ids.add(link.id);
        continue;
      }
      if (hoveredEdge && sameEdge(edgeFromForceLink(link), hoveredEdge)) {
        ids.add(link.id);
      }
    }

    return ids;
  }, [activeNodeId, graphData.links, hoveredEdge]);

  return (
    <div
      className="absolute inset-0 z-10"
      role="img"
      aria-label="Profile knowledge graph"
    >
      <ForceGraph2D
        graphRef={graphRef}
        graphData={graphData}
        width={width}
        height={height}
        backgroundColor="rgba(255,255,255,0)"
        nodeId="id"
        nodeVal={(node) => node.val}
        nodeRelSize={4}
        nodeColor={(node) => node.color}
        nodeLabel={(node) => nodeTooltip(node)}
        nodeCanvasObjectMode={() => "replace"}
        nodeCanvasObject={(node, ctx, globalScale) => {
          const focused = focusNodeIds?.has(node.id) ?? false;
          drawForceNode(node, ctx, globalScale, nodeCount, {
            hovered: hoveredNodeId === node.id,
            selected: selectedNodeId === node.id,
            related: Boolean(focusNodeIds && focused && node.id !== activeNodeId),
            dimmed: Boolean(focusNodeIds && !focused),
          });
        }}
        nodePointerAreaPaint={paintNodePointerArea}
        linkSource="source"
        linkTarget="target"
        linkColor={(link) => {
          const isHovered = Boolean(hoveredEdge && sameEdge(edgeFromForceLink(link), hoveredEdge));
          if (isHovered) return "rgba(47,122,86,0.62)";
          if (activeLinkIds.has(link.id)) return "rgba(47,122,86,0.34)";
          if (focusNodeIds) return "rgba(67,87,73,0.055)";
          return "rgba(67,87,73,0.15)";
        }}
        linkWidth={(link) => {
          if (hoveredEdge && sameEdge(edgeFromForceLink(link), hoveredEdge)) return 1.65;
          if (activeLinkIds.has(link.id)) return 1.15;
          return focusNodeIds ? 0.55 : 0.72;
        }}
        linkLabel={(link) => linkTooltip(link)}
        linkHoverPrecision={6}
        onNodeClick={(node) => onNodeClick(node)}
        onNodeHover={(node) => onNodeHover(node?.id ?? null)}
        onLinkHover={onLinkHover}
        showPointerCursor={(object) => Boolean(object)}
        enableNodeDrag
        enablePanInteraction
        enablePointerInteraction
        enableZoomInteraction
        minZoom={0.18}
        maxZoom={3.2}
        cooldownTicks={80}
        d3AlphaDecay={0.035}
        d3VelocityDecay={0.34}
      />
    </div>
  );
}

function toForceGraphData(graph: GraphData): ForceGraphData {
  const orderedNodes = [...graph.nodes].sort((left, right) =>
    nodeSortKey(left).localeCompare(nodeSortKey(right)),
  );
  const kindCounts = countByKind(orderedNodes);
  const kindIndices: Record<GraphNodeKind, number> = {
    person: 0,
    project: 0,
    company: 0,
    school: 0,
    skill: 0,
    link: 0,
    publication: 0,
    honor: 0,
  };
  const nodes = orderedNodes.map((node, index): ForceNode => {
    const kindIndex = kindIndices[node.kind]++;
    const position = initialNodePosition(node, kindIndex, kindCounts[node.kind], index);
    return {
      ...node,
      val: forceNodeValue(node),
      x: position.x,
      y: position.y,
      ...(node.kind === "person" ? { fx: 0, fy: 0 } : {}),
    };
  });

  const nodeIds = new Set(nodes.map((node) => node.id));
  const links = graph.edges
    .filter((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target))
    .map((edge, index): ForceLink => ({
      id: `${edge.source}->${edge.target}:${edge.kind}:${index}`,
      source: edge.source,
      target: edge.target,
      kind: edge.kind,
      detail: edge.detail,
    }));

  return { nodes, links };
}

function initialNodePosition(
  node: GraphNode,
  kindIndex: number,
  kindTotal: number,
  absoluteIndex: number,
): { x: number; y: number } {
  if (node.kind === "person") return { x: 0, y: 0 };

  const anchor = CLUSTER_ANCHORS[node.kind];
  const spread = CLUSTER_SPREAD[node.kind];
  const total = Math.max(1, kindTotal);
  const turn = total === 1 ? 0.18 : kindIndex / total;
  const angle = -Math.PI / 2 + turn * Math.PI * 2;
  const ring = 12 + (kindIndex % 3) * (node.kind === "skill" ? 14 : 10);
  const jitter = stableJitter(`${node.id}:${absoluteIndex}`) * 10;

  return {
    x: anchor.x + Math.cos(angle) * (spread * 0.52 + ring + jitter),
    y: anchor.y + Math.sin(angle) * (spread * 0.42 + ring - jitter * 0.4),
  };
}

function stableJitter(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return (hash % 1000) / 1000 - 0.5;
}

function forceNodeValue(node: GraphNode): number {
  if (node.kind === "person") return 6.2;
  if (node.kind === "project") return 3.8;
  if (node.kind === "company" || node.kind === "school") return 3.2;
  if (node.kind === "publication" || node.kind === "honor") return 2.8;
  if (node.kind === "link") return 2.6;
  return 2.05;
}

function drawForceNode(
  node: ForceGraphNode,
  ctx: CanvasRenderingContext2D,
  globalScale: number,
  nodeCount: number,
  state: { hovered: boolean; selected: boolean; related: boolean; dimmed: boolean },
): void {
  const x = node.x ?? 0;
  const y = node.y ?? 0;
  const radius = nodeRadius(node);
  const isActive = state.hovered || state.selected;
  const isEmphasized = isActive || state.related;
  const activeLabel = isEmphasized || shouldDrawForceLabel(node, nodeCount);
  const nodeColor = normalizeHexColor(node.color);
  const mark = nodeTypeMark(node.kind);

  ctx.save();
  ctx.globalAlpha = state.dimmed ? 0.28 : 1;

  drawNodeShape(ctx, node, x, y, radius + (isActive ? 1.15 : 0), {
    fill: colorWithAlpha(nodeColor, state.dimmed ? 0.54 : 0.86),
    halo: colorWithAlpha(nodeColor, isActive ? 0.24 : state.related ? 0.16 : 0.095),
    stroke: isActive ? "rgba(255,255,255,0.98)" : "rgba(255,255,255,0.8)",
    selected: state.selected,
    elevated: isEmphasized,
  });

  if (mark) {
    drawNodeMark(ctx, mark, x, y, radius, node.kind);
  }

  if (activeLabel && !state.dimmed) {
    drawForceLabel(ctx, node, x, y + radius + (isActive ? 11 : 8), globalScale, isEmphasized);
  }
  ctx.restore();
}

function drawNodeShape(
  ctx: CanvasRenderingContext2D,
  node: GraphNode,
  x: number,
  y: number,
  radius: number,
  paint: { fill: string; halo: string; stroke: string; selected: boolean; elevated: boolean },
): void {
  const shape = nodeShape(node.kind);
  const nodeColor = normalizeHexColor(node.color);

  ctx.save();
  ctx.shadowColor = paint.halo;
  ctx.shadowBlur = paint.elevated ? 18 : 9;
  ctx.fillStyle = paint.halo;
  drawShapePath(ctx, shape, x, y, radius + (paint.elevated ? 5 : 3));
  ctx.fill();

  if (node.kind === "person") {
    ctx.shadowBlur = 0;
    ctx.lineWidth = 1.1;
    ctx.strokeStyle = colorWithAlpha(nodeColor, paint.elevated ? 0.28 : 0.18);
    ctx.beginPath();
    ctx.arc(x, y, radius + 8.5, 0, Math.PI * 2);
    ctx.stroke();
  }

  const gradient = ctx.createRadialGradient(
    x - radius * 0.35,
    y - radius * 0.45,
    radius * 0.2,
    x,
    y,
    radius * 1.4,
  );
  gradient.addColorStop(0, "rgba(255,255,255,0.92)");
  gradient.addColorStop(0.28, paint.fill);
  gradient.addColorStop(1, colorWithAlpha(nodeColor, 0.68));

  ctx.shadowBlur = 0;
  drawShapePath(ctx, shape, x, y, radius);
  ctx.fillStyle = gradient;
  ctx.fill();
  ctx.lineWidth = paint.selected ? 1.8 : 1.05;
  ctx.strokeStyle = paint.stroke;
  ctx.stroke();

  ctx.globalAlpha = node.kind === "skill" ? 0.22 : 0.32;
  ctx.beginPath();
  ctx.ellipse(
    x - radius * 0.25,
    y - radius * 0.34,
    radius * 0.42,
    radius * 0.2,
    -0.35,
    0,
    Math.PI * 2,
  );
  ctx.fillStyle = "rgba(255,255,255,0.88)";
  ctx.fill();
  ctx.restore();
}

function drawShapePath(
  ctx: CanvasRenderingContext2D,
  shape: "circle" | "squircle" | "diamond",
  x: number,
  y: number,
  radius: number,
): void {
  if (shape === "circle") {
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    return;
  }

  if (shape === "diamond") {
    ctx.beginPath();
    ctx.moveTo(x, y - radius * 1.08);
    ctx.lineTo(x + radius * 1.08, y);
    ctx.lineTo(x, y + radius * 1.08);
    ctx.lineTo(x - radius * 1.08, y);
    ctx.closePath();
    return;
  }

  roundRect(
    ctx,
    x - radius * 1.05,
    y - radius * 0.86,
    radius * 2.1,
    radius * 1.72,
    radius * 0.45,
  );
}

function drawNodeMark(
  ctx: CanvasRenderingContext2D,
  mark: string,
  x: number,
  y: number,
  radius: number,
  kind: GraphNodeKind,
): void {
  if (kind === "skill" || radius < 4.6) return;
  ctx.save();
  ctx.font = `700 ${kind === "person" ? radius * 0.82 : radius * 0.78}px Inter, system-ui, -apple-system, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.strokeStyle = "rgba(15,23,42,0.16)";
  ctx.lineWidth = 1.5;
  ctx.strokeText(mark, x, y + radius * 0.04);
  ctx.fillText(mark, x, y + radius * 0.04);
  ctx.restore();
}

function paintNodePointerArea(
  node: ForceGraphNode,
  paintColor: string,
  ctx: CanvasRenderingContext2D,
): void {
  const x = node.x ?? 0;
  const y = node.y ?? 0;
  ctx.fillStyle = paintColor;
  ctx.beginPath();
  ctx.arc(x, y, nodeRadius(node) + 6, 0, Math.PI * 2);
  ctx.fill();
}

function drawForceLabel(
  ctx: CanvasRenderingContext2D,
  node: ForceGraphNode,
  x: number,
  y: number,
  globalScale: number,
  active: boolean,
): void {
  const label = compactLabel(node.label, node.kind === "person" ? 28 : 18);
  const fontSize = node.kind === "person" ? 11.5 : active ? 10.25 : 9.15;
  const scaledFontSize = fontSize / Math.max(0.7, globalScale);
  const paddingX = 4.5 / Math.max(0.8, globalScale);
  const paddingY = 2.2 / Math.max(0.8, globalScale);

  ctx.font = `600 ${scaledFontSize}px Inter, system-ui, -apple-system, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  if (node.kind === "person" || active) {
    const width = ctx.measureText(label).width + paddingX * 2;
    const height = scaledFontSize + paddingY * 2;
    roundRect(ctx, x - width / 2, y - height / 2, width, height, 7 / globalScale);
    ctx.fillStyle = active ? "rgba(255,255,255,0.88)" : "rgba(255,255,255,0.76)";
    ctx.fill();
    ctx.lineWidth = 0.7 / Math.max(1, globalScale);
    ctx.strokeStyle = "rgba(255,255,255,0.78)";
    ctx.stroke();
  } else {
    ctx.lineWidth = 3 / Math.max(1, globalScale);
    ctx.strokeStyle = "rgba(255,255,255,0.76)";
    ctx.strokeText(label, x, y);
  }

  ctx.fillStyle = active ? "rgba(16,32,22,0.92)" : "rgba(67,87,73,0.82)";
  ctx.fillText(label, x, y);
}

function shouldDrawForceLabel(node: ForceGraphNode, nodeCount: number): boolean {
  if (node.kind === "person") return true;
  if (node.kind === "project") return nodeCount <= 70;
  if (node.kind === "company" || node.kind === "school") return nodeCount <= 46;
  if (node.kind === "publication" || node.kind === "honor") return nodeCount <= 28;
  if (node.kind === "link") return nodeCount <= 22;
  return nodeCount <= 14;
}

function nodeRadius(node: GraphNode): number {
  if (node.kind === "person") return 12.5;
  if (node.kind === "skill") return Math.max(3.9, node.size * 0.9);
  if (node.kind === "project") return Math.max(5.6, node.size * 1.04);
  return Math.max(4.8, node.size);
}

function nodeShape(kind: GraphNodeKind): "circle" | "squircle" | "diamond" {
  if (kind === "project" || kind === "company" || kind === "school" || kind === "link") {
    return "squircle";
  }
  return "circle";
}

function nodeTypeMark(kind: GraphNodeKind): string {
  if (kind === "person") return "ME";
  if (kind === "project") return "{}";
  if (kind === "company") return "CO";
  if (kind === "school") return "ED";
  if (kind === "link") return "LN";
  if (kind === "publication") return "PB";
  if (kind === "honor") return "*";
  return "";
}

function normalizeHexColor(value: string): `#${string}` {
  return value.startsWith("#") ? (value as `#${string}`) : "#64748b";
}

function colorWithAlpha(hex: string, alpha: number): string {
  const normalized = hex.replace("#", "");
  const value = normalized.length === 3
    ? normalized.split("").map((char) => `${char}${char}`).join("")
    : normalized.padEnd(6, "0").slice(0, 6);
  const red = parseInt(value.slice(0, 2), 16);
  const green = parseInt(value.slice(2, 4), 16);
  const blue = parseInt(value.slice(4, 6), 16);
  return `rgba(${red},${green},${blue},${alpha})`;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function nodeTooltip(node: ForceGraphNode): string {
  const subtitle = nodeSubtitle(node);
  return subtitle ? `${node.label}\n${subtitle}` : node.label;
}

function linkTooltip(link: ForceGraphLink): string {
  const edge = edgeFromForceLink(link);
  const label = EDGE_LABELS[edge.kind];
  return edge.detail ? `${label}: ${edge.detail}` : label;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function edgeFromForceLink(link: {
  source: string | ForceNode;
  target: string | ForceNode;
  kind: GraphEdgeKind;
  detail?: string;
}): GraphEdge {
  return {
    source: forceEndpointId(link.source),
    target: forceEndpointId(link.target),
    kind: link.kind,
    detail: link.detail,
  };
}

function forceLinkEndpointIds(link: {
  source: string | ForceNode;
  target: string | ForceNode;
}): [string, string] {
  return [forceEndpointId(link.source), forceEndpointId(link.target)];
}

function forceEndpointId(endpoint: ForceLink["source"]): string {
  if (typeof endpoint === "string") return endpoint;
  return endpoint.id;
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
    link: "5",
    publication: "6",
    honor: "7",
    person: "0",
  };
  return `${order[node.kind]}:${node.label.toLowerCase()}`;
}

function compactLabel(value: string, maxLength: number): string {
  const cleaned = value.replace(/\s+/g, " ").trim();
  if (cleaned.length <= maxLength) return cleaned;
  return `${cleaned.slice(0, maxLength - 1).trimEnd()}…`;
}

function nodeSubtitle(node: GraphNode): string {
  if (node.kind === "person") {
    return stringField(node.data, ["headline", "email", "location"]);
  }
  if (node.kind === "project") {
    return stringField(node.data, ["repoFullName", "oneLineDescription", "description"]);
  }
  if (node.kind === "company") {
    return stringField(node.data, ["title", "location"]);
  }
  if (node.kind === "school") {
    return stringField(node.data, ["degree", "field"]);
  }
  if (node.kind === "link") {
    return stringField(node.data, ["url", "host", "platform"]);
  }
  if (node.kind === "publication") {
    return stringField(node.data, ["venue", "date"]);
  }
  if (node.kind === "honor") {
    return stringField(node.data, ["issuer", "date"]);
  }
  return stringField(node.data, ["source", "name"]);
}

function countByKind(nodes: ReadonlyArray<GraphNode>): Record<GraphNodeKind, number> {
  const counts: Record<GraphNodeKind, number> = {
    person: 0,
    project: 0,
    company: 0,
    school: 0,
    skill: 0,
    link: 0,
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

type LinkNodeData = {
  key: keyof ProfileLinks;
  label: string;
  platform: string;
  url: string;
  host: string;
  handle?: string;
  source: "profile.links";
};

const LINK_ORDER: ReadonlyArray<keyof ProfileLinks> = [
  "github",
  "linkedin",
  "website",
  "devpost",
  "twitter",
];

const LINK_LABELS: Record<keyof ProfileLinks, string> = {
  github: "GitHub",
  linkedin: "LinkedIn",
  website: "Website",
  devpost: "DevPost",
  twitter: "X / Twitter",
};

function profileLinkNodes(links: ProfileLinks): LinkNodeData[] {
  return LINK_ORDER.flatMap((key) => {
    const url = normalizeGraphUrl(links[key]);
    if (!url) return [];
    return [{
      key,
      label: linkNodeLabel(key, url),
      platform: LINK_LABELS[key],
      url: url.toString(),
      host: url.hostname.replace(/^www\./, ""),
      handle: linkHandle(url),
      source: "profile.links" as const,
    }];
  });
}

function ensureLinkNode(nodes: GraphNode[], link: LinkNodeData): string {
  const id = `link:${link.key}`;
  const existing = nodes.find((node) => node.id === id);
  if (existing) return existing.id;
  nodes.push({
    id,
    kind: "link",
    label: link.label,
    color: NODE_COLORS.link,
    size: NODE_SIZE.link,
    data: link,
  });
  return id;
}

function normalizeGraphUrl(raw: string | undefined): URL | null {
  const value = raw?.trim();
  if (!value) return null;
  try {
    return new URL(value.includes("://") ? value : `https://${value}`);
  } catch {
    return null;
  }
}

function linkNodeLabel(key: keyof ProfileLinks, url: URL): string {
  if (key === "website") return url.hostname.replace(/^www\./, "");
  const handle = linkHandle(url);
  return handle ? `${LINK_LABELS[key]} / ${handle}` : LINK_LABELS[key];
}

function linkHandle(url: URL): string | undefined {
  const parts = url.pathname.split("/").filter(Boolean);
  return parts.at(-1);
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
  if (node.kind === "link") {
    return stringField(data, ["url", "host", "platform"]) || undefined;
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

function ConstellationBackdrop(): React.ReactElement {
  return (
    <div className="pointer-events-none absolute inset-0 z-0">
      <div className="absolute inset-0 bg-[linear-gradient(145deg,rgba(255,255,255,0.78),rgba(238,246,235,0.64)_48%,rgba(213,224,208,0.58))]" />
      <div
        className="absolute inset-0 opacity-[0.55]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(67,87,73,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(67,87,73,0.07) 1px, transparent 1px)",
          backgroundSize: "44px 44px",
          maskImage: "linear-gradient(180deg, rgba(0,0,0,0.58), rgba(0,0,0,0.16))",
          WebkitMaskImage: "linear-gradient(180deg, rgba(0,0,0,0.58), rgba(0,0,0,0.16))",
        }}
      />
      <div className="absolute inset-x-0 top-0 h-px bg-white/85" />
      <div className="absolute inset-x-10 bottom-8 h-px bg-[linear-gradient(90deg,transparent,rgba(67,87,73,0.18),transparent)]" />
    </div>
  );
}

function GraphPlaceholder({ text }: { text: string }): React.ReactElement {
  return (
    <div className="relative z-20 flex h-full w-full items-center justify-center">
      <span className="rounded-full border border-white/70 bg-white/62 px-4 py-1.5 text-[12px] font-medium text-[#435749] shadow-[inset_0_1px_0_rgba(255,255,255,0.78)] backdrop-blur-xl">
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
    <div className="relative z-20 flex h-full w-full flex-col items-center justify-center gap-3 p-8 text-center">
      <p className="max-w-sm text-sm text-[#435749]">
        {hasAnyNodes
          ? "No nodes match the current filter."
          : "Sign in with GitHub or paste a LinkedIn URL during onboarding to populate your graph."}
      </p>
      {hasAnyNodes && (
        <button
          type="button"
          onClick={onResetFilter}
          className="h-8 rounded-full border border-white/70 bg-white/65 px-3 text-[12px] font-semibold text-[#435749] shadow-[inset_0_1px_0_rgba(255,255,255,0.78)] transition hover:bg-white/84 hover:text-[#102016]"
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
      className="pointer-events-none absolute z-30 max-w-xs -translate-x-1/2 -translate-y-full rounded-2xl border border-white/70 bg-white/90 px-3 py-2 text-[11px] font-medium text-[#435749] shadow-[0_12px_24px_rgba(64,92,58,0.16),inset_0_1px_0_rgba(255,255,255,0.85)] backdrop-blur-xl"
      style={{ left: x, top: y - 8 }}
    >
      <span className="font-semibold capitalize text-[#102016]">
        {EDGE_LABELS[edge.kind]}
      </span>
      {edge.detail && <span className="ml-1 text-[#738070]">{edge.detail}</span>}
    </div>
  );
}
