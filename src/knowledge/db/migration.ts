import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { KnowledgeSqlClient } from "./client";

const migrationPaths = [
  path.join(process.cwd(), "drizzle", "0000_academic_knowledge.sql"),
  path.join(process.cwd(), "drizzle", "0008_academic_knowledge_governance.sql"),
  path.join(process.cwd(), "drizzle", "0040_operator_pilot_source_authorization.sql"),
  path.join(process.cwd(), "drizzle", "0041_curriculum_release_unknown_effective_date.sql"),
  path.join(process.cwd(), "drizzle", "0042_pilot_curriculum_operator_verification.sql"),
];

function splitSqlStatements(sql: string): string[] {
  const statements: string[] = [];
  let start = 0;
  let quote: "single" | "double" | "lineComment" | "blockComment" | "dollar" | null = null;
  let dollarTag = "";
  for (let index = 0; index < sql.length; index += 1) {
    const current = sql[index];
    const next = sql[index + 1];
    if (quote === "lineComment") { if (current === "\n") quote = null; continue; }
    if (quote === "blockComment") { if (current === "*" && next === "/") { quote = null; index += 1; } continue; }
    if (quote === "single") { if (current === "'" && next === "'") { index += 1; } else if (current === "'") quote = null; continue; }
    if (quote === "double") { if (current === '"' && next === '"') { index += 1; } else if (current === '"') quote = null; continue; }
    if (quote === "dollar") { if (sql.startsWith(dollarTag, index)) { index += dollarTag.length - 1; quote = null; } continue; }
    if (current === "-" && next === "-") { quote = "lineComment"; index += 1; continue; }
    if (current === "/" && next === "*") { quote = "blockComment"; index += 1; continue; }
    if (current === "'") { quote = "single"; continue; }
    if (current === '"') { quote = "double"; continue; }
    if (current === "$" && /\$[A-Za-z_][A-Za-z0-9_]*\$|\$\$/.test(sql.slice(index))) {
      const match = sql.slice(index).match(/^\$[A-Za-z_][A-Za-z0-9_]*\$|^\$\$/);
      if (match) { dollarTag = match[0]; quote = "dollar"; index += dollarTag.length - 1; continue; }
    }
    if (current === ";") { const statement = sql.slice(start, index).trim(); if (statement) statements.push(statement); start = index + 1; }
  }
  const finalStatement = sql.slice(start).trim();
  if (finalStatement) statements.push(finalStatement);
  return statements;
}

export async function applyAcademicKnowledgeMigration(client: KnowledgeSqlClient): Promise<void> {
  for (const migrationPath of migrationPaths) {
    const migration = await readFile(migrationPath, "utf8");
    for (const statement of splitSqlStatements(migration)) {
      await client.query(statement);
    }
  }
}
