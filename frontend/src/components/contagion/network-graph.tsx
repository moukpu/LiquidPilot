"use client";

import { motion } from "framer-motion";
import { useLocale } from "@/i18n/locale-context";
import {
  CENTER_X,
  CENTER_Y,
  HUB_ACCOUNT_ID,
  NODE_RADIUS,
  HUB_RADIUS_MULTIPLIER,
  accountPositions,
  edgePath,
  edgeWidth,
  edgeStyleByKind,
} from "@/lib/contagion-layout";
import { displayAccountLabel } from "@/lib/format";
import type {
  CascadeResult,
  ContagionEdge,
  ContagionNode,
} from "@/types/api";

type NodeState = "shocked" | "breached" | "affected" | "idle";

const NODE_STATE_STYLE: Record<NodeState, { fill: string; outline?: string; outlineWidth?: number }> = {
  shocked: { fill: "#dc2626", outline: "#fbbf24", outlineWidth: 3 },
  breached: { fill: "#dc2626" },
  affected: { fill: "#f59e0b" },
  idle: { fill: "#94a3b8" },
};

const EDGE_STROKE_BY_STATE: Record<NodeState, string> = {
  shocked: "#dc2626",
  breached: "#dc2626",
  affected: "#fbbf24",
  idle: "#cbd5e1", // Default fallback if not using kind
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
  const { t } = useLocale();
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
              <path d="M 0 0 L 10 5 L 0 10 z" fill={EDGE_STROKE_BY_STATE[state]} />
            </marker>
          )
        )}
        <marker
          id="arrow-kind-intra-group"
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill={edgeStyleByKind("intra-group").stroke} />
        </marker>
        <marker
          id="arrow-kind-correspondent"
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill={edgeStyleByKind("correspondent").stroke} />
        </marker>
        <marker
          id="arrow-kind-market"
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill={edgeStyleByKind("market").stroke} />
        </marker>
      </defs>

      {/* Edges first, so nodes draw on top. */}
      <g>
        {edges.map((e) => {
          const dstState = nodeState(e.to, result);
          const d = edgePath(e, positions, edges);
          const style = dstState === "idle" ? edgeStyleByKind(e.kind) : { stroke: EDGE_STROKE_BY_STATE[dstState], dasharray: undefined };
          const markerId = dstState === "idle" ? `url(#arrow-kind-${e.kind})` : `url(#arrow-${dstState})`;
          
          return (
            <path
              key={`${e.from}->${e.to}`}
              d={d}
              fill="none"
              stroke={style.stroke}
              strokeDasharray={style.dasharray}
              strokeWidth={edgeWidth(e.exposure_usd)}
              markerEnd={markerId}
              opacity={dstState === "idle" ? 0.6 : 0.9}
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
          const r = isHub ? NODE_RADIUS * HUB_RADIUS_MULTIPLIER : NODE_RADIUS;
          const labelDy = isHub ? -(r + 8) : r + 14;
          const style = NODE_STATE_STYLE[state];
          const hasGoldBorder = isHub && state !== "shocked";

          return (
            <g key={n.account_id} transform={`translate(${pos.x},${pos.y})`}>
              {state === "shocked" && (
                <motion.circle
                  cx={0}
                  cy={0}
                  r={r + 12}
                  fill="none"
                  stroke="#fbbf24"
                  strokeWidth={2}
                  animate={{ strokeOpacity: [0.8, 0.2, 0.8] }}
                  transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
                />
              )}
              <motion.circle
                cx={0}
                cy={0}
                r={r}
                fill={style.fill}
                stroke={hasGoldBorder ? "#fbbf24" : (style.outline || "#ffffff")}
                strokeWidth={hasGoldBorder ? 3 : (style.outlineWidth || 2)}
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
              {isHub && (
                <text
                  x={0}
                  y={4}
                  textAnchor="middle"
                  fontFamily="ui-sans-serif, system-ui, sans-serif"
                  fontSize={18}
                  fill="#ffffff"
                  opacity={0.8}
                  pointerEvents="none"
                >
                  ⌘
                </text>
              )}
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

      {/* Legend */}
      <g transform="translate(620, 20)">
        <rect x={0} y={0} width={150} height={140} fill="white" stroke="#e2e8f0" rx={8} />
        <text x={12} y={24} fontSize={10} fontFamily="ui-monospace, monospace" fontWeight={700} fill="#64748b" letterSpacing={1} textAnchor="start">
          {t("contagion.legend.title").toUpperCase()}
        </text>

        {/* Nodes legend */}
        <circle cx={20} cy={44} r={4} fill={NODE_STATE_STYLE.shocked.fill} />
        <text x={32} y={48} fontSize={10} fontFamily="ui-sans-serif, sans-serif" fill="#334155">{t("contagion.node.shocked")}</text>

        <circle cx={20} cy={60} r={4} fill={NODE_STATE_STYLE.breached.fill} />
        <text x={32} y={64} fontSize={10} fontFamily="ui-sans-serif, sans-serif" fill="#334155">{t("contagion.node.breached")}</text>

        <circle cx={20} cy={76} r={4} fill={NODE_STATE_STYLE.affected.fill} />
        <text x={32} y={80} fontSize={10} fontFamily="ui-sans-serif, sans-serif" fill="#334155">{t("contagion.node.affected")}</text>

        <circle cx={20} cy={92} r={4} fill={NODE_STATE_STYLE.idle.fill} />
        <text x={32} y={96} fontSize={10} fontFamily="ui-sans-serif, sans-serif" fill="#334155">{t("contagion.node.idle")}</text>

        {/* Edges legend */}
        <line x1={80} y1={44} x2={100} y2={44} stroke={edgeStyleByKind("intra-group").stroke} strokeWidth={2} />
        <text x={108} y={48} fontSize={10} fontFamily="ui-sans-serif, sans-serif" fill="#334155">{t("contagion.edge.kind.intra-group")}</text>

        <line x1={80} y1={60} x2={100} y2={60} stroke={edgeStyleByKind("correspondent").stroke} strokeWidth={2} />
        <text x={108} y={64} fontSize={10} fontFamily="ui-sans-serif, sans-serif" fill="#334155">{t("contagion.edge.kind.correspondent")}</text>

        <line x1={80} y1={76} x2={100} y2={76} stroke={edgeStyleByKind("market").stroke} strokeDasharray={edgeStyleByKind("market").dasharray} strokeWidth={2} />
        <text x={108} y={80} fontSize={10} fontFamily="ui-sans-serif, sans-serif" fill="#334155">{t("contagion.edge.kind.market")}</text>
      </g>
    </svg>
  );
}
