import { writeFile } from "node:fs/promises";
import path from "node:path";
import postgres from "postgres";
import { buildCurriculumReadinessMatrix, renderCurriculumReadinessMarkdown, type MatrixSqlClient } from "../src/pilot-readiness/curriculum-matrix";

async function main() {
  let close: (() => Promise<void>) | undefined;
  let database: MatrixSqlClient | undefined;
  if (process.env.DATABASE_URL) {
    const sql = postgres(process.env.DATABASE_URL, { max: 1, connect_timeout: 8, idle_timeout: 2, ssl: "require" });
    database = { async query<Row extends Record<string, unknown>>(statement: string, parameters: unknown[] = []) { return { rows: await sql.unsafe<Row[]>(statement, parameters as never[]) }; } };
    close = () => sql.end({ timeout: 2 });
  }
  try {
    const matrix = await buildCurriculumReadinessMatrix({ database });
    const jsonPath = path.join(process.cwd(), "docs", "pilot", "CURRICULUM_READINESS_MATRIX.json");
    const markdownPath = path.join(process.cwd(), "docs", "pilot", "CURRICULUM_READINESS_MATRIX.md");
    await Promise.all([
      writeFile(jsonPath, `${JSON.stringify(matrix, null, 2)}\n`, "utf8"),
      writeFile(markdownPath, renderCurriculumReadinessMarkdown(matrix), "utf8"),
    ]);
    console.log(`Curriculum readiness: READY=${matrix.summary.READY} NOT_READY=${matrix.summary.NOT_READY} BLOCKED=${matrix.summary["BLOCKED_BY_EXTERNAL_SOURCE/ACTION"]}`);
    console.log(`Wrote ${path.relative(process.cwd(), jsonPath)} and ${path.relative(process.cwd(), markdownPath)}.`);
  } finally { await close?.(); }
}

main().catch((error) => { console.error(`Curriculum readiness generation failed: ${error instanceof Error ? error.message : "unknown error"}`); process.exitCode = 1; });
