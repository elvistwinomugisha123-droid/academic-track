export type StreamPosition = { canonicalId: string | null; profileId?: string | null };

export type StreamDrift = "ALIGNED" | "ONE_POSITION_APART" | "TWO_OR_MORE_POSITIONS_APART" | "UNKNOWN";

export function classifyStreamDrift(left: StreamPosition, right: StreamPosition, governedOrder: string[] | null): StreamDrift {
  if (!left.canonicalId || !right.canonicalId) return "UNKNOWN";
  if (left.profileId !== undefined && right.profileId !== undefined && left.profileId !== right.profileId) return "UNKNOWN";
  if (left.canonicalId === right.canonicalId) return "ALIGNED";
  if (!governedOrder) return "UNKNOWN";
  const leftIndex = governedOrder.indexOf(left.canonicalId);
  const rightIndex = governedOrder.indexOf(right.canonicalId);
  if (leftIndex < 0 || rightIndex < 0) return "UNKNOWN";
  const distance = Math.abs(leftIndex - rightIndex);
  if (distance === 1) return "ONE_POSITION_APART";
  return "TWO_OR_MORE_POSITIONS_APART";
}
