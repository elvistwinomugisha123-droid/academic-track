export const continuityStates = ["CLEAR", "PARTIAL_CARRY_FORWARD", "NOT_DELIVERED_CARRY_FORWARD", "CHANGED_REVIEW", "UNCONFIRMED", "SCHEDULED"] as const;
export type ContinuityState = (typeof continuityStates)[number];

export function continuityStateFor(outcome: string | null, ended: boolean): ContinuityState {
  if (outcome === "PARTIALLY_DELIVERED") return "PARTIAL_CARRY_FORWARD";
  if (outcome === "NOT_DELIVERED") return "NOT_DELIVERED_CARRY_FORWARD";
  if (outcome === "CHANGED") return "CHANGED_REVIEW";
  if (outcome === "DELIVERED") return "CLEAR";
  return ended ? "UNCONFIRMED" : "SCHEDULED";
}

export function requiresReason(outcome: string): boolean {
  return outcome === "NOT_DELIVERED" || outcome === "CHANGED";
}
