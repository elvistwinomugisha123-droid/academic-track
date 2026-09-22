import "server-only";

type RetryOptions = {
  label?: string;
  attempts?: number;
  delayMs?: number;
};

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error ?? "unknown error");
}

function isControlFlowError(error: unknown) {
  const message = errorMessage(error);
  const digest = typeof error === "object" && error !== null && "digest" in error ? String(error.digest) : "";
  return message.includes("Dynamic server usage") || message.includes("NEXT_REDIRECT") || digest.includes("NEXT_REDIRECT");
}

export async function withTransientReadRetry<T>(operation: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const attempts = Math.max(1, options.attempts ?? 3);
  const delayMs = Math.max(0, options.delayMs ?? 200);
  let lastError: unknown;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (isControlFlowError(error) || attempt === attempts - 1) throw error;
      console.warn(`${options.label ?? "Supabase read"} retry after transient failure`, errorMessage(error));
      await new Promise((resolve) => setTimeout(resolve, delayMs * (attempt + 1)));
    }
  }

  throw lastError instanceof Error ? lastError : new Error(errorMessage(lastError));
}
