# Contagion Phase 5 — frontend (graph viz + shock form + result panel)

**Repo:** https://github.com/moukpu/LiquidPilot
**Base branch:** `main` (HEAD = `26c5c38` — 0009 Contagion backend (`205e535`) merged, plus docs-only commit on top. Если уехало — `git fetch && git rebase origin/main`.)
**Target PR title:** `feat(contagion): bilateral exposure graph viz + cascade form (Phase 5 frontend)`

Phase 5 backend отшипился в `205e535` (PR #10): `GET /contagion/network` отдаёт 9 nodes + 16 edges, `POST /contagion/simulate` гоняет BFS-каскад. Curl-проверка из `205e535`: шок USD-Correspondent intensity=1.0 horizon=7 → `breached_count=2 (JPY-Tokyo, SGD-Singapore), total_loss_usd=$47.85M, affected=9`.

На фронте сейчас — 13-строчная заглушка `/contagion`, рендерит i18n-ключи `stub.contagion.title` / `stub.contagion.body`. После этого PR страница превращается в **рабочий cockpit-модуль**: SVG-граф 9 счетов с 16 рёбрами, форма «уронить контрагента + интенсивность + горизонт», панель пострадавших справа со списком и breach-бейджами. Без новых deps — нативный SVG поверх `framer-motion` (уже в проекте).

**Этот промпт — только фронт.** Бэк не трогать (он уже работает, контракт стабилен).

Сценарий, который должен заработать после PR:
1. Открыть `https://liquid-pilot.vercel.app/contagion` — граф рисуется сразу (до warm-up), USD-Correspondent в центре, остальные 8 счетов по кругу, 16 рёбер с толщиной по `exposure_usd`.
2. В левой панели — dropdown «уронить контрагента» (default USD-Correspondent), ползунок «intensity» (default 100%), ползунок «horizon days» (default 7), кнопка «Run cascade».
3. Клик «Run cascade» → правая панель показывает `breached_count=2`, `total_loss_usd=$47.85M`, ниже список 9 affected с hops/loss/post-balance/breach-бейджем. На графе шокированный узел красный и пульсирует, breached узлы — красные, affected — амбер, idle — серые.

---

## Архитектурное решение, которое уже принято за тебя

**Никаких новых либ.** Не добавлять `d3-force`, `react-flow`, `cytoscape`, `vis-network`, `react-force-graph`. В `package.json` уже есть `framer-motion` для анимации цвета/пульса. Граф рисуется нативным SVG.

**Layout — детерминированная радиальная раскладка** (не симуляция сил). USD-Correspondent ставится в центр (это hub в фикстуре, 5 исходящих рёбер). Остальные 8 счетов — равномерно по окружности радиуса 200 вокруг центра, **в алфавитном порядке по `account_id`** (фиксированный порядок, чтобы скриншот на демо и видео-запись был всегда одинаковым). Это не feature-flag, не «выбираемо пользователем» — статика.

**SVG-only.** Без Canvas, без WebGL, без `<foreignObject>`. Текст лейблов — `<text>`, узлы — `<circle>`, рёбра — `<line>` или `<path>`. Анимация цвета и пульсация — через `<motion.circle>` / `<motion.line>` из `framer-motion`.

**No polling.** Граф (`GET /network`) фетчится один раз при монтировании страницы. Не делать `setInterval` — это статика (фикстура), бэк не меняет её каждые 2 секунды.

---

## Файлы

| # | File | Action |
|---|------|--------|
| 1 | `frontend/src/types/api.ts` | APPEND types для контагиона |
| 2 | `frontend/src/lib/api.ts` | APPEND `getContagionNetwork()` + `runCascade()` |
| 3 | `frontend/src/i18n/messages/en.ts` | APPEND ~28 ключей `contagion.*` |
| 4 | `frontend/src/i18n/messages/ru.ts` | APPEND те же ~28 ключей (RU перевод) |
| 5 | `frontend/src/lib/contagion-layout.ts` | CREATE — pure-функции раскладки |
| 6 | `frontend/src/components/contagion/shock-form.tsx` | CREATE — форма управления |
| 7 | `frontend/src/components/contagion/network-graph.tsx` | CREATE — SVG-граф |
| 8 | `frontend/src/components/contagion/result-panel.tsx` | CREATE — список пострадавших |
| 9 | `frontend/src/app/(dashboard)/contagion/page.tsx` | REPLACE — 13-строчный stub → полноценная страница |

Итого 9 файлов: 2 APPEND в существующие, 2 APPEND в i18n, 5 NEW.

---

## Out of scope (НЕ ТРОГАЙ)

- `backend/**` — целиком read-only. Контракт API стабилен после `205e535`.
- `data/fixtures/contagion_exposures.json` — read-only, фикстура уже валидирована pytest'ом.
- `frontend/src/components/timemachine/**`, `frontend/src/components/autopilot/**`, `frontend/src/components/radar/**` — другие модули, не нужны.
- `frontend/src/i18n/messages/{en,ru}.ts` — **только APPEND** новых ключей `contagion.*`. Не удалять старые `stub.contagion.title` / `stub.contagion.body` (они станут orphan-ключами, это OK; чистка — отдельный PR, не сейчас). Не править существующие строки.
- `frontend/src/components/layout/sidebar.tsx` — пункт «Contagion» уже есть в навигации со строки 13, иконка `Network` из `lucide-react`. Не трогать.
- `package.json` — никаких новых deps. Если кажется что что-то нужно — оно не нужно, перечитай раскладку.
- `next.config.js`, `tsconfig.json`, `tailwind.config.js`, `postcss.config.js` — не трогать.

---

## Шаг 1 — типы (`frontend/src/types/api.ts`)

Сейчас файл заканчивается на `Recommendations` (строка 119). **Append в конец** следующие типы. Имена и поля — 1-в-1 как в бэк-схеме из `backend/app/api/routes/contagion.py` (`CascadeRequest` pydantic-модель) и `backend/app/services/liquidity/contagion.py` (`network_snapshot` / `simulate_cascade` возвращают dict с этой схемой).

```ts
export interface ContagionNode {
  account_id: string;
  currency: string;
  country: string;
  min_balance_usd: number;
  current_balance_usd: number;
}

export type ContagionEdgeKind = "intra-group" | "correspondent" | "market";

export interface ContagionEdge {
  from: string;
  to: string;
  exposure_usd: number;
  kind: ContagionEdgeKind;
  description: string;
}

export interface ContagionNetwork {
  nodes: ContagionNode[];
  edges: ContagionEdge[];
}

export interface CascadeRequest {
  shocked_account_id: string;
  intensity: number;        // 0..1
  horizon_days: number;     // 1..30
}

export interface CascadeHop {
  account_id: string;
  hops_from_shock: number;
  incoming_loss_usd: number;
  post_shock_balance_usd: number;
  min_balance_usd: number;
  breached: boolean;
  contributors: string[];
}

export interface CascadeResult {
  shocked_account_id: string;
  intensity: number;
  horizon_days: number;
  affected: CascadeHop[];
  breached_count: number;
  total_loss_usd: number;
}
```

**Внимание:** поля `from` и `to` в `ContagionEdge` — это **reserved-ish** имена в JS, но в `interface` они валидны и совпадают 1-в-1 с JSON-ключами бэка. Не переименовывать в `from_account` / `to_account` — бэк отдаёт именно `from` / `to`.

---

## Шаг 2 — API client (`frontend/src/lib/api.ts`)

Файл заканчивается на `runStressTest` (строка 50). **Append в конец** две функции по тому же паттерну. Базовый GET использует существующую `apiGet<T>`.

```ts
export function getContagionNetwork(signal?: AbortSignal) {
  return apiGet<ContagionNetwork>("/contagion/network", signal);
}

export async function runCascade(req: CascadeRequest): Promise<CascadeResult> {
  const res = await fetch(`${API_BASE}/contagion/simulate`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(req),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(
      `cascade simulation failed: ${res.status} ${res.statusText}${detail ? ` — ${detail}` : ""}`
    );
  }
  return (await res.json()) as CascadeResult;
}
```

И в импортах вверху файла (строки 1-8) **добавить** `CascadeRequest, CascadeResult, ContagionNetwork` в существующий список:

```ts
import type {
  Account,
  CascadeRequest,
  CascadeResult,
  ContagionNetwork,
  RadarInsights,
  Recommendations,
  StressRequest,
  StressResult,
  Transaction,
} from "@/types/api";
```

(Сохранить алфавитный порядок.)

---

## Шаг 3 — i18n (`frontend/src/i18n/messages/en.ts` и `ru.ts`)

**Append в конец** объекта `en` (до закрывающей `} as const;` на строке ~190) следующие 28 ключей. Затем зеркально — в `ru.ts` с переводами.

### EN

```ts
  "contagion.title": "Contagion — network cascade simulator",
  "contagion.subtitle":
    "Drop a counterparty, watch the shock propagate through your bilateral exposures. Bank epidemiology view of liquidity risk.",

  "contagion.shock.title": "Shock controls",
  "contagion.shock.account": "Drop counterparty",
  "contagion.shock.intensity": "Intensity",
  "contagion.shock.horizon": "Horizon (days)",
  "contagion.shock.run": "Run cascade",
  "contagion.shock.running": "Running...",

  "contagion.result.title": "Cascade result",
  "contagion.result.empty":
    "Pick a counterparty on the left and run the simulation. The affected accounts will appear here with breach status and hop distance.",
  "contagion.result.breachedCount": "Breached",
  "contagion.result.totalLoss": "Total loss (USD)",
  "contagion.result.affectedCount": "Affected accounts",
  "contagion.result.hopBadge": "hop {n}",
  "contagion.result.postBalance": "Post-shock",
  "contagion.result.minBalance": "Floor",
  "contagion.result.loss": "Loss",

  "contagion.node.shocked": "Shocked",
  "contagion.node.breached": "Breached",
  "contagion.node.affected": "Affected",
  "contagion.node.idle": "Idle",

  "contagion.legend.title": "Legend",
  "contagion.edge.kind.intra-group": "Intra-group",
  "contagion.edge.kind.correspondent": "Correspondent",
  "contagion.edge.kind.market": "Market",

  "contagion.error.engineWarming":
    "Engine is still warming up. Wait ~30 seconds and click Run again.",
  "contagion.error.network":
    "Could not load contagion graph from backend.",
```

### RU

```ts
  "contagion.title": "Сетевой риск — симулятор каскада",
  "contagion.subtitle":
    "Уроните контрагента — увидите как шок пройдёт по сети ваших bilateral exposures. Эпидемиология банков для ликвидности.",

  "contagion.shock.title": "Управление шоком",
  "contagion.shock.account": "Уронить контрагента",
  "contagion.shock.intensity": "Интенсивность",
  "contagion.shock.horizon": "Горизонт (дней)",
  "contagion.shock.run": "Запустить каскад",
  "contagion.shock.running": "Запуск...",

  "contagion.result.title": "Результат каскада",
  "contagion.result.empty":
    "Выберите контрагента слева и запустите симуляцию. Пострадавшие счета появятся здесь со статусом пробоя и хоп-дистанцией.",
  "contagion.result.breachedCount": "Пробои",
  "contagion.result.totalLoss": "Совокупный убыток (USD)",
  "contagion.result.affectedCount": "Затронуто счетов",
  "contagion.result.hopBadge": "хоп {n}",
  "contagion.result.postBalance": "После шока",
  "contagion.result.minBalance": "Минимум",
  "contagion.result.loss": "Убыток",

  "contagion.node.shocked": "Шок",
  "contagion.node.breached": "Пробой",
  "contagion.node.affected": "Затронут",
  "contagion.node.idle": "Норма",

  "contagion.legend.title": "Легенда",
  "contagion.edge.kind.intra-group": "Внутри группы",
  "contagion.edge.kind.correspondent": "Корреспондент",
  "contagion.edge.kind.market": "Рыночный",

  "contagion.error.engineWarming":
    "Движок ещё прогревается. Подождите ~30 секунд и нажмите Запустить снова.",
  "contagion.error.network":
    "Не удалось загрузить граф контагиона с бэкенда.",
```

**Ключи с дефисом в имени** (`contagion.edge.kind.intra-group`) — валидны, так уже сделано в `radar.legend.totalInFlight` и др. (как ключи объекта в кавычках). Используются в коде через `t("contagion.edge.kind.intra-group")` — TypeScript разрешает (это string literal в keyof).

**Не удалять** `stub.contagion.title` и `stub.contagion.body` из обоих файлов. Они станут orphan-keys (нигде не используются), но `MessageKey = keyof typeof en` шире чем «используемые ключи» — это OK. Чистка orphan-keys = отдельный PR.

---

## Шаг 4 — layout-модуль (`frontend/src/lib/contagion-layout.ts`)

**Создать новый файл** с pure-функциями раскладки. Без React, без хуков — это математика. Тестируется тривиально (вход → детерминированный выход).

```ts
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
export function accountPositions(nodes: ContagionNode[]): Record<string, Position> {
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
export function hasReverse(edge: ContagionEdge, edges: ContagionEdge[]): boolean {
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

  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len < 1) return "";

  const ux = dx / len;
  const uy = dy / len;

  // Shorten by NODE_RADIUS on both ends so the arrowhead sits outside
  // the destination circle.
  const x1 = a.x + ux * NODE_RADIUS;
  const y1 = a.y + uy * NODE_RADIUS;
  const x2 = b.x - ux * NODE_RADIUS;
  const y2 = b.y - uy * NODE_RADIUS;

  if (!hasReverse(edge, edges)) {
    return `M ${x1.toFixed(1)} ${y1.toFixed(1)} L ${x2.toFixed(1)} ${y2.toFixed(1)}`;
  }

  // Perpendicular offset for a bidirectional pair. The sign depends on
  // whether the edge is in "forward" alphabetical direction so both
  // halves get opposite-side arcs.
  const forward = edge.from < edge.to;
  const offset = forward ? 22 : -22;
  const mx = (x1 + x2) / 2 + -uy * offset;
  const my = (y1 + y2) / 2 + ux * offset;
  return `M ${x1.toFixed(1)} ${y1.toFixed(1)} Q ${mx.toFixed(1)} ${my.toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}`;
}

/**
 * Edge stroke width as a function of exposure size. Clamped to keep
 * the smallest edges still legible (≥ 1.5px) and the largest from
 * dominating the view (≤ 7px).
 */
export function edgeWidth(exposure_usd: number): number {
  return Math.max(1.5, Math.min(7, exposure_usd / 1_000_000));
}
```

---

## Шаг 5 — shock-form (`frontend/src/components/contagion/shock-form.tsx`)

Левая управляющая панель. Структурно — как `frontend/src/components/timemachine/scenario-picker.tsx` (та же стилистика `glass-card rounded-2xl`, та же сетка label + slider, та же кнопка). **Создать новый файл:**

```tsx
"use client";

import { useLocale } from "@/i18n/locale-context";
import type { CascadeRequest, ContagionNode } from "@/types/api";
import { displayAccountLabel } from "@/lib/format";

interface Props {
  nodes: ContagionNode[];
  value: CascadeRequest;
  onChange: (v: CascadeRequest) => void;
  onRun: () => void;
  loading: boolean;
}

export default function ShockForm({
  nodes,
  value,
  onChange,
  onRun,
  loading,
}: Props) {
  const { t } = useLocale();

  // Alphabetical for deterministic UI. The default is set in the page,
  // not here, so this list is purely presentation.
  const sorted = [...nodes].sort((a, b) =>
    a.account_id.localeCompare(b.account_id)
  );

  return (
    <div className="glass-card rounded-2xl p-4 space-y-3">
      <h2 className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
        {t("contagion.shock.title")}
      </h2>

      <div>
        <label className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground block mb-1">
          {t("contagion.shock.account")}
        </label>
        <select
          value={value.shocked_account_id}
          onChange={(e) =>
            onChange({ ...value, shocked_account_id: e.target.value })
          }
          className="w-full bg-slate-50 border border-slate-200 rounded-md px-2 py-1.5 font-mono text-xs"
        >
          {sorted.map((n) => (
            <option key={n.account_id} value={n.account_id}>
              {displayAccountLabel(n.account_id)}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground block mb-1">
          {t("contagion.shock.intensity")}:{" "}
          <span className="text-foreground font-bold">
            {Math.round(value.intensity * 100)}%
          </span>
        </label>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={value.intensity}
          onChange={(e) =>
            onChange({ ...value, intensity: Number(e.target.value) })
          }
          className="w-full"
        />
      </div>

      <div>
        <label className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground block mb-1">
          {t("contagion.shock.horizon")}:{" "}
          <span className="text-foreground font-bold">
            {value.horizon_days}
          </span>
        </label>
        <input
          type="range"
          min={1}
          max={30}
          value={value.horizon_days}
          onChange={(e) =>
            onChange({ ...value, horizon_days: Number(e.target.value) })
          }
          className="w-full"
        />
      </div>

      <button
        type="button"
        onClick={onRun}
        disabled={loading}
        className="w-full bg-primary text-primary-foreground rounded-md px-3 py-2 font-mono text-xs font-semibold uppercase tracking-widest hover:opacity-90 disabled:opacity-50 transition-opacity"
      >
        {loading ? t("contagion.shock.running") : t("contagion.shock.run")}
      </button>
    </div>
  );
}
```

---

## Шаг 6 — graph-component (`frontend/src/components/contagion/network-graph.tsx`)

**Создать новый файл.** Центральная SVG-визуализация. Props:

- `nodes` — все узлы (из `GET /network`)
- `edges` — все рёбра (16 шт.)
- `result` — `CascadeResult | null`. Когда `null` — все узлы серые, рёбра серые. Когда задан — раскрашиваем по `affected` массиву и `shocked_account_id`.

**Палитра цветов** (hex literals, не tailwind-классы — внутри SVG `fill`/`stroke`):

| Состояние узла | Условие | `fill` | Анимация |
|---|---|---|---|
| `shocked` | `account_id === result.shocked_account_id` | `#dc2626` (rose-600) | Пульс `scale 1 → 1.15 → 1`, 1.4s loop, framer-motion |
| `breached` | `affected.find(h => h.account_id === id)?.breached === true` | `#dc2626` (rose-600) | Нет |
| `affected` | в `affected` но не breached | `#f59e0b` (amber-500) | Нет |
| `idle` | не в `affected` и не shocked, либо `result === null` | `#94a3b8` (slate-400) | Нет |

**Цвет ребра** — по состоянию его **destination** (`to`) узла. Idle = `#cbd5e1` (slate-300), affected = `#fbbf24` (amber-400), breached = `#dc2626`, shocked = `#dc2626`. Толщина — через `edgeWidth(exposure_usd)`.

**Arrowhead-markers** — один `<defs>` с тремя `<marker>` (idle / affected / breached), референсятся в `<path>` через `marker-end="url(#arrow-idle)"` и т.п.

**Текст**: под каждым узлом — `displayAccountLabel(account_id)` (импорт из `@/lib/format`), `font-size=11`, `text-anchor=middle`, `dy={NODE_RADIUS + 14}`. Для hub узла — отрисовать лейбл **над** узлом (`dy={-NODE_RADIUS - 6}`) чтобы не наезжал на спицы.

```tsx
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
              <path
                d="M 0 0 L 10 5 L 0 10 z"
                fill={EDGE_STROKE[state]}
              />
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
                {e.from} → {e.to} · ${(e.exposure_usd / 1_000_000).toFixed(1)}M · {e.kind}
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
                  state === "shocked"
                    ? { scale: [1, 1.15, 1] }
                    : { scale: 1 }
                }
                transition={
                  state === "shocked"
                    ? { duration: 1.4, repeat: Infinity, ease: "easeInOut" }
                    : { duration: 0 }
                }
              >
                <title>
                  {n.account_id} · {n.currency} · ${(n.current_balance_usd / 1_000_000).toFixed(1)}M
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
```

**Замечания:**
- `viewBox` фиксирован `0 0 800 640` — соотношение 5:4. Контейнер на странице задаст реальный размер; SVG скейлится автоматически.
- Используем `motion.circle` только для шокированного узла (пульс). Остальные — обычные `<circle>`, чтобы не платить за анимацию там где её нет.
- `transition.duration: 0` для не-shocked — это явный «без анимации», иначе framer пытается анимировать в idle.
- `<title>` внутри path/circle даёт нативный browser-tooltip (без `radix-ui/react-tooltip` — он бы потребовал отдельного `TooltipProvider` и сделал бы рендер тяжелее).

---

## Шаг 7 — result-panel (`frontend/src/components/contagion/result-panel.tsx`)

**Создать новый файл.** Правая колонка. Когда `result === null` — empty-state с текстом из `contagion.result.empty`. Когда задан — header с тремя метриками + список пострадавших.

```tsx
"use client";

import { useLocale, localeToIntl } from "@/i18n/locale-context";
import { formatNumber, formatMoneyCompact, displayAccountLabel } from "@/lib/format";
import type { CascadeResult } from "@/types/api";

interface Props {
  result: CascadeResult | null;
  error: string | null;
}

export default function ResultPanel({ result, error }: Props) {
  const { t, locale } = useLocale();
  const intl = localeToIntl(locale);

  if (error) {
    return (
      <div className="glass-card rounded-2xl p-4 space-y-2">
        <h2 className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
          {t("contagion.result.title")}
        </h2>
        <p className="text-xs text-rose-700 font-mono leading-relaxed">{error}</p>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="glass-card rounded-2xl p-4 space-y-2">
        <h2 className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
          {t("contagion.result.title")}
        </h2>
        <p className="text-xs text-muted-foreground leading-relaxed">
          {t("contagion.result.empty")}
        </p>
      </div>
    );
  }

  return (
    <div className="glass-card rounded-2xl p-4 space-y-3">
      <h2 className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
        {t("contagion.result.title")}
      </h2>

      <div className="grid grid-cols-3 gap-2">
        <Metric
          label={t("contagion.result.breachedCount")}
          value={String(result.breached_count)}
          tone={result.breached_count > 0 ? "rose" : "neutral"}
        />
        <Metric
          label={t("contagion.result.totalLoss")}
          value={`$${formatMoneyCompact(result.total_loss_usd, intl)}`}
          tone="rose"
        />
        <Metric
          label={t("contagion.result.affectedCount")}
          value={String(result.affected.length)}
          tone="neutral"
        />
      </div>

      <div className="space-y-2 overflow-y-auto pr-1">
        {result.affected.map((hop) => (
          <div
            key={hop.account_id}
            className={`rounded-lg p-2 border ${
              hop.breached
                ? "bg-rose-50 border-rose-200"
                : "bg-slate-50 border-slate-200"
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="font-mono text-xs font-semibold">
                {displayAccountLabel(hop.account_id)}
              </span>
              <div className="flex items-center gap-1">
                <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground px-1.5 py-0.5 rounded bg-slate-200">
                  {t("contagion.result.hopBadge", { n: hop.hops_from_shock })}
                </span>
                {hop.breached && (
                  <span className="text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-600 border border-rose-500/30">
                    {t("contagion.node.breached")}
                  </span>
                )}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 text-[10px] font-mono">
              <Stat
                label={t("contagion.result.loss")}
                value={`-$${formatMoneyCompact(hop.incoming_loss_usd, intl)}`}
                tone="rose"
              />
              <Stat
                label={t("contagion.result.postBalance")}
                value={`$${formatMoneyCompact(hop.post_shock_balance_usd, intl)}`}
                tone={hop.breached ? "rose" : "neutral"}
              />
              <Stat
                label={t("contagion.result.minBalance")}
                value={`$${formatMoneyCompact(hop.min_balance_usd, intl)}`}
                tone="neutral"
              />
            </div>
            {hop.contributors.length > 0 && (
              <p
                className="text-[10px] font-mono text-muted-foreground mt-1 truncate"
                title={hop.contributors.join(", ")}
              >
                via {hop.contributors.map(displayAccountLabel).join(", ")}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "rose" | "neutral";
}) {
  return (
    <div>
      <div className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground mb-0.5">
        {label}
      </div>
      <div
        className={`text-sm font-bold tabular-nums ${
          tone === "rose" ? "text-rose-600" : "text-foreground"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "rose" | "neutral";
}) {
  return (
    <div>
      <div className="text-muted-foreground uppercase tracking-widest text-[8px]">
        {label}
      </div>
      <div
        className={`tabular-nums font-semibold ${
          tone === "rose" ? "text-rose-600" : "text-foreground"
        }`}
      >
        {value}
      </div>
    </div>
  );
}
```

**Замечания:**
- Используем существующие `formatNumber` (импортирован но может не понадобиться — оставь, TypeScript отрежет если unused), `formatMoneyCompact`, `displayAccountLabel` из `@/lib/format`. `useLocale` + `localeToIntl` из `@/i18n/locale-context`.
- `contagion.result.hopBadge` — параметризованный, как `account.txCount` (`"Транзакций: {n}"`). Шаблонизация уже работает в `interpolate()` в `locale-context.tsx`.
- `contributors` — список account_id, через которых пришёл шок. Полезно для тултипа («каскад пришёл через EUR-Main → EUR-Berlin»). Если массив пустой (прямой сосед hub'а — `contributors=[shocked_account_id]`), всё равно показать строку — это даёт визуальную цепочку.

Если `formatNumber` остаётся unused — удали из импорта. TypeScript otherwise warns. Альтернатива: не импортируй его с самого начала.

---

## Шаг 8 — страница (`frontend/src/app/(dashboard)/contagion/page.tsx`)

**REPLACE целиком** (был 13-строчный stub). Layout: вверху glass-card с title/subtitle (как у Time Machine), под ней грид `[18rem, 1fr, 22rem]` — слева shock-form, в центре график на `aspect-[5/4]` чтобы держал пропорцию SVG, справа result-panel. На узких экранах (lg-breakpoint) — стек в одну колонку.

```tsx
"use client";

import { useEffect, useState } from "react";
import { useLocale } from "@/i18n/locale-context";
import { getContagionNetwork, runCascade } from "@/lib/api";
import type {
  CascadeRequest,
  CascadeResult,
  ContagionNetwork,
} from "@/types/api";
import ShockForm from "@/components/contagion/shock-form";
import NetworkGraph from "@/components/contagion/network-graph";
import ResultPanel from "@/components/contagion/result-panel";

export default function ContagionPage() {
  const { t } = useLocale();

  const [network, setNetwork] = useState<ContagionNetwork | null>(null);
  const [networkError, setNetworkError] = useState<string | null>(null);

  const [req, setReq] = useState<CascadeRequest>({
    // Default = the hub from the fixture. Mirrors the curl demo in
    // 0009's verification log so the page reproduces the same numbers
    // out of the box.
    shocked_account_id: "USD-Correspondent",
    intensity: 1.0,
    horizon_days: 7,
  });
  const [result, setResult] = useState<CascadeResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch the bilateral exposure graph once on mount. This endpoint
  // is safe before warm-up (returns opening balances).
  useEffect(() => {
    const controller = new AbortController();
    getContagionNetwork(controller.signal)
      .then((data) => {
        setNetwork(data);
        setNetworkError(null);
      })
      .catch((e) => {
        if ((e as Error).name === "AbortError") return;
        setNetworkError(t("contagion.error.network"));
      });
    return () => controller.abort();
  }, [t]);

  const run = async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await runCascade(req);
      setResult(r);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      // Backend returns 503 with "Engine warming up" body when not
      // ready. Map to a friendly localised message.
      if (msg.includes("503") || msg.toLowerCase().includes("warming")) {
        setError(t("contagion.error.engineWarming"));
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-[calc(100vh-4rem)]">
      <div className="glass-card rounded-2xl px-5 py-3 mx-6 mt-4 shrink-0">
        <h1 className="text-xl font-bold leading-tight">
          {t("contagion.title")}
        </h1>
        <p className="text-xs text-muted-foreground mt-1 leading-snug">
          {t("contagion.subtitle")}
        </p>
      </div>

      <div className="flex-1 min-h-0 p-4">
        <div className="grid grid-cols-1 lg:grid-cols-[18rem,1fr,22rem] gap-4 h-full">
          {network ? (
            <ShockForm
              nodes={network.nodes}
              value={req}
              onChange={setReq}
              onRun={run}
              loading={loading}
            />
          ) : (
            <div className="glass-card rounded-2xl p-4 text-xs font-mono text-muted-foreground">
              {networkError ?? "Loading network…"}
            </div>
          )}

          <div className="glass-card rounded-2xl p-4 flex items-center justify-center min-h-[480px]">
            {network ? (
              <NetworkGraph
                nodes={network.nodes}
                edges={network.edges}
                result={result}
              />
            ) : (
              <span className="text-xs font-mono text-muted-foreground">
                {networkError ?? "Loading network…"}
              </span>
            )}
          </div>

          <ResultPanel result={result} error={error} />
        </div>
      </div>
    </div>
  );
}
```

---

## Шаг 9 — manual screenshot acceptance в PR-body

Фронт-теста нет (по `.devin/prompt-craft.md`). В PR body **приложи 4 скриншота**:
1. `/contagion` сразу после загрузки — граф нарисован, никакой симуляции не запущено, все узлы серые, result-panel показывает empty-state.
2. `/contagion` после клика «Run cascade» с default'ами (USD-Correspondent / 100% / 7d) — USD-Correspondent красный и пульсирует (стрелочкой в кэпшоне «пульсация в видео»), JPY-Tokyo и SGD-Singapore красные (breached), остальные 6 — амбер. Result-panel: `breached_count=2`, `total_loss_usd ≈ $47.85M`, 9 пострадавших.
3. `/contagion` с шоком EUR-Main intensity=50% horizon=14 — другая раскраска, проверяет что dropdown работает.
4. `/contagion` на RU локали — все лейблы переведены (`Сетевой риск — симулятор каскада`, `Уронить контрагента`, `Запустить каскад`, `Пробои: 2`, `Совокупный убыток (USD): $47.9M` и т.п.).

В описании PR также приложи curl-вывод `POST /contagion/simulate` для проверки что цифры на скрине совпадают с бэк-ответом 1-в-1.

---

## Acceptance criteria

**Все должны быть true** перед merge:

### Сборка
- `cd frontend && npm run lint` — без warnings/errors. (ESLint 8 + eslint-config-next.)
- `cd frontend && npx tsc --noEmit` — 0 errors.
- `cd frontend && npm run build` — green. Bundle `/contagion` < 30 kB First Load (контрольная цифра — сейчас stub весит ~2 kB, после правок будет 15-25 kB, framer-motion уже в shared chunk'е).
- Сервер `cd backend && uvicorn app.main:app --port 8000` запускается, `GET /contagion/network` отдаёт `nodes.length === 9` и `edges.length === 16`.

### UI / поведение
- Открыть `http://localhost:3000/contagion`: граф рисуется в течение ~1 сек, никаких «Loading network…» дольше пары мигов; никакого FOUC заглушки «Граф сетевого контагиона — будет в Phase 5» (старый stub-текст не должен мелькнуть нигде).
- Default-значения формы: account=`USD-Correspondent`, intensity=`100%`, horizon=`7`. Это совпадает с curl-демо из 0009.
- Dropdown содержит 9 пунктов, отсортированных по `account_id` (значит порядок: `CHF-Zurich`, `EUR-Berlin`, `EUR-Main`, `GBP-Local`, `JPY-Tokyo`, `KZT-Almaty`, `SGD-Singapore`, `USD-Correspondent`, `USD-LA`). Default-selected — `USD-Correspondent` (8-й в списке).
- Кнопка `Run cascade` дизейблится на время фетча, текст меняется на `Running...` (или `Запуск...` на RU).
- После успешного клика: правая панель содержит ≥ 5 строк affected (для default'ов — 9), ≥ 1 breached, summary 3 метрики.
- Шокированный узел пульсирует (видно глазом в браузере; на статическом скрине добавь стрелочку в кэпшоне).
- Локаль-переключатель в топбаре меняет все строки на странице (включая summary-метрики и item-row labels). RU и EN покрытие 100%.

### Визуал
- USD-Correspondent в центре viewBox, остальные 8 — равномерно по кругу.
- Стрелки направлений видны на всех 16 рёбрах.
- Bidirectional пары (`EUR-Main↔EUR-Berlin`, `EUR-Main↔GBP-Local`, `EUR-Main↔CHF-Zurich`, `JPY-Tokyo↔SGD-Singapore`, `USD-Correspondent↔USD-LA`) — рисуются двумя дугами, не накладываются друг на друга.
- Толщина ребра пропорциональна `exposure_usd`: `USD-Correspondent→USD-LA` ($6.8M) явно толще чем `CHF-Zurich→EUR-Main` ($0.8M).
- Лейблы узлов не наезжают друг на друга и на рёбра.

### i18n
- `npm run lint` не ругается на unused i18n keys (если есть такой rule — на этом проекте его нет, но проверь что новые ключи действительно где-то используются).
- Все 28 ключей `contagion.*` присутствуют **в обоих** `en.ts` и `ru.ts`. TypeScript падает если в `ru.ts` хотя бы один пропущен (типизация через `Record<keyof typeof en, string>`).

### Регрессия
- `/radar`, `/autopilot`, `/timemachine` работают как раньше — никаких изменений в их поведении или стиле. Если что-то поплыло — значит туда залезли по ошибке.

---

## Не делать (anti-patterns, повторяю)

1. **Не добавлять никаких новых deps в `package.json`.** Если кажется что нужен `d3`, `react-flow`, `cytoscape`, `vis-network`, `react-force-graph-2d`, `recharts`, `chart.js`, `nivo` — стоп, не нужен. SVG нативный.
2. **Не бампать `next` / `react` / `react-dom`.** Они pinned. Если получаешь peer-deps warning при `npm install` — это не твоя проблема в этом PR, игнорь.
3. **Не трогать `backend/**`** — даже если найдёшь там опечатку. Backend в этом PR read-only, контракт стабилен.
4. **Не модифицировать `data/fixtures/contagion_exposures.json`** — фикстура валидирована pytest'ом, любое изменение ломает тесты на бэке.
5. **Не удалять `stub.contagion.title` / `stub.contagion.body`** из i18n. Чистка orphan-keys — отдельный PR.
6. **Не оборачивать API-вызовы в `try/catch` без обработки.** Если catch — должен либо setError, либо re-throw. Просто `catch (e) {}` запрещён.
7. **Не делать polling** `GET /network`. Это статика. Один фетч на mount.
8. **Не делать кастомный `useFetch` хук** ради одного эндпоинта. На странице `useEffect + setState` — нормально для одного запроса.
9. **Не комментировать diff** комментариями вида `// fix for X` или `// previously this did Y`. Комментарии должны описывать **что код делает** в общем смысле, не **что ты сейчас изменил**.
10. **Не симулировать каскад на фронте.** Считать его в JS из `network` + intensity — соблазн, но это дублирование с бэкенд-кодом из `205e535`, который уже отвалидирован 6 pytest'ами. Только `POST /simulate` → ответ → render.
11. **Не добавлять polling/обновления `result`** после первого `runCascade`. Каскад вызывается явно по кнопке.
12. **Не использовать `react-three-fiber` / `three`** — они в `package.json` для глобуса в Radar, не для этого графа.
13. **Не делать «drive-by» рефакторинги** в Time Machine / Autopilot / Radar / Sidebar / format.ts. Минимальный diff. Если функция из `format.ts` нужна и она уже экспортирована — используй; если нет — экспортни добавочно, но **не переписывай существующее**.

---

## Дополнительно

- **PR title:** `feat(contagion): bilateral exposure graph viz + cascade form (Phase 5 frontend)`
- **Commit message:** тот же.
- **Branch:** `feat/contagion-frontend` или `<github-user>/contagion-frontend`.
- **PR body:** must include
  - Diff summary (`X files changed, +Y -Z`)
  - 4 manual screenshots (см. Шаг 9)
  - Curl-вывод `POST /contagion/simulate` + JSON ответа (для cross-check цифр в правой панели)
  - Bundle size diff (`First Load` цифры из `next build`)
- **Никаких force-push'ей.** Если правишь по review-комментариям — только новый commit.

После того как PR будет merged — отрапортуй с SHA + diff stat + cobra-style note про любые отступления от спеки (если они были). Я обновлю `.devin/state.md` и `INDEX.md` и закрою Phase 5.
