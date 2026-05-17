# Glossary — LiquidPilot

## Accounts

9 accounts. Each has `account_id`, `currency`, `country`, `min_balance`.
Full config in `backend/app/services/liquidity/config.py:default_system_config`.

Common IDs you'll see in code / UI:

| account_id          | ccy | country | role                   |
|---------------------|-----|---------|------------------------|
| EUR-Main            | EUR | DE      | main operating, EU     |
| USD-Correspondent   | USD | US      | correspondent / nostro |
| GBP-Local           | GBP | GB      | UK operations          |
| JPY-Tokyo           | JPY | JP      | APAC ops, low rate     |
| SGD-Singapore       | SGD | SG      | APAC ops, mid          |
| KZT-Almaty          | KZT | KZ      | local, high outflow    |
| CHF-Zurich          | CHF | CH      | private banking        |

There are two more accounts; their exact IDs change occasionally — read
`config.py` if you need the canonical list.

## FX rates (to USD)

Source: `frontend/src/lib/fx.ts` (synthetic, frozen for demo).

| ccy | rate to USD |
|-----|-------------|
| EUR | 1.08        |
| USD | 1.00        |
| GBP | 1.27        |
| CHF | 1.12        |
| SGD | 0.74        |
| JPY | 0.0067      |
| KZT | 0.0022      |

JPY and KZT are the ones that break naive `.toFixed(2)` displays. Use
`formatFxQuote(from, to)` (added in `a09cb0d`) — it inverts when rate
< 0.01 so the user sees "1 USD = 454.55 KZT" instead of "1 KZT = 0.00 USD".

## Domain terms

- **Radar** — `/radar` page, 3D globe ATC view of money flows.
- **Autopilot** — `/autopilot` page, action queue for alerts and
  rebalancing transfers.
- **Time Machine** — `/timemachine` page, scenario stress testing.
- **Contagion** — `/contagion` page, bank epidemic risk graph (stub).
- **Floor** = `min_balance` — minimum balance covenant per account.
- **Breach** = day where forecast (P50) falls below floor.
- **Catch-up drop** — Time Machine bank_holiday term: the day after the
  holiday when all deferred outflows hit at once.
- **Rail** — payment network: `SWIFT`, `SEPA`, `ACH`, `CARD`, `INTERNAL`.
- **In-flight** — transaction submitted but not yet settled.
- **P50** — median of the probabilistic forecast.

## File map

```
backend/
  app/
    api/routes/        - FastAPI endpoints (free to edit)
    services/
      engine_state.py  - cache + warm_up (editable)
      liquidity/
        stress.py      - Time Machine engine (editable)
        config.py      - DO NOT EDIT (Azim)
        forecaster.py  - DO NOT EDIT (Azim)
        mock_data.py   - DO NOT EDIT (Azim)
        risk.py        - DO NOT EDIT (Azim)
        data_generator.py - DO NOT EDIT (Azim)
        feature_engineering.py - DO NOT EDIT (Azim)
frontend/
  src/
    app/(dashboard)/
      radar/page.tsx
      autopilot/page.tsx
      timemachine/page.tsx
      contagion/page.tsx     - currently a stub
    components/
      radar/                 - globe-3d, world-map, etc.
      autopilot/             - action-card, etc.
      timemachine/           - result-card, scenario-picker
    lib/
      fx.ts                  - FX rates + formatFxQuote
      autopilot-synth.ts     - syntheticAlerts + syntheticTransfers
      api.ts                 - HTTP client wrappers
    i18n/messages/
      en.ts
      ru.ts
docs/
  HANDOFF.md
  architecture.md
.devin/                       - YOUR MEMORY
  START.md
  state.md
  style.md
  constraints.md
  prompt-craft.md
  glossary.md
  prompts/
    INDEX.md
    NNNN-slug.md
```
