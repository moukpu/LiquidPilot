"use client";

import { motion } from "framer-motion";
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

const NODE_FILL: Record<NodeState, string> = {
  shocked: "#dc2626",
  breached: "#dc2626",
  affected: "#f59e0b",
  idle: "#94a3b8",
};

const EDGE_STROKE: Record<NodeState, string> = {
  shocked: "#dc2626",
  breached: "#dc2626",
  affected: "#fbbf24",
  idle: "#cbd5e1",
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
        {(["idle", "affected", "breached", "shocked"] as NodeState[]).map(
          (state) => (
            <marker
              key={state}
              id={`arrow-${state}`}
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill={EDGE_STROKE[state]} />
            </marker>
          )
        )}
      </defs>

      {/* Edges first, so nodes draw on top. */}
      <g>
        {edges.map((e) => {
          const dstState = nodeState(e.to, result);
          const d = edgePath(e, positions, edges);
          return (
            <path
              key={`${e.from}->${e.to}`}
              d={d}
              fill="none"
              stroke={EDGE_STROKE[dstState]}
              strokeWidth={edgeWidth(e.exposure_usd)}
              markerEnd={`url(#arrow-${dstState})`}
              opacity={dstState === "idle" ? 0.55 : 0.9}
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

      {/* Nodes. */}
      <g>
        {nodes.map((n) => {
          const pos = positions[n.account_id];
          if (!pos) return null;
          const state = nodeState(n.account_id, result);
          const isHub = n.account_id === HUB_ACCOUNT_ID;
          const labelDy = isHub ? -(NODE_RADIUS + 8) : NODE_RADIUS + 14;
          return (
            <g key={n.account_id} transform={`translate(${pos.x},${pos.y})`}>
              <motion.circle
                cx={0}
                cy={0}
                r={NODE_RADIUS}
                fill={NODE_FILL[state]}
                stroke="#ffffff"
                strokeWidth={2}
                animate={
                  state === "shocked" ? { scale: [1, 1.15, 1] } : { scale: 1 }
                }
                transition={
                  state === "shocked"
                    ? { duration: 1.4, repeat: Infinity, ease: "easeInOut" }
                    : { duration: 0 }
                }
              >
                <title>
                  {n.account_id} · {n.currency} · $
                  {(n.current_balance_usd / 1_000_000).toFixed(1)}M
                </title>
              </motion.circle>
              <text
                x={0}
                y={labelDy}
                textAnchor="middle"
                fontFamily="ui-monospace, monospace"
                fontSize={11}
                fontWeight={600}
                fill="#0f172a"
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
