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
  | "publication"
  | "honor";

export type GraphEdgeKind =
  | "built"
  | "worked_at"
  | "studied_at"
  | "uses_skill"
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
  person: "#fbbf24", // amber — you, central
  project: "#34d399", // emerald
  company: "#60a5fa", // blue
  school: "#c084fc", // purple
  skill: "#f472b6", // pink
  publication: "#fb923c", // orange
  honor: "#facc15", // yellow
};

export const EDGE_LABELS: Record<GraphEdgeKind, string> = {
  built: "built",
  worked_at: "worked at",
  studied_at: "studied at",
  uses_skill: "uses",
  wrote: "wrote",
  received: "received",
};

export const NODE_SIZE: Record<GraphNodeKind, number> = {
  person: 10,
  project: 6,
  company: 5.5,
  school: 5.5,
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
