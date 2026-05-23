export interface HealthResponse {
  status: string;
}

export interface VersionResponse {
  version: string;
}

export interface Account {
  account_id: string;
  currency: string;
  country: string;
  current_ledger_balance: number;
  current_booking_balance: number;
  in_transit: number;
  min_balance: number;
  alert_buffer: number;
  opening_balance: number;
}

export interface Transaction {
  account_id: string;
  currency: string;
  booking_date: string;
  value_date: string;
  amount: number;
  direction: "IN" | "OUT";
  payment_type: string;
  clearing_delay_days: number;
  signed_amount: number;
  clearing_delayed?: boolean;
}

export interface RailReliability {
  reliability: number;
  total: number;
  delayed: number;
  expected_delay_range: string;
}

export interface RadarInsights {
  frozen_capital_per_account: Record<string, number>;
  frozen_capital_total_usd: number;
  total_balance_usd: number;
  rail_reliability: Record<string, RailReliability>;
}

export type StressScenario =
  | "rail_delay"
  | "volume_spike"
  | "bank_holiday"
  | "fx_shock"
  | "counterparty_default"
  | "liquidity_freeze";

export interface StressRequest {
  scenario: StressScenario;
  rail?: string;
  extra_days?: number;
  multiplier?: number;
  affected_rail?: string;
  country?: string;
  holiday_days?: number;
  fx_currency?: string;
  fx_shock_pct?: number;
  counterparty_account?: string;
  frozen_account?: string;
  freeze_days?: number;
}

export interface ScenarioPoint {
  date: string;
  baseline_p50: number;
  stress_p50: number;
  delta: number;
}

export interface AccountStressResult {
  account_id: string;
  currency: string;
  horizon: ScenarioPoint[];
  baseline_min_p50: number;
  stress_min_p50: number;
  delta_min_p50: number;
  /** Sum of daily deltas across the full forecast horizon (native currency).
   *  Captures cumulative shortfall vs `delta_min_p50` which is only the
   *  worst-day gap. Rendered as the "Убыток" row in result cards. */
  integrated_delta_p50: number;
  floor: number;
  baseline_breaches: number;
  stress_breaches: number;
  /** Structured per-scenario inputs used to derive the stress numbers,
   *  rendered as the per-card "Method" accordion. Shape varies by
   *  scenario; `applied=false` branches carry a human-readable `reason`. */
  methodology_inputs: Record<string, unknown>;
}

export interface StressResult {
  scenario: StressScenario;
  params: StressRequest;
  accounts: AccountStressResult[];
  total_delta_usd: number;
  new_breach_count: number;
}

export interface Alert {
  severity: "CRITICAL" | "WARNING" | "INFO";
  account_id: string;
  currency: string;
  breach_date: string;
  projected_balance: number;
  min_balance: number;
  shortfall: number;
  days_until_breach: number;
  message: string;
}

export interface TransferSuggestion {
  from_account: string;
  to_account: string;
  amount: number;
  currency_from: string;
  currency_to: string;
  rail: string;
  initiate_by: string | null;
  rationale: string;
  requires_fx: boolean;
  notes: string[];
}

export interface Recommendations {
  alerts: Alert[];
  transfers: TransferSuggestion[];
}

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
  intensity: number;
  horizon_days: number;
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
