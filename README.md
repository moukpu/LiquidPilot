# LiquidPilot

> **SynergyX Hackathon 2026 — FinTech track**

```
    __    _       _       _       _
   / /   (_)     | |     (_)     | |  _
  / /____ _ _ __ | | ___  _ _ __ | |_| |_ ___
 / /______| | '_ \| |/ _ \| | '_ \| __| __/ _ \
/ /       | | | | | | (_) | | | | | |_| || (_) |
\/        |_|_| |_|_|\___/|_|_| |_|\__|\__\___/
```

LiquidPilot is a **predictive liquidity cockpit** for fintech treasury teams. Think air-traffic control, but for money: real-time radar of your cash flows, an autopilot that rebalances accounts, contagion-risk scoring for your banking partners, and a time machine that lets you replay historical financial crises to stress-test your positions.

## Features

- **Radar** — Air-traffic-control view of all money flows across accounts, banks, and currencies in real time.
- **Autopilot** — Automated cash rebalancing that keeps liquidity optimal without manual spreadsheet wrangling.
- **Contagion** — Bank contagion risk scoring powered by network graph analytics and exposure mapping.
- **Time Machine** — Replay historical financial crises (2008, 2020, 2023) and stress-test your treasury against real events.

## Quick Start

### Docker Compose (recommended)

```bash
docker compose up --build
```

- Frontend: http://localhost:3000
- Backend: http://localhost:8000

### Manual

**Backend:**
```bash
cd backend
uv sync
uv run uvicorn app.main:app --reload
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

## Tech Stack

| Layer     | Technology                                          |
|-----------|-----------------------------------------------------|
| Frontend  | Next.js 14 (App Router), TypeScript, Tailwind CSS   |
| Backend   | FastAPI, Python 3.11, Pydantic v2, SQLAlchemy 2.0   |
| Data      | SQLite + aiosqlite, synthetic generators, fixtures  |
| Graphs    | NetworkX (contagion network analysis)               |
| DevOps    | Docker Compose, uv (Python), npm (Node)             |

## Architecture

See [docs/architecture.md](docs/architecture.md) for the full system diagram.

## Repo Structure

```
LiquidPilot/
├── backend/          FastAPI backend
│   ├── app/          API routes, models, schemas, services
│   └── tests/        Pytest suite
├── frontend/         Next.js frontend
│   ├── src/app/      Pages and layouts
│   ├── src/components/ UI, layout, brand
│   └── tests/        Test placeholders
├── data/             Synthetic generators + historical fixtures
├── docs/             Architecture docs
├── docker-compose.yml
└── README.md
```

## Team

| Role | Name | GitHub |
|------|------|--------|
| TBD  | TBD  | TBD    |
| TBD  | TBD  | TBD    |

## License

MIT — see [LICENSE](LICENSE).

---

Built for **SynergyX Hackathon 2026 — FinTech track**. Deadline: May 20, 2026.
