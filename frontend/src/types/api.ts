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
}

export interface Alert {
  severity: "CRITICAL" | "WARNING" | "INFO";
  message: string;
  account_id?: string;
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
