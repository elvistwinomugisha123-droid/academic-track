import "server-only";
import postgres from "postgres";

export type SqlResult<Row extends Record<string, unknown> = Record<string, unknown>> = { rows: Row[] };
type SqlExecutor = { unsafe(statement: string, parameters?: unknown[]): Promise<unknown> };

export interface KnowledgeSqlClient {
  query<Row extends Record<string, unknown> = Record<string, unknown>>(statement: string, parameters?: unknown[]): Promise<SqlResult<Row>>;
  transaction?<T>(work: () => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

export function createPostgresKnowledgeClient(connectionString = process.env.DATABASE_URL): KnowledgeSqlClient {
  if (!connectionString) throw new Error("DATABASE_URL is required for the PostgreSQL knowledge client.");
  const client = postgres(connectionString, { max: 1, prepare: false, ssl: "require" });
  let activeTransactionExecutor: SqlExecutor | null = null;
  return {
    async query<Row extends Record<string, unknown>>(statement: string, parameters: unknown[] = []) {
      const executor = activeTransactionExecutor ?? client;
      const rows = await executor.unsafe(statement, parameters as never[]) as unknown as Row[];
      return { rows };
    },
    async transaction<T>(work: () => Promise<T>) {
      return client.begin(async (transactionExecutor) => {
        const previousExecutor = activeTransactionExecutor;
        activeTransactionExecutor = transactionExecutor;
        try { return await work(); } finally { activeTransactionExecutor = previousExecutor; }
      }) as Promise<T>;
    },
    async close() { await client.end({ timeout: 5 }); },
  };
}
