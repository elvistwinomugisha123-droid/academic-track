import type { KnowledgeSqlClient } from "./client";

export async function withKnowledgeTransaction<T>(client: KnowledgeSqlClient, work: () => Promise<T>): Promise<T> {
  await client.query("BEGIN");
  try {
    const result = await work();
    await client.query("COMMIT");
    return result;
  } catch (error) {
    try { await client.query("ROLLBACK"); } catch { /* preserve the original error */ }
    throw error;
  }
}
