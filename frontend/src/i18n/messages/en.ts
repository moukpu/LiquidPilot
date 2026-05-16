const en = {
  "app.title": "LiquidPilot — Predictive Liquidity Cockpit",
  "app.description":
    "Air Traffic Control for your treasury. Radar, Autopilot, Contagion Risk, and Time Machine.",

  "topbar.dashboard": "Dashboard",
  "nav.radar": "Radar",
  "nav.autopilot": "Autopilot",
  "nav.contagion": "Contagion",
  "nav.timemachine": "Time Machine",

  "switcher.aria": "Language",

  "status.lastSync": "Last sync",
  "status.online": "online",
  "status.offline": "offline",

  "severity.CRITICAL": "CRITICAL",
  "severity.WARNING": "WARNING",
  "severity.INFO": "INFO",

  "radar.eyebrow": "Radar · Air Traffic Control",
  "radar.title": "Live money in the air",
  "radar.subtitle":
    "Real-time view of in-flight payments across your accounts.",
  "radar.flowSize": "Flow size",
  "radar.legend.small": "< $100k",
  "radar.legend.medium": "< $1M",
  "radar.legend.large": "≥ $1M",
  "radar.legend.hoverHint": "Click any plane for details",
  "radar.tooltip.direction": "Direction",
  "radar.tooltip.amount": "Amount",
  "radar.tooltip.paymentType": "Payment type",
  "radar.tooltip.valueDate": "Value date",
  "radar.tooltip.delay": "Clearing delay",
  "radar.tooltip.from": "From",
  "radar.tooltip.to": "To",
  "radar.tooltip.close": "Close",
  "radar.frozen.title": "Frozen liquidity",
  "radar.frozen.ofTotal": "of total balance",
  "radar.frozen.allDeployed": "All capital deployed — no idle balances right now.",
  "radar.reliability.title": "Rail reliability",
  "radar.direction.IN": "IN",
  "radar.direction.OUT": "OUT",
  "radar.city.frankfurt": "Frankfurt",
  "radar.city.newYork": "New York",
  "radar.city.london": "London",
  "radar.city.berlin": "Berlin",
  "radar.city.losAngeles": "Los Angeles",
  "radar.city.zurich": "Zurich",
  "radar.city.tokyo": "Tokyo",
  "radar.city.singapore": "Singapore",
  "radar.city.almaty": "Almaty",

  "account.ledgerBalance": "Ledger balance",
  "account.bufferBreach": "Buffer breach",
  "account.vsFloor": "vs floor",
  "account.in": "Inflow today",
  "account.out": "Outflow today",
  "account.txCount": "Transactions: {n}",
  "account.inTransit.count": "In flight · {n} tx",

  "alerts.title": "Alerts & Recommendations",
  "alerts.allClear": "All clear",
  "alerts.noAlerts": "No alerts or suggested transfers.",

  "autopilot.eyebrow": "Autopilot · Command Center",
  "autopilot.title": "Action queue & risk telemetry",
  "autopilot.counter.queued": "Queued: {n}",
  "autopilot.counter.confirm": "Confirm: {n}",
  "autopilot.counter.exec": "Executing: {n}",
  "autopilot.counter.done": "Done: {n}",
  "autopilot.counter.skip": "Skipped: {n}",
  "autopilot.demoMode": "Demo Mode",
  "autopilot.demoTooltip":
    "Synthesizes alerts and transfers from current account data for presentation purposes — no real backend trigger.",

  "autopilot.alerts.section": "Active alerts",
  "autopilot.alerts.count": "Alerts: {n}",
  "autopilot.alerts.none": "No active alerts",
  "autopilot.alerts.noneDetail":
    "Forecasted balances are above floor across all accounts.",
  "autopilot.alerts.inDays": "in {n}d",
  "autopilot.alerts.shortfall": "Shortfall",
  "autopilot.alerts.projected": "Projected",
  "autopilot.alerts.floor": "Floor",

  "autopilot.queue.section": "Transfer queue",
  "autopilot.queue.summary":
    "Active: {active} · Done: {done} · Skipped: {skipped}",
  "autopilot.queue.empty":
    "No suggested transfers from the engine right now.",
  "autopilot.queue.allResolved": "All actions resolved.",
  "autopilot.queue.recentlyExecuted": "Recently executed · {n}",
  "autopilot.queue.skippedSection": "Skipped · {n}",
  "autopilot.queue.infoSection": "Open alerts · {n}",
  "autopilot.summary.label": "Accounts",
  "autopilot.header.statusLine": "{pending} pending · {resolved} resolved",
  "autopilot.session.accepted": "Accepted",
  "autopilot.session.moved": "Moved",
  "autopilot.session.remaining": "Open alerts",
  "autopilot.alerts.dismiss": "Dismiss",
  "alert.message.critical":
    "In the worst case, {account} will fall to {projected} on {date} — below the required minimum {min}. Estimated shortfall: {shortfall}.",
  "alert.message.warning":
    "In the next {days} days, the typical projection for {account} enters the safety buffer.",

  "action.execute": "Execute",
  "action.skip": "Skip",
  "action.confirmPrompt": "Confirm transfer?",
  "action.move": "Move {amount} from {from} to {to} via {rail}{initiateBy}.",
  "action.initiateBy": ", initiate by {date}",
  "action.confirmExecution": "Confirm execution",
  "action.cancel": "Cancel",
  "action.autoRevert": "auto-revert {n}s",
  "action.executingOn": "Executing on {rail}…",
  "action.settledOn": "Settled on {rail}",
  "action.skipped": "Skipped",
  "action.restore": "Restore",
  "action.fxBadge": "FX",
  "action.initiateAsap": "ASAP",
  "action.initiatePrefix": "by {date}",

  "empty.standingBy": "Autopilot standing by",
  "empty.detail":
    "No actions required. All accounts are above their floors and no breach is forecast within the planning horizon. Toggle {demo} in the header to walk through a fabricated scenario.",

  "stub.contagion.title": "Contagion",
  "stub.contagion.body": "Network contagion graph — coming in Phase 5.",
  "stub.timemachine.title": "Time Machine",
  "stub.timemachine.body": "Historical scenario replay — coming in Phase 6.",

  "timemachine.title": "Time Machine — stress test",
  "timemachine.subtitle":
    "Pick a scenario, tune the parameters, run the simulation. We show baseline vs stressed P50 forecast per account.",
  "timemachine.scenario": "Scenario",
  "timemachine.scenarios.railDelay": "Rail clearing delay shock",
  "timemachine.scenarios.volumeSpike": "Outflow volume spike",
  "timemachine.scenarios.bankHoliday": "Bank holiday",
  "timemachine.rail": "Rail",
  "timemachine.extraDays": "Extra clearing days",
  "timemachine.multiplier": "Outflow multiplier",
  "timemachine.country": "Country",
  "timemachine.holidayDays": "Holiday days",
  "timemachine.runButton": "Run simulation",
  "timemachine.running": "Running...",
  "timemachine.totalImpact": "Total impact (USD)",
  "timemachine.newBreaches": "New breaches",
  "timemachine.breach": "Breach",
  "timemachine.baselineMin": "Baseline min",
  "timemachine.stressMin": "Stress min",
  "timemachine.delta": "Delta",
  "timemachine.methodologyLabel": "Method",
  "timemachine.method.notApplied": "Not applied",
  "timemachine.method.sample": "Sample",
  "timemachine.method.days": "days",
  "timemachine.method.avgInflow": "Avg {rail} IN",
  "timemachine.method.avgOutflow": "Avg {rail} OUT",
  "timemachine.method.daysAffected": "Days affected",
  "timemachine.method.shiftPerDay": "Daily shift",
  "timemachine.method.multiplier": "Multiplier",
  "timemachine.method.extraPerDay": "Extra OUT/day",
  "timemachine.method.country": "Holiday",
  "timemachine.method.flatValue": "Day-0 baseline",
  "timemachine.method.accumulatedDrift": "Drift over holiday",
  "timemachine.method.catchUp": "Catch-up drop",
  "timemachine.hint.pickScenario":
    "Pick a scenario and run the simulation. Cards on the right will show projected impact per account.",
  "timemachine.hint.railDelay":
    "Rail Delay — slip a payment rail's clearing window by N business days. Example: SWIFT correspondent stalls 3 days, see who runs short.",
  "timemachine.hint.volumeSpike":
    "Volume Spike — multiply outflow on a specific rail. Example: card chargebacks 2× normal volume for the next 7 days.",
  "timemachine.hint.bankHoliday":
    "Bank Holiday — freeze all outbound clearing for accounts in a country for N days, then catch-up drop on day N+1.",

  "backend.alert.template":
    "{accountId}: forecast {projected} {currency} by {breachDate}, below floor of {floor} (shortfall {shortfall}).",
  "backend.transfer.fund":
    "Fund {to} ({severity} on {breachDate}) from {from} via {rail}.",
  "backend.transfer.note.fx":
    "Requires FX conversion {fromCcy} → {toCcy}; size in donor currency before quoting the spot deal.",
  "backend.transfer.note.escalate":
    "No surplus account can fund this gap without breaching its own buffer — escalate to external funding (credit line / repo / FX swap).",
} as const;

export type MessageKey = keyof typeof en;
export default en;
