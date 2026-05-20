"use client";

import { useState } from "react";
import {
  CENTER_X,
  CENTER_Y,
  HUB_ACCOUNT_ID,
  NODE_RADIUS,
  accountPositions,
  edgePath,
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
  selectedAccount?: string | null;
  onSelectAccount?: (accountId: string) => void;
  onSelectEdge?: (edge: ContagionEdge) => void;
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

export default function NetworkGraph({
  nodes,
  edges,
  result,
  selectedAccount,
  onSelectAccount,
  onSelectEdge,
}: Props) {
  const positions = accountPositions(nodes);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
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
              viewBox="0 0 14 14"
              refX="13"
              refY="7"
              markerWidth="14"
              markerHeight="14"
              orient="auto-start-reverse"
            >
              <path d="M 1 1 L 13 7 L 1 13 z" fill={EDGE_COLOR[state]} stroke={EDGE_COLOR[state]} strokeWidth="1" strokeLinejoin="round" />
            </marker>
          )
        )}
      </defs>

      <rect width="100%" height="100%" fill="url(#dotGrid)" />

      <g>
        {[...edges].sort((a, b) => {
          const aState = nodeState(a.to, result);
          const bState = nodeState(b.to, result);
          const weight = (s: NodeState) => s === "idle" ? 0 : 1;
          return weight(aState) - weight(bState);
        }).map((e) => {
          const dstState = nodeState(e.to, result);
          const d = edgePath({ from: e.from, to: e.to }, positions);
          const isIdle = dstState === "idle";
          const strokeColor = EDGE_COLOR[dstState];

          return (
            <g key={`${e.from}->${e.to}`} className="cursor-pointer">
              <path
                d={d}
                fill="none"
                stroke={strokeColor}
                strokeWidth={isIdle ? 1.5 : 2.5}
                markerEnd={`url(#arrow-${dstState})`}
                opacity={isIdle ? 0.6 : 1}
              />
              <path
                d={d}
                fill="none"
                stroke="transparent"
                strokeWidth={14}
                onClick={() => onSelectEdge?.(e)}
                style={{ cursor: "pointer" }}
              >
                <title>
                  {e.from} → {e.to} · {(e.exposure_usd / 1_000_000).toFixed(1)}M
                  · {e.kind}
                  {"\n"}
                  {e.description}
                </title>
              </path>
            </g>
          );
        })}
      </g>

      <g>
        {nodes.map((n) => {
          const pos = positions[n.account_id];
          if (!pos) return null;
          const state = nodeState(n.account_id, result);
          const isHub = n.account_id === HUB_ACCOUNT_ID;
          const isSelected = selectedAccount === n.account_id;
          const isHovered = hoveredNode === n.account_id;
          const baseR = isHub ? NODE_RADIUS * 1.3 : NODE_RADIUS;
          const r = isHovered ? baseR + 3 : baseR;
          const theme = THEME[state];
          const hasGlow = state !== "idle";

          const label = displayAccountLabel(n.account_id);
          const parts = label.split(" · ");

          return (
            <g
              key={n.account_id}
              transform={`translate(${pos.x},${pos.y})`}
              style={{ cursor: "pointer" }}
              onClick={() => onSelectAccount?.(n.account_id)}
              onMouseEnter={() => setHoveredNode(n.account_id)}
              onMouseLeave={() => setHoveredNode(null)}
            >
              {isSelected && (
                <circle
                  cx={0}
                  cy={0}
                  r={r + 6}
                  fill="none"
                  stroke="#0f172a"
                  strokeWidth={2}
                  strokeDasharray="3 3"
                  opacity={0.55}
                />
              )}
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
                className="select-none pointer-events-none"
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
                  className="select-none pointer-events-none"
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
