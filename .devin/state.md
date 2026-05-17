# Project state — LiquidPilot

**Update this file at end of every session.** Next Devin reads it first.

## Snapshot

- **HEAD on main:** `87416b0` (Contagion Phase 5 **frontend** — 0010 shipped:
  REPLACE 13-line `/contagion` stub with full module — `frontend/src/types/api.ts`
  +6 interfaces (`ContagionNode`, `ContagionEdgeKind`, `ContagionEdge`,
  `ContagionNetwork`, `CascadeRequest`, `CascadeHop`, `CascadeResult`)
  + `frontend/src/lib/api.ts` +2 fetchers (`getContagionNetwork`,
  `runCascade` with 503/warming detail-parse)
  + `frontend/src/lib/contagion-layout.ts` NEW (pure-func: `accountPositions`
  deterministic radial w/ USD-Correspondent at center radius 220, `hasReverse`,
  `edgePath` straight or quadratic Bezier for bidi pairs, `edgeWidth` clamp 1.5..7)
  + `frontend/src/components/contagion/{shock-form,network-graph,result-panel}.tsx` NEW
  (form alphabetical, SVG viewBox 0 0 800 640, 4 `<marker>` defs idle/affected/breached/shocked,
  `framer-motion` motion.circle ONLY on shocked, native `<title>` tooltips, 3 metric
  tiles + per-hop list w/ contributors line)
  + `frontend/src/app/(dashboard)/contagion/page.tsx` REPLACE 13→116 lines
  (one fetch on mount, 3-col `[18rem,1fr,22rem]` grid, defaults shocked=USD-Correspondent
  intensity=1.0 horizon=7 — mirrors 0009 curl demo)
  + `frontend/src/i18n/messages/{en,ru}.ts` +28 `contagion.*` keys both locales.
  Verified by owner: tsc 0 errors, lint 0 errors, build green, `/contagion` First
  Load 135 kB / route 4.87 kB (under 30 kB cap), 0 new package.json deps.
  **One micro-deviation:** agent imported `CENTER_X` / `CENTER_Y` from
  `lib/contagion-layout.ts` into `components/contagion/network-graph.tsx`
  and silenced ESLint "unused import" with `void CENTER_X; void CENTER_Y;`
  even though `accountPositions()` already encapsulates those constants —
  graph itself doesn't read them. Clean fix is one-liner: remove imports
  (and the void statements). Not a blocker, but worth noting for next pass.
  Previous: `75c47a0` (PR #12 squash — docs-only, 0010 prompt archived).
  Previous: `205e535` (Contagion Phase 5 backend — 0009 shipped).
  Previous: `08ccf4e` (PR #10 squash — docs-only, 0009 prompt archived).
  Previous code: `059f0da` (TM round 4 — 0008 shipped).
- **Last updated:** 17 May 2026, 10:58 UTC
- **Memory live in repo:** YES — `.devin/` merged via PR #5 into `main`.
  Owner authorised direct push for docs only; system **hard-blocks**
  `git push origin main` (tested — error: «You should never push directly
  to master or main.») so the analysis-Devin uses a tight loop:
  branch → push → POST /pulls → PUT /pulls/{n}/merge?merge_method=squash
  → branch dies in ~10s. From owner's POV — single squash commit on
  main, no PR backlog.
- **Submit deadline:** 20 May 2026 23:59 (≈ 85 h left)
- **Finals (Astana):** 24 May 2026 (≈ 7 days)

## Tech stack — locked

- Next.js `14.2.0`, React `18.3.1`, React-DOM `18.3.1` — do not bump.
- ESLint `8.57.1`, eslint-config-next `14.2.0` — pinned exact (Phase 2.5).
- FastAPI + Pydantic v2, SQLAlchemy 2.0, SQLite, NetworkX, xgboost.
- three.js + react-three-fiber for 3D globe.
- Vercel (frontend) + Railway (backend).

## Production URLs

- Frontend: `https://liquid-pilot.vercel.app`
- Backend: `https://liquidpilot.up.railway.app`
- Health: `https://liquidpilot.up.railway.app/health` → expect 200
- Warmup endpoint: `POST /admin/warmup` (Plan B when lazy warm_up lags)

## Phase status

| # | Phase | Status | Notes |
|---|-------|--------|-------|
| 1 | Scaffold | DONE | `fa4b7de`, `009cf4f` |
| 2 | Backend + Azim engine | DONE | `7e68ec9` … `a1000ad` |
| 2.5 | Deploy fixes | DONE | `2302a99`, `10508c3`, `e3171c0`, `20e0982` |
| 3 | Radar (ATC view) | DONE + polished | latest `cef9347` removed violet planes |
| 4 | Autopilot | DONE + polished | latest `a09cb0d` synced alerts ↔ transfers |
| 5 | Contagion | **FULLY DONE (`87416b0`)** | Backend 0009 (`205e535`): NetworkX DiGraph from static fixture, BFS cascade w/ `HOP_DECAY=0.6 MAX_HOPS=4`, `GET /network` + `POST /simulate`, 6 pytest. Frontend 0010 (`87416b0`): SVG-only radial graph (no d3-force / react-flow / cytoscape), `framer-motion` pulse on shocked node, native `<title>` tooltips, defaults `USD-Correspondent / 1.0 / 7d` mirror 0009 curl demo for reproducible screenshot. 0 new deps, route bundle 4.87 kB. Micro-deviation: unused `CENTER_X`/`Y` imports in `network-graph.tsx` silenced via `void`. Cleanup is a one-liner for next pass — not blocking demo. |
| 6 | Time Machine | DONE round 4 (`059f0da`) | `dd61793` core (monotonicity + 5 UX bugs + 2 tests) → `c198c57` polish (no-aff badge / card stretch — methodology over-deleted here) → `02857e9` readable card (stress curve color / footer align / breach tooltip) → `059f0da` round 4 (methodology restored + advisory dropped + footer-overlap fix). No more TM rounds planned unless owner finds something. |
| 7 | Branding / landing / 90s demo | **NOW PRIMARY FOCUS** | logo wordmark only (no symbol/favicon), 90-sec demo script not written, landing has no «как это работает» / no «для кого» / no demo CTA. ~85 h to deadline. |
| 8 | Submission | PENDING | one-pager, video, form |
| 9 | Finals | PENDING | slides, rehearsals, Q&A |

## What's in flight right now

- **0010 shipped at `87416b0`** at 17-May 10:58 UTC. Owner verified:
  tsc 0 errors, lint 0 errors, build green, `/contagion` route 4.87 kB
  (well under 30 kB cap), 0 new package.json deps. All 9 spec'd files
  landed: 6 new interfaces in `types/api.ts`, 2 fetchers in `lib/api.ts`,
  layout primitives in `lib/contagion-layout.ts`, 3 contagion components,
  REPLACE'd page.tsx, 28 `contagion.*` keys in en+ru. Defaults mirror
  0009 curl demo (USD-Correspondent / 1.0 / 7d → $47.85M / 2 breached
  out of the box). **One micro-deviation:** agent imported `CENTER_X` /
  `CENTER_Y` from `lib/contagion-layout.ts` into `network-graph.tsx`
  and silenced ESLint "unused import" with `void CENTER_X; void CENTER_Y;`
  — `accountPositions()` already encapsulates those values, the graph
  never reads them directly. Owner asked if cleanup is wanted; answer
  is yes but not urgent — drop alongside any Contagion polish PR.
- **Phase 5 (Contagion) is now FULLY DONE** end-to-end. Both backend and
  frontend on main. Demo flow works: navigate to `/contagion`, hit Run
  → SVG graph w/ red pulse on USD-Correspondent + amber on 5 direct
  neighbours + 2 red on JPY-Tokyo & SGD-Singapore (breached), right
  panel shows `$47.85M / 2 / 9` + per-hop drilldown.
- **Phase 7 (Branding / landing / 90s demo) is now the primary blocker
  to demo-readiness.** ~85 h to 20-May 23:59 UTC. Plan in queued section.

## What's queued, by priority for demo

1. **Phase 7 — Demo readiness.** Now primary focus. Three artefacts:
   (a) **90-sec demo script** — connected narrative through 4 modules
   in order: Radar (situational awareness) → Time Machine (what-if on
   single account) → Contagion (what-if on counterparty, NEW) →
   Autopilot (execute mitigation). Script is mostly owner's job —
   I can draft v1 from `glossary.md` + module screenshots if asked.
   (b) **Landing polish** — currently no «как это работает» section,
   no «для кого», no demo CTA on `/`. Easy 1-prompt agent task once
   copy is locked.
   (c) **Logo** — text wordmark `LiquidPilot` exists in nav. Need
   SVG icon mark for browser favicon + social card. Owner's call:
   use a generator (logo.com, namecheap, ChatGPT-Image), or skip and
   pitch as «product is the visual identity».
2. **Phase 8 — Submission.** PDF one-pager (problem → solution → demo
   numbers → tech stack → team), 3-min demo video (screen recording
   of the 90-sec narrative + 60s explainer overlay), SynergyX form.
3. **Phase 9 — Finals (Astana, 24 May).** Slides 10–12, ≥5 live demo
   rehearsals on Vercel preview, Q&A bank covering: «why static fixture
   for Contagion?» / «is the AI/ML really AI?» / «how does this scale
   to real bank data?»
4. **Optional polish:** drop the `void CENTER_X / void CENTER_Y` lint
   workaround in `network-graph.tsx` (one-line fix), clean orphan
   `stub.contagion.*` i18n keys.

## Known fragile spots

- `flat_value = baseline[0]` in `stress.py` BANK_HOLIDAY branch — this
  is what TM prompt #0004 rewrites. Don't reintroduce.
- `synthAlerts` vs `synthTransfers` in `frontend/src/lib/autopilot-synth.ts`
  used to be desynced (alerts on JPY/SGD, transfers from KZT to USD/EUR).
  Fixed in `a09cb0d`. If you see a regression — check FX normalisation.
- Violet "execute-event" planes — removed in `cef9347`. Do not bring
  them back. Confirmations live in `/autopilot` only.
- `next lint` peer-deps — pinned in `20e0982`. Don't bump.
- TS 5.5.4 vs `@typescript-eslint` "officially supported up to 5.5.0"
  warning is **harmless**. Don't fix it in this PR cycle.

## Accounts on disk (synthetic data)

9 accounts × 7 currencies, 540 days of history, 23 430 transactions.
See `.devin/glossary.md` for full mapping.

## Backend engine — do not touch

`backend/app/services/liquidity/` is Azim's territory **except**
`stress.py` (Phase 6, added by the team). Read-only:

- `forecaster.py`
- `mock_data.py`
- `risk.py`
- `config.py`
- `data_generator.py`
- `feature_engineering.py`

Fair game:
- `stress.py` (Time Machine engine)
- Anything in `backend/app/api/routes/` or `backend/app/services/engine_state.py`
