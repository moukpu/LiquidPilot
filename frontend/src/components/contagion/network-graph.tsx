"use client";

import { useLocale } from "@/i18n/locale-context";
import {
  CENTER_X,
  CENTER_Y,
  HUB_ACCOUNT_ID,
  NODE_RADIUS,
  accountPositions,
  edgePath,
  edgeWidth,
} from "@/lib/contagion-layout";
import { displayAccountLabel } from "@/lib/format";
import type {
  CascadeResult,
  ContagionEdge,
  ContagionNode,
} from "@/types/api";

type NodeState = "shocked" | "breached" | "affected" | "idle";

const THEME = {
  shocked: { fill: "#ffffff", stroke: "#ef4444", text: "#ef4444" },
  breached: { fill: "#ffffff", stroke: "#f97316", text: "#f97316" },
  affected: { fill: "#ffffff", stroke: "#eab308", text: "#eab308" },
  idle: { fill: "#ffffff", stroke: "#cbd5e1", text: "#64748b" },
};

const EDGE_COLOR = {
  shocked: "#ef4444",
  breached: "#f97316",
  affected: "#eab308",
  idle: "#e2e8f0",
};

const STATE_SEVERITY: Record<NodeState, number> = {
  shocked: 4,
  breached: 3,
  affected: 2,
  idle: 1,
};

function getWorstState(s1: NodeState, s2: NodeState): NodeState {
  return STATE_SEVERITY[s1] > STATE_SEVERITY[s2] ? s1 : s2;
}

interface Props {
  nodes: ContagionNode[];
  edges: ContagionEdge[];
  result: CascadeResult | null;
}

function nodeState(
  account_id: string,
  result: CascadeResult | null
): NodeState {
  if (!result) return "idle";
  if (account_id === result.shocked_account_id) return "shocked";
  const hop = result.affected.find((h) => h.account_id === account_id);
  if (!hop) return "idle";
  if (hop.breached) return "breached";
  return "affected";
}

export default function NetworkGraph({ nodes, edges, result }: Props) {
  const positions = accountPositions(nodes);
  // Reference CENTER_X/Y so unused-export linters don't complain when
  // the layout module's constants are tree-shaken in tests.
  void CENTER_X;
  void CENTER_Y;

  // Deduplicate bidirectional edges to draw them as a single line with two arrows
  const visualEdges = [];
  const seenEdges = new Set<string>();

  for (const e of edges) {
    const key1 = `${e.from}->${e.to}`;
    const key2 = `${e.to}->${e.from}`;
    if (seenEdges.has(key1) || seenEdges.has(key2)) continue;

    const reverseEdge = edges.find((r) => r.from === e.to && r.to === e.from);
    seenEdges.add(key1);
    if (reverseEdge) seenEdges.add(key2);

    const forwardState = nodeState(e.to, result);
    const reverseState = reverseEdge ? nodeState(reverseEdge.to, result) : "idle";

    visualEdges.push({
      from: e.from,
      to: e.to,
      exposure_usd: Math.max(e.exposure_usd, reverseEdge?.exposure_usd || 0),
      kind: e.kind,
      description: e.description,
      isBidirectional: !!reverseEdge,
      overallState: getWorstState(forwardState, reverseState),
    });
  }

  // Sort edges so active ones are drawn on top
  visualEdges.sort((a, b) => {
    const weight = (s: NodeState) => s === "idle" ? 0 : 1;
    return weight(a.overallState) - weight(b.overallState);
  });

  return (
    <svg
      viewBox="0 0 800 640"
      className="w-full h-full"
      role="img"
      aria-label="Contagion network graph"
    >
      <defs>
        <pattern id="dotGrid" x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r="1.5" fill="#e2e8f0" opacity="0.6" />
        </pattern>
        <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="8" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
        {(["idle", "affected", "breached", "shocked"] as NodeState[]).map(
          (state) => (
            <marker
              key={state}
              id={`arrow-${state}`}
              viewBox="0 0 10 10"
              refX="10"
              refY="5"
              markerWidth="5"
              markerHeight="5"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill={EDGE_COLOR[state]} />
            </marker>
          )
        )}
      </defs>

      {/* Background Grid */}
      <rect width="100%" height="100%" fill="url(#dotGrid)" />

      {/* Edges */}
      <g>
        {visualEdges.map((ve) => {
          const d = edgePath({ from: ve.from, to: ve.to }, positions);
          const isIdle = ve.overallState === "idle";
          const strokeColor = EDGE_COLOR[ve.overallState];
          
          return (
            <path
              key={`${ve.from}-${ve.to}`}
              d={d}
              fill="none"
              stroke={strokeColor}
              strokeWidth={isIdle ? 1.5 : Math.min(8, edgeWidth(ve.exposure_usd))}
              markerEnd={`url(#arrow-${ve.overallState})`}
              markerStart={ve.isBidirectional ? `url(#arrow-${ve.overallState})` : undefined}
              opacity={isIdle ? 0.6 : 1}
            >
              <title>
                {ve.from} {ve.isBidirectional ? "↔" : "→"} {ve.to} · ${(ve.exposure_usd / 1_000_000).toFixed(1)}M
                · {ve.kind}
              </title>
            </path>
          );
        })}
      </g>

      {/* Nodes */}
      <g>
        {nodes.map((n) => {
          const pos = positions[n.account_id];
          if (!pos) return null;
          const state = nodeState(n.account_id, result);
          const isHub = n.account_id === HUB_ACCOUNT_ID;
          const r = isHub ? NODE_RADIUS * 1.3 : NODE_RADIUS;
          const theme = THEME[state];
          const hasGlow = state !== "idle";

          const label = displayAccountLabel(n.account_id);
          const parts = label.split(" · ");

          return (
            <g key={n.account_id} transform={`translate(${pos.x},${pos.y})`}>
              <circle
                cx={0}
                cy={0}
                r={r}
                fill={theme.fill}
                stroke={theme.stroke}
                strokeWidth={isHub ? 4 : 3}
                filter={hasGlow ? "url(#glow)" : undefined}
                className={state === "shocked" ? "animate-pulse" : ""}
              >
                <title>
                  {n.account_id} · {n.currency} · $
                  {(n.current_balance_usd / 1_000_000).toFixed(1)}M
                </title>
              </circle>
              {isHub && (
                <circle
                  cx={0}
                  cy={0}
                  r={r - 6}
                  fill="none"
                  stroke={theme.stroke}
                  strokeWidth={1}
                  opacity={0.3}
                />
              )}
              <text
                x={0}
                y={parts.length > 1 ? -5 : 1}
                textAnchor="middle"
                alignmentBaseline="middle"
                fontFamily="system-ui, sans-serif"
                fontSize={12}
                fontWeight={800}
                fill={theme.text}
                className="select-none"
              >
                {parts[0]}
              </text>
              {parts[1] && (
                <text
                  x={0}
                  y={8}
                  textAnchor="middle"
                  alignmentBaseline="middle"
                  fontFamily="system-ui, sans-serif"
                  fontSize={9}
                  fontWeight={700}
                  fill={theme.text}
                  className="select-none"
                  opacity={0.7}
                >
                  {parts[1]}
                </text>
              )}
            </g>
          );
        })}
      </g>
    </svg>
  );
}
