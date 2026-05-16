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

export type StressScenario = "rail_delay" | "volume_spike" | "bank_holiday";

export interface StressRequest {
  scenario: StressScenario;
  rail?: string;
  extra_days?: number;
  multiplier?: number;
  affected_rail?: string;
  country?: string;
  holiday_days?: number;
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
  floor: number;
  baseline_breaches: number;
  stress_breaches: number;
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
