import type { ContagionEdge, ContagionNode } from "@/types/api";

// Center of the SVG viewport. Picked to leave room for labels under
// the bottom-row nodes without clipping at viewBox height=640.
export const CENTER_X = 400;
export const CENTER_Y = 320;

// Radius of the ring on which non-hub nodes sit. With viewBox 800x640
// and node radius ~28, this gives ~70px gap to the edge of the box.
export const RING_RADIUS = 220;

// Account_id of the visual hub. This is the node that gets placed at
// the center instead of on the ring. Picked because it has the most
// outgoing edges (5) in the fixture — the cascade demo runs through it.
export const HUB_ACCOUNT_ID = "USD-Correspondent";

// Node circle radius. Used by both the graph and the layout (e.g. to
// shorten edges so arrowheads don't get hidden inside the circle).
export const NODE_RADIUS = 28;

export interface Position {
  x: number;
  y: number;
}

/**
 * Deterministic radial layout. The hub goes to the center; every other
 * node is placed on a circle around it, sorted alphabetically by
 * account_id so the screenshot is reproducible. Returns a map keyed
 * by account_id for O(1) lookup in the graph component.
 */
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
  // Start at angle -90° (12 o'clock) and go clockwise. Slight offset
  // by -Math.PI / 2 puts the first node directly above the hub.
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
 * Returns true if there is a reverse edge B→A for the given A→B edge.
 * Used to decide whether to draw a curved arc (bidirectional pair) or
 * a straight line (unique edge). Curved avoids two overlapping arrows.
 */
export function hasReverse(
  edge: ContagionEdge,
  edges: ContagionEdge[]
): boolean {
  return edges.some((e) => e.from === edge.to && e.to === edge.from);
}

/**
 * Build the SVG `d` attribute for an edge. For unique edges, this is a
 * straight line shortened on both ends so arrowheads don't get hidden
 * inside the node circles. For bidirectional pairs, it's a quadratic
 * Bezier curve offset perpendicular to the line midpoint, with the
 * offset sign tied to the lex order of (from, to) so the two halves
 * of the pair end up on opposite sides.
 */
export function edgePath(
  edge: ContagionEdge,
  positions: Record<string, Position>,
  edges: ContagionEdge[]
): string {
  const a = positions[edge.from];
  const b = positions[edge.to];
  if (!a || !b) return "";

  const rA = edge.from === HUB_ACCOUNT_ID ? NODE_RADIUS * 1.3 : NODE_RADIUS;
  const rB = edge.to === HUB_ACCOUNT_ID ? NODE_RADIUS * 1.3 : NODE_RADIUS;

  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len < 1) return "";

  const ux = dx / len;
  const uy = dy / len;

  // Shorten by node radius + marker size so the arrowhead sits perfectly outside.
  // We add ~12px to account for the marker width.
  const paddingA = rA + 4;
  const paddingB = rB + 16; 

  let x1 = a.x + ux * paddingA;
  let y1 = a.y + uy * paddingA;
  let x2 = b.x - ux * paddingB;
  let y2 = b.y - uy * paddingB;

  if (hasReverse(edge, edges)) {
    // Parallel shift for bidirectional edges to prevent overlapping lines.
    // Shift right relative to the edge direction.
    const shift = 6;
    x1 += -uy * shift;
    y1 += ux * shift;
    x2 += -uy * shift;
    y2 += ux * shift;
  }

  return `M ${x1.toFixed(1)} ${y1.toFixed(1)} L ${x2.toFixed(1)} ${y2.toFixed(1)}`;
}

export const HUB_RADIUS_MULTIPLIER = 1.4;

/**
 * Edge stroke width as a function of exposure size. Uses log-scale so
 * $0.8M vs $6.8M are visibly different without letting the largest edges
 * dominate the view.
 */
export function edgeWidth(exposure_usd: number): number {
  return Math.max(
    1,
    Math.min(
      10,
      Math.log10(Math.max(exposure_usd, 100_000) / 100_000) * 3
    )
  );
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
