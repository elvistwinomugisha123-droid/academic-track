import { describe, expect, it } from "vitest";
import type { KnowledgeSqlClient } from "./client";
import { withKnowledgeTransaction } from "./transaction";

describe("knowledge transaction boundary", () => {
  it("uses the client transaction boundary when available", async () => {
    const calls: string[] = [];
    const client: KnowledgeSqlClient = {
      async query() { calls.push("query"); return { rows: [] }; },
      async transaction<T>(work: () => Promise<T>) { calls.push("transaction:start"); const result = await work(); calls.push("transaction:commit"); return result; },
      async close() {},
    };
    await expect(withKnowledgeTransaction(client, async () => "complete")).resolves.toBe("complete");
    expect(calls).toEqual(["transaction:start", "transaction:commit"]);
  });
});
