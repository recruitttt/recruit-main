//
// Shared types for the profile force-directed graph.
//
// Spec: docs/superpowers/specs/2026-04-25-recruit-merge-design.md §9.2
//

export type GraphNodeKind =
  | "person"
  | "project"
  | "company"
  | "school"
  | "skill"
  | "link"
  | "publication"
  | "honor";

export type GraphEdgeKind =
  | "built"
  | "worked_at"
  | "studied_at"
  | "uses_skill"
  | "links_to"
  | "wrote"
  | "received";

export interface GraphNode {
  id: string;
  kind: GraphNodeKind;
  label: string;
  color: string;
  size: number;
  // Original source object — passed to the side drawer so the user can
  // inspect every field captured for this node.
  data: Record<string, unknown>;
}

export interface GraphEdge {
  source: string;
  target: string;
  kind: GraphEdgeKind;
  // Optional secondary text for the hover tooltip
  detail?: string;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export const NODE_COLORS: Record<GraphNodeKind, string> = {
  person: "#D2A23A",
  project: "#2F8F57",
  company: "#4E7CBF",
  school: "#8C6AC8",
  skill: "#A45E83",
  link: "#2E9C9A",
  publication: "#C9783A",
  honor: "#B89A2E",
};

export const EDGE_LABELS: Record<GraphEdgeKind, string> = {
  built: "built",
  worked_at: "worked at",
  studied_at: "studied at",
  uses_skill: "uses",
  links_to: "links to",
  wrote: "wrote",
  received: "received",
};

export const NODE_SIZE: Record<GraphNodeKind, number> = {
  person: 10,
  project: 6,
  company: 5.5,
  school: 5.5,
  link: 4.8,
  publication: 5,
  honor: 4.5,
  skill: 4,
};

// Filter modes applied to the constructed graph.
export type GraphFilter = "all" | "ai" | "research" | "recent";

export const FILTERS: ReadonlyArray<{ id: GraphFilter; label: string }> = [
  { id: "all", label: "All" },
  { id: "ai", label: "AI work" },
  { id: "research", label: "Research" },
  { id: "recent", label: "2025+ only" },
];
