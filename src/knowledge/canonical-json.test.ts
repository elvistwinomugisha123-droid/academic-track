import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { canonicalJson, sha256Canonical } from "./canonical-json";

describe("canonical JSON identity hashing", () => {
  it("is independent of object insertion order while preserving array order", () => {
    const first = { normalized: { title: "Topic", subject: "physics", nested: { b: 2, a: 1 } }, values: ["one", "two"] };
    const second = { values: ["one", "two"], normalized: { nested: { a: 1, b: 2 }, subject: "physics", title: "Topic" } };
    expect(canonicalJson(first)).toBe(canonicalJson(second));
    expect(sha256Canonical(first)).toBe(sha256Canonical(second));
    expect(sha256Canonical({ ...first, values: ["two", "one"] })).not.toBe(sha256Canonical(first));
  });

  it("registers the additive migration after the applied foundation", async () => {
    const journal = JSON.parse(await readFile(path.join(process.cwd(), "drizzle", "meta", "_journal.json"), "utf8")) as { entries: Array<{ idx: number; tag: string }> };
    const governanceIndex = journal.entries.findIndex(({ tag }) => tag === "0008_academic_knowledge_governance");
    expect(journal.entries[governanceIndex - 1]).toMatchObject({ idx: 7, tag: "0007_classroom_rpc_privileges" });
    expect(journal.entries[governanceIndex]).toMatchObject({ idx: 8, tag: "0008_academic_knowledge_governance" });
  });
});
