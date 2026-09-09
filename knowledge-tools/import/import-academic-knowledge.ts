import { createPostgresKnowledgeClient } from "@/knowledge/db/client";
import { applyAcademicKnowledgeMigration } from "@/knowledge/db/migration";
import { importAcademicKnowledge } from "@/knowledge/importer";
import type { ImportMode } from "@/knowledge/types";

const mode = process.argv.includes("--production-authorised") ? "PRODUCTION_AUTHORISED" : "DEVELOPMENT" satisfies ImportMode;

async function main() {
  const client = createPostgresKnowledgeClient();
  try {
    await applyAcademicKnowledgeMigration(client);
    console.log(JSON.stringify(await importAcademicKnowledge(client, mode), null, 2));
  } finally { await client.close(); }
}

void main();
