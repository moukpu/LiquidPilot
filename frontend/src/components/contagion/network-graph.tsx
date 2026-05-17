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
              markerUnits="userSpaceOnUse"
              viewBox="0 0 16 16"
              refX="16"
              refY="8"
              markerWidth="16"
              markerHeight="16"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 16 8 L 0 16 z" fill={EDGE_COLOR[state]} />
            </marker>
          )
        )}
      </defs>

      {/* Background Grid */}
      <rect width="100%" height="100%" fill="url(#dotGrid)" />

      {/* Edges */}
      <g>
        {[...edges].sort((a, b) => {
          const aState = nodeState(a.to, result);
          const bState = nodeState(b.to, result);
          const weight = (s: NodeState) => s === "idle" ? 0 : 1;
          return weight(aState) - weight(bState);
        }).map((e) => {
          const dstState = nodeState(e.to, result);
          const d = edgePath(e, positions, edges);
          const isIdle = dstState === "idle";
          const strokeColor = EDGE_COLOR[dstState];
          
          return (
            <path
              key={`${e.from}->${e.to}`}
              d={d}
              fill="none"
              stroke={strokeColor}
              strokeWidth={isIdle ? 1.5 : Math.min(8, edgeWidth(e.exposure_usd))}
              markerEnd={`url(#arrow-${dstState})`}
              opacity={isIdle ? 0.6 : 1}
            >
              <title>
                {e.from} → {e.to} · ${(e.exposure_usd / 1_000_000).toFixed(1)}M
                · {e.kind}
                {"\n"}
                {e.description}
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
                y={r + 18}
                textAnchor="middle"
                fontFamily="system-ui, sans-serif"
                fontSize={11}
                fontWeight={700}
                fill={theme.text}
                className="select-none"
              >
                {displayAccountLabel(n.account_id)}
              </text>
            </g>
          );
        })}
      </g>
    </svg>
  );
}
