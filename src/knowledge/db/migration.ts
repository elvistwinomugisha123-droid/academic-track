import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { KnowledgeSqlClient } from "./client";

const migrationPath = path.join(process.cwd(), "drizzle", "0000_academic_knowledge.sql");

export async function applyAcademicKnowledgeMigration(client: KnowledgeSqlClient): Promise<void> {
  const migration = await readFile(migrationPath, "utf8");
  for (const statement of migration.split(";").map((value) => value.trim()).filter(Boolean)) {
    await client.query(statement);
  }
}
