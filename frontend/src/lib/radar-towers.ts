// Shared list of tower account-ids known to both globe-3d and world-map.
// Page-level code uses this to compute real per-tower / total in-flight
// transaction counts without re-importing the entire globe component.
export const TOWER_IDS = [
  "EUR-Main",
  "USD-Correspondent",
  "GBP-Local",
  "EUR-Berlin",
  "USD-LA",
  "CHF-Zurich",
  "JPY-Tokyo",
  "SGD-Singapore",
  "KZT-Almaty",
] as const;

export type TowerId = (typeof TOWER_IDS)[number];

export function isTowerId(id: string): id is TowerId {
  return (TOWER_IDS as readonly string[]).includes(id);
}
