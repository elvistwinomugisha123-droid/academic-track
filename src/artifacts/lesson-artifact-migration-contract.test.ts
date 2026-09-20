import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(resolve(process.cwd(), "drizzle/0015_lesson_artifacts.sql"), "utf8");

describe("lesson artifact migration rights contract", () => {
  it("uses governed source identity and retains safe source metadata without source wording fallback", () => {
    expect(migration).toContain("'sourceId', event_record.source_id");
    expect(migration).not.toContain("'sourceId', event.canonical_id");
    expect(migration).toContain("'sourcePageStart', span.page_start");
    expect(migration).toContain("'sourcePageEnd', span.page_end");
    expect(migration).toContain("else 'Current confirmed curriculum position'");
  });
});
