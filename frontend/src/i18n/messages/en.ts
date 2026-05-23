const en = {
  "app.title": "LiquidPilot — Predictive Liquidity Cockpit",
  "app.description":
    "Air Traffic Control for your treasury. Radar, Autopilot, Contagion Risk, and Time Machine.",

  "home.badge.live": "Live demo",
  "home.title.line1": "Predictive Liquidity",
  "home.title.line2": "Cockpit",
  "home.subtitle":
    "The ultimate treasury command center. Real-time radar, autonomous rebalancing, contagion risk analysis, and historical stress-testing.",
  "home.cta.enter": "Enter Cockpit",
  "home.cta.source": "View Source",
  "home.feature.radar.title": "Radar",
  "home.feature.radar.desc":
    "Real-time air-traffic-control view of all money flows across accounts and banks.",
  "home.feature.autopilot.title": "Autopilot",
  "home.feature.autopilot.desc":
    "Automated cash rebalancing that keeps liquidity optimal without manual intervention.",
  "home.feature.contagion.title": "Contagion",
  "home.feature.contagion.desc":
    "Bank contagion risk scoring using network graph analytics and exposure maps.",
  "home.feature.timemachine.title": "Time Machine",
  "home.feature.timemachine.desc":
    "Replay historical financial crises and stress-test your treasury against past events.",

  "profile.menu.demo": "Demo account",
  "profile.menu.settings": "Settings",
  "profile.menu.signOut": "Sign out",
  "profile.demoBadge": "Demo",

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
  "autopilot.demoMode": "Demo Mode",
  "autopilot.demoTooltip":
    "Synthesizes alerts and transfers from current account data for presentation purposes — no real backend trigger.",
  "autopilot.autoMode": "AI Pilot",
  "autopilot.autoTooltip":
    "Autonomous mode: the AI executes transfers without waiting for your approval. Every action is logged below — toggle off to take back control.",
  "autopilot.log.title": "AI decision log",
  "autopilot.log.empty":
    "Toggle AI Pilot on to let the engine execute transfers automatically. Each move appears here in real time.",
  "autopilot.log.executed":
    "Moved {amount} from {from} to {to} via {rail} — covers projected shortfall on {date}.",
  "autopilot.log.skipped":
    "Held back transfer {amount} {from} → {to}: rail {rail} reliability below safety threshold.",
  "autopilot.log.noAction":
    "Scanned {n} accounts — all balances above floor, no transfers needed.",
  "autopilot.log.shown": "Showing last {n} actions",
  "autopilot.log.clear": "Clear",

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
  "timemachine.scenarios.volumeSpike": "Outflow spike (chargebacks / payouts)",
  "timemachine.scenarios.bankHoliday": "Bank holiday",
  "timemachine.scenarios.fxShock": "FX shock (cross-rate move)",
  "timemachine.scenarios.counterpartyDefault": "Counterparty default",
  "timemachine.scenarios.liquidityFreeze": "Account liquidity freeze",
  "timemachine.fxCurrency": "Currency",
  "timemachine.fxShockPct": "Shock magnitude (%)",
  "timemachine.counterparty": "Counterparty account",
  "timemachine.frozenAccount": "Frozen account",
  "timemachine.freezeDays": "Freeze days",
  "timemachine.hint.fxShock":
    "FX Shock — a sudden devaluation of the selected currency cuts every account booked in it by the chosen magnitude. Example: EUR loses 5% vs USD on an ECB announcement.",
  "timemachine.hint.counterpartyDefault":
    "Counterparty Default — a specific counterparty stops honouring obligations. Inbound exposures to that account vanish over the horizon.",
  "timemachine.hint.liquidityFreeze":
    "Liquidity Freeze — a single account is fully frozen (sanctions, fraud hold). All inbound/outbound stops, balance held flat then dragged by ongoing obligations.",
  "timemachine.method.fxShockPct": "Shock %",
  "timemachine.method.fxAffectedAccounts": "Accounts in currency",
  "timemachine.method.frozenAccount": "Frozen account",
  "timemachine.method.freezeDays": "Freeze days",
  "timemachine.method.exposureUsd": "Exposure (USD)",
  "timemachine.reason.currencyMismatch": "account currency does not match shock currency",
  "timemachine.reason.notFrozenAccount": "not the frozen account",
  "timemachine.reason.zeroShock": "shock magnitude is 0 — no effect",
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
  "timemachine.breachTooltip":
    "Breach = stress prognosis dropped below the account's minimum reserve. " +
    "Under the baseline forecast the account never goes below floor.",
  "timemachine.legend.baseline": "Baseline",
  "timemachine.legend.stress": "Under stress",
  "timemachine.legend.breach": "Floor breach",
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
  "timemachine.method.dailyNetOutflow": "Daily net outflow",
  "timemachine.method.deferred": "Deferred outflow",
  "timemachine.method.fxFactor": "Factor",
  "timemachine.method.fxMagnitude": "Magnitude",
  "timemachine.method.counterparty": "Counterparty",
  "timemachine.method.dailyOutflow": "Daily outflow",
  "timemachine.method.dailyInflow": "Daily inflow",
  "timemachine.method.exposureFrac": "Exposure frac",
  "timemachine.method.lossPerDay": "Loss/day",
  "timemachine.method.selfDefault": "Self-default",
  "timemachine.method.queuedDrag": "Queued drag",
  "timemachine.method.amplification": "Amplification",
  "timemachine.hint.pickScenario":
    "Pick a scenario and run the simulation. Cards on the right will show projected impact per account.",
  "timemachine.hint.railDelay":
    "Rail Delay — slip a payment rail's clearing window by N business days. Example: SWIFT correspondent stalls 3 days, see who runs short.",
  "timemachine.hint.volumeSpike":
    "Volume Spike — multiply outflow on a specific rail. Example: card chargebacks 2× normal volume for the next 7 days.",
  "timemachine.hint.bankHoliday":
    "Bank Holiday — freeze all outbound clearing for accounts in a country for N days, then catch-up drop on day N+1.",
  "timemachine.reason.noInboundOnRail": "no inbound transactions on this rail for this account",
  "timemachine.reason.noOutboundOnRail": "no outbound transactions on this rail for this account",
  "timemachine.reason.countryMismatch": "account country does not match holiday country",
  "timemachine.reason.zeroMultiplier": "multiplier ≤ 1 — no spike",
  "timemachine.reason.unknown": "scenario not applicable",
  "timemachine.reason.noCounterpartySelected": "no counterparty selected",
  "timemachine.reason.noFrozenSelected": "no frozen account selected",
  "timemachine.reason.zeroFreezeDays": "freeze days = 0 — no effect",
  "timemachine.reason.zeroHolidayDays": "holiday days = 0 — no effect",
  "timemachine.reason.noInbound": "no inbound transactions on this account",
  "timemachine.reason.noOutbound": "no historical OUT flow — flat trajectory",
  "timemachine.reason.noFilterMatch": "no outbound transactions match this filter",
  "timemachine.reason.emptyHorizon": "empty forecast horizon",
  "timemachine.empty.title": "No accounts affected",
  "timemachine.empty.railNotUsed":
    "No account in the fleet routes inbound traffic over {rail}. Pick a different rail to see impact.",
  "timemachine.empty.noOutbound":
    "No outbound transactions match the selected filter. Try a wider scope or different rail.",
  "timemachine.empty.noCountryAccount":
    "No account is booked in {country}. Pick a country where the fleet has presence.",
  "timemachine.empty.hint":
    "The simulation ran successfully but produced no impact for any account under these parameters.",
  "timemachine.skippedAccounts": "{n} accounts skipped (scenario not applicable)",
  "autopilot.queue.infoSectionHint": "Forecasted breaches the engine cannot auto-resolve — no donor account has surplus. Manual treasurer action: arrange credit line / FX swap / repo.",
  "radar.legend.totalInFlight": "{n} in flight",

  "backend.alert.template":
    "{accountId}: forecast {projected} {currency} by {breachDate}, below floor of {floor} (shortfall {shortfall}).",
  "backend.transfer.fund":
    "Fund {to} ({severity} on {breachDate}) from {from} via {rail}.",

  "contagion.title": "Contagion — network cascade simulator",
  "contagion.subtitle":
    "Drop a counterparty, watch the shock propagate through your bilateral exposures. Bank epidemiology view of liquidity risk.",
  "contagion.hero.summary": "{loss} · {affected} affected · {breached} breached",

  "contagion.shock.title": "Shock controls",
  "contagion.shock.account": "Drop counterparty",
  "contagion.shock.intensity": "Intensity",
  "contagion.shock.horizon": "Horizon (days)",
  "contagion.shock.run": "Run cascade",
  "contagion.shock.running": "Running...",
  "contagion.shock.reset": "Reset",

  "contagion.result.title": "Cascade result",
  "contagion.result.empty":
    "Pick a counterparty on the left and run the simulation. The affected accounts will appear here with breach status and hop distance.",
  "contagion.result.breachedCount": "Breached",
  "contagion.result.totalLoss": "Total loss (USD)",
  "contagion.result.affectedCount": "Affected accounts",
  "contagion.result.hopBadge": "hop {n}",
  "contagion.result.hopGroup": "Hop {n} (×{count})",
  "contagion.result.postBalance": "Post-shock",
  "contagion.result.minBalance": "Floor",
  "contagion.result.loss": "Loss",
  "contagion.result.via": "via",

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
  "contagion.tip.clickNode":
    "Tip: click any node on the graph to drop that counterparty.",
  "contagion.edge.detail.title": "Exposure detail",
  "contagion.edge.detail.from": "From",
  "contagion.edge.detail.to": "To",
  "contagion.edge.detail.amount": "Bilateral exposure",
  "contagion.edge.detail.kind": "Type",
  "contagion.edge.detail.why":
    "If the source counterparty halts payments, this exposure converts into a same-day liquidity loss for the recipient.",
  "contagion.edge.detail.close": "Close",
  "contagion.node.detail.title": "Account detail",
  "contagion.node.detail.balance": "Current balance",
  "contagion.node.detail.floor": "Floor",
  "contagion.node.detail.outDeg": "Outbound exposures",
  "contagion.node.detail.inDeg": "Inbound exposures",
  "contagion.page.subtitle": "Cascade Simulator",
  "contagion.metric.affected": "Affected",
  "contagion.metric.breached": "Breached",
  "contagion.result.impactAnalysis": "Impact Analysis",
  "contagion.result.emptyState": "Run a cascade simulation to see the downstream impact.",
  "contagion.result.floorLabel": "Floor:",
  "contagion.result.postLabel": "Post:",
  "contagion.result.hopShort": "H{n}",
  "contagion.loading": "Loading network...",
  "contagion.loadingTopology": "Loading network topology...",
} as const;

export type MessageKey = keyof typeof en;
export default en;
