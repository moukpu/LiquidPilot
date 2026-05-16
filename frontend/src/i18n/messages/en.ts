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
  "radar.legend.small": "< 1M",
  "radar.legend.medium": "< 10M",
  "radar.legend.large": "≥ 10M",
  "radar.legend.hoverHint": "Hover any plane for details",
  "radar.tooltip.direction": "Direction",
  "radar.tooltip.amount": "Amount",
  "radar.tooltip.paymentType": "Payment type",
  "radar.tooltip.valueDate": "Value date",
  "radar.tooltip.delay": "Clearing delay",
  "radar.tooltip.from": "From",
  "radar.tooltip.to": "To",
  "radar.direction.IN": "IN",
  "radar.direction.OUT": "OUT",
  "radar.city.frankfurt": "Frankfurt",
  "radar.city.newYork": "New York",
  "radar.city.london": "London",

  "account.ledgerBalance": "Ledger balance",
  "account.percentOfOpening": "{percent}% of opening",
  "account.aboveFloor": "{amount} above floor",
  "account.belowFloor": "{amount} below floor",
  "account.bufferBreach": "Buffer breach",
  "account.in": "In",
  "account.out": "Out",
  "account.txCount": "Transactions: {n}",
  "account.inTransit": "In-transit: {amount}",

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
