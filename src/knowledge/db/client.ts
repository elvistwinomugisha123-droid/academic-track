import "server-only";
import postgres from "postgres";

export type SqlResult<Row extends Record<string, unknown> = Record<string, unknown>> = { rows: Row[] };

export interface KnowledgeSqlClient {
  query<Row extends Record<string, unknown> = Record<string, unknown>>(statement: string, parameters?: unknown[]): Promise<SqlResult<Row>>;
  close(): Promise<void>;
}

export function createPostgresKnowledgeClient(connectionString = process.env.DATABASE_URL): KnowledgeSqlClient {
  if (!connectionString) throw new Error("DATABASE_URL is required for the PostgreSQL knowledge client.");
  const client = postgres(connectionString, { max: 1, prepare: false });
  return {
    async query<Row extends Record<string, unknown>>(statement: string, parameters: unknown[] = []) {
      const rows = await client.unsafe(statement, parameters as never[]) as unknown as Row[];
      return { rows };
    },
    async close() { await client.end({ timeout: 5 }); },
  };
}
