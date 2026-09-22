export function userFacingError(error: unknown, fallback: string) {
  const message = typeof error === "string" ? error : error && typeof error === "object" && "message" in error && typeof error.message === "string" ? error.message : error instanceof Error ? error.message : "";
  if (!message) return fallback;
  if (/permission denied|row-level security|not authorized|jwt|session/i.test(message)) return "You do not have permission to complete this action.";
  if (/fetch|network|timeout|pgrst|postgres|supabase|schema cache|relation|constraint|violates|duplicate key|rpc/i.test(message)) return `${fallback} Check your connection and try again.`;
  return message.length <= 240 ? message : fallback;
}
