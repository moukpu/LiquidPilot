import type { ContagionEdge, ContagionNode } from "@/types/api";

// Center of the SVG viewport.
export const CENTER_X = 400;
export const CENTER_Y = 320;

// Radius of the ring on which non-hub nodes sit.
export const RING_RADIUS = 220;

export const HUB_ACCOUNT_ID = "USD-Correspondent";

// Increased node radius to fit labels inside
export const NODE_RADIUS = 36;
export const HUB_RADIUS_MULTIPLIER = 1.3;

export interface Position {
  x: number;
  y: number;
}

export function accountPositions(
  nodes: ContagionNode[]
): Record<string, Position> {
  const non_hub = nodes
    .filter((n) => n.account_id !== HUB_ACCOUNT_ID)
    .map((n) => n.account_id)
    .sort();
  const result: Record<string, Position> = {};
  result[HUB_ACCOUNT_ID] = { x: CENTER_X, y: CENTER_Y };
  const n = non_hub.length;
  for (let i = 0; i < n; i++) {
    const angle = -Math.PI / 2 + (2 * Math.PI * i) / n;
    result[non_hub[i]] = {
      x: CENTER_X + RING_RADIUS * Math.cos(angle),
      y: CENTER_Y + RING_RADIUS * Math.sin(angle),
    };
  }
  return result;
}

/**
 * Build the SVG `d` attribute for a straight edge.
 * Symmetrical padding so A->B and B->A can perfectly overlap.
 */
export function edgePath(
  edge: { from: string; to: string },
  positions: Record<string, Position>
): string {
  const a = positions[edge.from];
  const b = positions[edge.to];
  if (!a || !b) return "";

  const rA = edge.from === HUB_ACCOUNT_ID ? NODE_RADIUS * HUB_RADIUS_MULTIPLIER : NODE_RADIUS;
  const rB = edge.to === HUB_ACCOUNT_ID ? NODE_RADIUS * HUB_RADIUS_MULTIPLIER : NODE_RADIUS;

  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len < 1) return "";

  const ux = dx / len;
  const uy = dy / len;

  // Small gap between arrowhead tip and the node border
  const paddingA = rA + 4;
  const paddingB = rB + 4; 

  const x1 = a.x + ux * paddingA;
  const y1 = a.y + uy * paddingA;
  const x2 = b.x - ux * paddingB;
  const y2 = b.y - uy * paddingB;

  return `M ${x1.toFixed(1)} ${y1.toFixed(1)} L ${x2.toFixed(1)} ${y2.toFixed(1)}`;
}



/**
 * Semantic edge styling based on the kind of exposure.
 */
export function edgeStyleByKind(kind: ContagionEdge["kind"]): {
  stroke: string;
  dasharray?: string;
} {
  switch (kind) {
    case "correspondent":
      return { stroke: "#3b82f6" }; // blue-500
    case "market":
      return { stroke: "#94a3b8", dasharray: "6 3" }; // slate-400 dashed
    case "intra-group":
    default:
      return { stroke: "#94a3b8" }; // slate-400 solid
  }
}
