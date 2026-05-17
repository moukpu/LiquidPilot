# Project state — LiquidPilot

**Update this file at end of every session.** Next Devin reads it first.

## Snapshot

- **HEAD on main:** `205e535` (Contagion Phase 5 **backend** — 0009 shipped:
  `data/fixtures/contagion_exposures.json` (16 bilateral exposures, USD
  numeraire, USD-Correspondent central hub w/ 5 outgoing edges) +
  `backend/app/services/liquidity/contagion.py` (NEW module, NetworkX
  DiGraph, BFS cascade w/ `HOP_DECAY=0.6` `MAX_HOPS=4`, FX via
  `FX_RATES_TO_USD`, deterministic, no Monte Carlo) +
  `backend/app/api/routes/contagion.py` (REPLACE 9-line stub, `GET
  /network` no-warmup-required, `POST /simulate` requires warm-up) +
  `backend/tests/test_contagion.py` (6 tests, all green). Verified:
  ruff clean on new files, pytest 11/11 (5 pre-existing + 6 new),
  `curl /network` → 9 nodes / 16 edges, `curl /simulate` USD-Corr
  intensity=1.0 → breached_count=2 (JPY-Tokyo + SGD-Singapore),
  total_loss_usd=$47.85M, affected=9. **One deviation from spec:**
  agent anchored `_FIXTURE_PATH` via `Path(__file__).resolve().parents[4]`
  instead of literal `Path("data/fixtures/...")` because pytest cwd is
  `backend/` and the literal path resolved to a non-existent dir →
  FileNotFoundError. Accept this — `__file__` anchor is the right
  pattern for fixture paths, just not what I specced. Lesson recorded.
  Previous: `08ccf4e` (PR #10 squash — docs-only, 0009 prompt archived).
  Previous code: `059f0da` (TM round 4 — 0008 shipped).
  Previous: `b38635b` (PR #9 squash — docs-only re-hand 0008).
  Previous code: `02857e9` (TM card readability — 0007 shipped).
- **Last updated:** 17 May 2026, 10:05 UTC
- **Memory live in repo:** YES — `.devin/` merged via PR #5 into `main`.
  Owner authorised direct push for docs only; system **hard-blocks**
  `git push origin main` (tested — error: «You should never push directly
  to master or main.») so the analysis-Devin uses a tight loop:
  branch → push → POST /pulls → PUT /pulls/{n}/merge?merge_method=squash
  → branch dies in ~10s. From owner's POV — single squash commit on
  main, no PR backlog.
- **Submit deadline:** 20 May 2026 23:59 (≈ 87 h left)
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
| 5 | Contagion | **BACKEND DONE (`205e535`), FRONTEND PENDING OWNER DECISION** | Backend 0009 shipped: NetworkX DiGraph from `data/fixtures/contagion_exposures.json`, BFS cascade w/ geometric decay, `GET /contagion/network` (no warm-up needed) + `POST /contagion/simulate` (requires warm-up), 6 pytest. Cascade math validated (hub shock → 2 breached, $47.85M total loss, full BFS). Frontend (`/contagion` page is still 13-line stub) blocked on owner's 17-May 10:05 UTC question «что это вообще?» — explanation sent, awaiting "go 0010" or "skip and hide nav". |
| 6 | Time Machine | DONE round 4 (`059f0da`) | `dd61793` core (monotonicity + 5 UX bugs + 2 tests) → `c198c57` polish (no-aff badge / card stretch — methodology over-deleted here) → `02857e9` readable card (stress curve color / footer align / breach tooltip) → `059f0da` round 4 (methodology restored + advisory dropped + footer-overlap fix). No more TM rounds planned unless owner finds something. |
| 7 | Branding / landing / 90s demo | PARTIAL | logo missing, scenario not rehearsed |
| 8 | Submission | PENDING | one-pager, video, form |
| 9 | Finals | PENDING | slides, rehearsals, Q&A |

## What's in flight right now

- **0009 shipped at `205e535`** at 17-May 10:05 UTC. Owner reported
  back with full verification: ruff clean on new files, pytest 11/11
  green, `/contagion/network` returns 9 nodes / 16 edges, hub-shock
  `POST /simulate` USD-Correspondent intensity=1.0 horizon=7 returns
  breached_count=2 (JPY-Tokyo + SGD-Singapore), total_loss_usd=$47.85M,
  affected=9, EUR-Berlin correctly arrives at hop=2 via EUR-Main →
  EUR-Berlin edge. One deviation from spec (FIXTURE_PATH via
  `__file__` anchor not literal Path) — agent's call was correct,
  literal path was wrong for pytest cwd. Accepted.
- **Owner asked «что это вообще? что оно дает нам для нашего кейса?»**
  with the SynergyX hackathon brief PDF attached. Explanation sent
  10:05 UTC mapping Contagion to brief's «риск-скоринг банков и
  платежных каналов» (page 3, possible directions) and to brief's
  problem #4 «избыточные резервы как защита» (knowing the exposure
  map lets treasury reserve narrowly instead of holding $15M
  blanket buffer). Awaiting owner verdict on whether to proceed to
  prompt 0010 (Phase 5 frontend) or hide `/contagion` from nav and
  pitch as 3-of-4 modules.

## What's queued, by priority for demo

1. **Prompt 0010 — Contagion Phase 5 frontend.** **PENDING OWNER GO.**
   Plan if owner says yes: d3-force (or native SVG, react-flow if
   stable peer-deps allow — checked once, will recheck) graph on
   `/contagion`, dropdown to pick shocked account, slider for
   intensity 0..1, side-panel listing affected accounts with
   post-shock balance / breach badge / contributor chain. Calls the
   shipped `GET /network` + `POST /simulate`. Estimated 2-3 h agent
   work. Without this the backend exists only as a curl-demo.
   Alternative if owner skips: hide `/contagion` from nav, mention
   the API in PDF one-pager («risk scoring of correspondents
   available via `POST /contagion/simulate`»).
2. Phase 7 — logo (text wordmark only today), 90-second connected demo
   script, landing polish.
3. Phase 8 — one-pager PDF, 3-minute demo video, SynergyX submission form.
4. Phase 9 — slides 10–12, ≥5 live demo rehearsals, Q&A bank.

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
