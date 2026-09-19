import { randomUUID } from "node:crypto";
import { createPostgresKnowledgeClient } from "../src/knowledge/db/client";
import {
  activateRealBiologyPilot,
  createHistoricalBiologyPilot,
  importRealBiologyCandidates,
  reconcileHistoricalBiologyPilotMemberships,
  verifyRealBiologyCleanSubset,
} from "../src/knowledge/real-pilot";
import { retrieveExactKnowledge } from "../src/knowledge/retrieval";

const TEST_PROJECT_REF = "lwbkxhimqlfuzzxilaga";

function assertTestDatabaseUrl() {
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error("DATABASE_URL is required.");
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error("DATABASE_URL is not a valid PostgreSQL URI.");
  }
  if (!/^postgres(ql)?:$/.test(parsed.protocol)) throw new Error("DATABASE_URL must use postgres:// or postgresql://.");
  if (!raw.includes(TEST_PROJECT_REF)) throw new Error("Refusing to run: DATABASE_URL is not ATE_Security_Test.");
  if (raw.includes("[YOUR-PASSWORD]")) throw new Error("Refusing to run: DATABASE_URL still contains [YOUR-PASSWORD].");
}

async function main() {
  assertTestDatabaseUrl();
  const client = createPostgresKnowledgeClient();
  const actorUserId = randomUUID();

  try {
    console.log("=== STEP 1: IMPORT / RECONCILE REAL BIOLOGY CORPUS ===");
    const imported = await importRealBiologyCandidates(client);
    console.log({
      sources: imported.corpus.sources,
      includedRecords: imported.corpus.includedRecordIds.length,
      includedRelationships: imported.corpus.includedRelationshipIds.length,
      excludedRecords: imported.corpus.excludedRecordIds.length,
      excludedRelationships: imported.corpus.excludedRelationshipIds.length,
      openReviewItems: imported.corpus.unresolvedReviewItems.length,
      datasetChecksum: imported.corpus.datasetChecksumSha256,
    });

    console.log("=== STEP 2: CREATE OR RESUME HISTORICAL PILOT PROFILE ===");
    let existing = await client.query<{
      release_id: string;
      profile_id: string;
      release_status: string;
      runtime_status: string;
    }>(`
      select r.id as release_id,
             p.id as profile_id,
             r.status as release_status,
             p.runtime_status
      from knowledge_curriculum_releases r
      join knowledge_subject_profiles p on p.release_id = r.id
      where r.release_key = 'UG-LSC-2019-REFERENCE-PILOT'
        and p.profile_key = 'UG-LSC-BIOLOGY-2019-REFERENCE'
      limit 1
    `);

    let releaseId: string;
    let profileId: string;

    if (existing.rows[0]) {
      releaseId = existing.rows[0].release_id;
      profileId = existing.rows[0].profile_id;
      console.log({ resumed: true, releaseId, profileId, releaseStatus: existing.rows[0].release_status, runtimeStatus: existing.rows[0].runtime_status });
    } else {
      const pilot = await createHistoricalBiologyPilot(client, actorUserId, imported.corpus.datasetChecksumSha256);
      releaseId = pilot.releaseId;
      profileId = pilot.profileId;
      console.log({ resumed: false, ...pilot });
    }

    const reconciledMemberships = await reconcileHistoricalBiologyPilotMemberships(client, profileId);
    console.log({ reconciledSupportingMemberships: reconciledMemberships });

    existing = await client.query(`
      select r.id as release_id,
             p.id as profile_id,
             r.status as release_status,
             p.runtime_status
      from knowledge_curriculum_releases r
      join knowledge_subject_profiles p on p.release_id = r.id
      where r.id = $1 and p.id = $2
    `, [releaseId, profileId]);

    if (existing.rows[0]?.runtime_status !== "PILOT_ACTIVE") {
      console.log("=== STEP 3: VERIFY CLEAN SUBSET ===");
      const verification = await verifyRealBiologyCleanSubset(client, profileId, actorUserId);
      console.log({ sources: verification.sources, spans: verification.spans, records: verification.records, relationships: verification.relationships });

      console.log("=== STEP 4: ACTIVATE CONTROLLED PILOT ===");
      const current = await client.query<{ release_status: string }>(`
        select status as release_status from knowledge_curriculum_releases where id=$1
      `, [releaseId]);
      if (current.rows[0]?.release_status === "ACTIVE") {
        const activation = await client.query<{ result: unknown }>(
          `select public.activate_knowledge_profile_pilot($1,$2,$3) as result`,
          [profileId, actorUserId, "Controlled historical 2019 reference pilot; academic runtime only; rights remain independently governed."],
        );
        console.log(activation.rows[0]?.result);
      } else {
        console.log(await activateRealBiologyPilot(client, profileId, actorUserId));
      }
    } else {
      console.log("=== STEP 3/4: ALREADY PILOT_ACTIVE; SKIPPING RE-VERIFICATION / RE-ACTIVATION ===");
    }

    console.log("=== STEP 5: DATABASE COUNTS ===");
    const counts = await client.query(`
      select
        (select count(*)::int from knowledge_sources) as sources,
        (select count(*)::int from knowledge_records) as records,
        (select count(*)::int from knowledge_relationships) as relationships,
        (select count(*)::int from knowledge_curriculum_releases) as releases,
        (select count(*)::int from knowledge_subject_profiles where runtime_status='PILOT_ACTIVE') as active_profiles,
        (select count(*)::int from knowledge_profile_records where runtime_status='PILOT_ACTIVE') as active_records
    `);
    console.log(counts.rows[0]);

    console.log("=== STEP 6: CONTROLLED PILOT RETRIEVAL ===");
    const sample = await retrieveExactKnowledge(client, {
      use: "CONTROLLED_PILOT",
      releaseId,
      subjectProfileId: profileId,
      effectiveOn: "2019-06-01",
      educationLevel: "lower-secondary",
      subject: "Biology",
      recordTypes: ["learning_outcome"],
      limit: 1,
    });
    console.log({
      canonicalId: sample[0]?.canonicalId,
      sourceWording: sample[0]?.sourceWording,
      sourceId: sample[0]?.provenance.sourceId,
      pageStart: sample[0]?.provenance.pageStart,
      runtimeStatus: sample[0]?.governance?.runtimeStatus,
    });

    console.log("=== STEP 6 TEST ROLLOUT COMPLETE ===");
    console.log({ releaseId, profileId, actorUserId });
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error("STEP 6 ROLLOUT FAILED");
  console.error(error);
  process.exit(1);
});
