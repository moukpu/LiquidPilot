# LiquidPilot Architecture

## Overview

LiquidPilot is a predictive liquidity cockpit for fintech treasury operations. It visualizes money flows like an air-traffic-control radar, runs an autopilot for cash rebalancing, scores bank contagion risk, and replays historical financial crises.

## System Diagram

```mermaid
graph TB
    subgraph Frontend["Frontend (Next.js 14 + Tailwind)"]
        UI[Dashboard UI]
        Radar[Radar View]
        Auto[Autopilot View]
        Cont[Contagion View]
        TM[Time Machine View]
    end

    subgraph Backend["Backend (FastAPI + Python 3.11)"]
        API[REST API]
        Health[/health]
        Accounts[/accounts]
        Txns[/transactions]
        Recs[/recommendations]
        Contagion[/contagion]
        TM_API[/timemachine]
    end

    subgraph Data["Data Layer"]
        DB[(SQLite + SQLAlchemy)]
        Gen[Synthetic Data Generators]
        Fix[Historical Fixtures]
    end

    UI -->|HTTP| API
    Radar -->|HTTP| API
    Auto -->|HTTP| API
    Cont -->|HTTP| API
    TM -->|HTTP| API

    API --> DB
    API --> Gen
    API --> Fix
```

## Components

- **Frontend**: Next.js 14 App Router, TypeScript, Tailwind CSS v3.4, shadcn/ui
- **Backend**: FastAPI, Pydantic v2, SQLAlchemy 2.0, Uvicorn
- **Data**: Synthetic generators + historical fixtures for stress testing
- **Infra**: Docker Compose for local development
