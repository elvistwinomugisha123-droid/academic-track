/** Publish only the two checksum-bound Mathematics/Chemistry syllabus releases.
 * Run in the connected ATE_Pilot environment after applying migrations.
 * No assessment candidate is granted active runtime membership here.
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { createPostgresKnowledgeClient, type KnowledgeSqlClient } from "../src/knowledge/db/client";
import { sha256Canonical } from "../src/knowledge/canonical-json";
import { importAcademicKnowledge } from "../src/knowledge/importer";
import { activateKnowledgeReleaseForControlledPilot, submitKnowledgeReleaseForReview } from "../src/knowledge/governance";

const PROJECT_REF = "pdvvspuokkordgppjwxg";
type Profile = { profileId: string; subject: string; educationLevel: string; sourceId: string; recordIds: string[]; orderedRecordIds: string[]; canonicalRecordIds: string[]; orderedCanonicalRecordIds: string[]; relationshipIds: string[]; profileChecksumSha256: string };
type Manifest = { releaseId: string; releaseKey: "A" | "B"; title: string; educationLevel: string; effectiveFrom: null; assessmentReadiness: string; assessmentRuntimeRecordIds: string[]; operatorVerificationDecisionId: string; operatorVerificationDecisionSha256: string; datasetChecksumSha256: string; sourceMemberships: { sourceId: string; sha256: string; rightsState: string; role: string }[]; profiles: Profile[]; manifestChecksumSha256: string };
type Decision = { decisionId: string; state: string; scope: string; datasetChecksumSha256: string; parserVersions: string[]; sourceChecksums: Record<string, string> };

function assert(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(message); }
async function loadJson<T>(name: string): Promise<T> { return JSON.parse(await readFile(name, "utf8")) as T; }
async function loadJsonl<T>(name: string): Promise<T[]> { return (await readFile(name, "utf8")).split("\n").filter(Boolean).map((line) => JSON.parse(line) as T); }

async function loadArtifacts(): Promise<{ decision: Decision; manifests: Manifest[] }> {
  execFileSync("python3", ["knowledge-tools/pilot_curriculum_release.py"], { cwd: process.cwd(), stdio: "pipe" });
  const decision = await loadJson<Decision>("knowledge-tools/catalog/pilot-curriculum-verification.json");
  const manifests = await Promise.all(["a", "b"].map((key) => loadJson<Manifest>(`knowledge-sources/derived/releases/release-${key}.json`)));
  const syllabusItems = await loadJsonl<{ id: string; provenance: { sourceId: string } }>("knowledge-sources/derived/structured/curriculum-items.jsonl");
  const syllabusRelationships = await loadJsonl<{ id: string; provenance: { sourceId: string } }>("knowledge-sources/derived/structured/curriculum-relationships.jsonl");
  const inDecision = (item: { provenance: { sourceId: string } }) => Object.hasOwn(decision.sourceChecksums, item.provenance.sourceId);
  const curriculumDatasetChecksum = sha256Canonical({
    records: syllabusItems.filter(inDecision).sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
    relationships: syllabusRelationships.filter(inDecision).sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  });
  const registry = await loadJson<{ records: { source_id: string; local_path: string; checksum_sha256: string; document_type: string }[] }>("knowledge-sources/derived/manifests/source-registry.json");
  assert(decision.state === "OPERATOR_VERIFIED_FOR_PILOT" && decision.scope === "CONTROLLED_PILOT_CURRICULUM_ONLY", "Explicit curriculum operator decision missing.");
  assert(decision.datasetChecksumSha256 === curriculumDatasetChecksum, "Curriculum dataset checksum differs from operator decision.");
  assert(registry.records.length === 7, "Pilot registry must contain exactly the seven supplied sources.");
  for (const source of registry.records) {
    const actual = createHash("sha256").update(await readFile(path.resolve(source.local_path))).digest("hex");
    assert(actual === source.checksum_sha256, `Physical PDF checksum differs: ${source.source_id}`);
  }
  for (const manifest of manifests) {
    const { manifestChecksumSha256, ...body } = manifest;
    assert(sha256Canonical(body) === manifestChecksumSha256, `Release ${manifest.releaseKey} manifest checksum differs.`);
    assert(manifest.datasetChecksumSha256 === decision.datasetChecksumSha256, "Release dataset checksum differs.");
    assert(manifest.operatorVerificationDecisionSha256 === sha256Canonical(decision), "Release operator decision checksum differs.");
    assert(manifest.assessmentReadiness === "ASSESSMENT_RUNTIME_NOT_READY" && manifest.assessmentRuntimeRecordIds.length === 0, "Unverified assessment rules cannot enter this publication.");
    assert(manifest.profiles.length === 2 && manifest.profiles.every((profile) => profile.recordIds.length > 0 && profile.canonicalRecordIds.length === profile.recordIds.length), "A curriculum profile is missing.");
    for (const membership of manifest.sourceMemberships) {
      assert(membership.role === "SUBJECT_SYLLABUS" && membership.rightsState === "OPERATOR_AUTHORIZED_FOR_PILOT" && decision.sourceChecksums[membership.sourceId] === membership.sha256, "Release source is unapproved.");
    }
  }
  return { decision, manifests };
}

async function publishDraft(client: KnowledgeSqlClient, manifest: Manifest, decision: Decision, actor: string): Promise<void> {
  await client.transaction!(async () => {
    const releaseKey = manifest.releaseKey === "A" ? "UG-LSC-MATH-CHEM-2019-OPERATOR-PILOT" : "UG-ASC-CHEM-PMATH-2025-OPERATOR-PILOT";
    const previous = await client.query<{ manifest_checksum_sha256: string }>("SELECT manifest_checksum_sha256 FROM knowledge_curriculum_releases WHERE id=$1", [manifest.releaseId]);
    assert(!previous.rows[0] || previous.rows[0].manifest_checksum_sha256 === manifest.manifestChecksumSha256, "Release ID already exists with different content.");
    await client.query("INSERT INTO knowledge_curriculum_releases(id,release_key,authority,display_name,education_level,version_label,effective_from,effective_to,status,manifest_checksum_sha256,created_by) VALUES($1,$2,'National Curriculum Development Centre (NCDC)',$3,$4,$5,NULL,NULL,'DRAFT',$6,$7) ON CONFLICT (id) DO NOTHING", [manifest.releaseId, releaseKey, manifest.title, manifest.educationLevel, manifest.releaseKey === "A" ? "2019" : "2025", manifest.manifestChecksumSha256, actor]);
    for (const [index, profile] of manifest.profiles.entries()) {
      const subjectKey = `UG-${profile.educationLevel === "lower-secondary" ? "LSC" : "ASC"}-${profile.subject.toUpperCase().replace(/\s+/g, "-")}`;
      const subject = await client.query<{ id: string; title: string; education_level: string }>("SELECT id,title,education_level FROM knowledge_curriculum_subjects WHERE subject_key=$1", [subjectKey]);
      let subjectId = subject.rows[0]?.id;
      if (subject.rows[0]) assert(subject.rows[0].title === profile.subject && subject.rows[0].education_level === profile.educationLevel, "Governed subject identity differs.");
      else {
        const created = await client.query<{ id: string }>("INSERT INTO knowledge_curriculum_subjects(subject_key,title,education_level,status) VALUES($1,$2,$3,'DRAFT') RETURNING id", [subjectKey, profile.subject, profile.educationLevel]);
        subjectId = created.rows[0].id;
      }
      await client.query("INSERT INTO knowledge_subject_profiles(id,release_id,governed_subject_id,profile_key,display_title,education_level,status,runtime_status,display_order,requires_assessment_profile,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,'DRAFT','CANDIDATE',$7,false,now(),now()) ON CONFLICT (id) DO NOTHING", [profile.profileId, manifest.releaseId, subjectId, profile.sourceId, profile.subject, profile.educationLevel, index + 1]);
      const membership = manifest.sourceMemberships.find((source) => source.sourceId === profile.sourceId);
      assert(membership, `Missing source membership for ${profile.subject}`);
      await client.query("INSERT INTO knowledge_release_sources(release_id,subject_profile_id,source_id,source_role,is_required,precedence_order,status,approved_at,approved_by) VALUES($1,$2,$3,'SUBJECT_SYLLABUS',true,1,'APPROVED',now(),$4) ON CONFLICT DO NOTHING", [manifest.releaseId, profile.profileId, profile.sourceId, actor]);
      const identities = await client.query<{ candidate_id: string; canonical_id: string; candidate_content_sha256: string }>("SELECT candidate_id,canonical_id,candidate_content_sha256 FROM knowledge_record_identity_mappings WHERE source_id=$1 AND source_checksum_sha256=$2 AND candidate_id=ANY($3::text[])", [profile.sourceId, membership.sha256, profile.recordIds]);
      const byCandidate = new Map(identities.rows.map((row) => [row.candidate_id, row]));
      assert(byCandidate.size === profile.recordIds.length, `Imported record mappings incomplete for ${profile.subject}`);
      const order = new Map(profile.orderedRecordIds.map((id, position) => [id, position]));
      for (const candidateId of profile.recordIds) {
        const identity = byCandidate.get(candidateId)!;
        assert(profile.canonicalRecordIds.includes(identity.canonical_id), `Canonical record ID differs from checksum-bound manifest: ${candidateId}`);
        await client.query("INSERT INTO knowledge_profile_records(release_id,subject_profile_id,canonical_id,membership_role,ordering_key,status,runtime_status,approved_at,approved_by) VALUES($1,$2,$3,'CURRICULUM',$4,'APPROVED','CANDIDATE',now(),$5) ON CONFLICT (subject_profile_id,canonical_id) DO NOTHING", [manifest.releaseId, profile.profileId, identity.canonical_id, String(order.get(candidateId) ?? -1).padStart(6, "0"), actor]);
      }
    }
    const sources = Object.fromEntries(manifest.sourceMemberships.map((item) => [item.sourceId, item.sha256]));
    await client.query("INSERT INTO knowledge_pilot_curriculum_decisions(decision_id,release_id,manifest_checksum_sha256,dataset_checksum_sha256,source_checksums,parser_versions,decision_payload,decision_payload_sha256,actor_user_id) VALUES($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7::jsonb,$8,$9) ON CONFLICT (decision_id) DO NOTHING", [manifest.operatorVerificationDecisionId, manifest.releaseId, manifest.manifestChecksumSha256, manifest.datasetChecksumSha256, JSON.stringify(sources), JSON.stringify(decision.parserVersions), JSON.stringify(decision), sha256Canonical(decision), actor]);
    for (const profile of manifest.profiles) {
      const source = manifest.sourceMemberships.find((item) => item.sourceId === profile.sourceId)!;
      const identities = await client.query<{ candidate_id: string; canonical_id: string; candidate_content_sha256: string }>("SELECT candidate_id,canonical_id,candidate_content_sha256 FROM knowledge_record_identity_mappings WHERE source_id=$1 AND source_checksum_sha256=$2 AND candidate_id=ANY($3::text[])", [profile.sourceId, source.sha256, profile.recordIds]);
      for (const identity of identities.rows) {
        await client.query("INSERT INTO knowledge_pilot_curriculum_record_memberships(decision_id,release_id,subject_profile_id,canonical_id,source_id,source_checksum_sha256,candidate_id,candidate_content_sha256) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT DO NOTHING", [manifest.operatorVerificationDecisionId, manifest.releaseId, profile.profileId, identity.canonical_id, profile.sourceId, source.sha256, identity.candidate_id, identity.candidate_content_sha256]);
      }
      const relationships = await client.query<{ relationship_id: string; source_id: string }>("SELECT relationship_id,source_id FROM knowledge_relationships WHERE relationship_id=ANY($1::text[])", [profile.relationshipIds]);
      assert(relationships.rows.length === profile.relationshipIds.length && relationships.rows.every((item) => item.source_id === profile.sourceId), `Imported relationships incomplete for ${profile.subject}`);
      for (const relationship of relationships.rows) {
        await client.query("INSERT INTO knowledge_pilot_curriculum_relationship_memberships(decision_id,release_id,subject_profile_id,relationship_id,source_id,source_checksum_sha256) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING", [manifest.operatorVerificationDecisionId, manifest.releaseId, profile.profileId, relationship.relationship_id, profile.sourceId, source.sha256]);
      }
    }
  });
}

async function main(): Promise<void> {
  const { decision, manifests } = await loadArtifacts();
  for (const manifest of manifests) console.log(`${manifest.releaseKey}: ${manifest.releaseId} ${manifest.manifestChecksumSha256}`);
  if (!process.argv.includes("--apply")) { console.log("Validated artifacts only. Pass --apply in the connected ATE_Pilot environment."); return; }
  assert(process.env.SUPABASE_PROJECT_REF === PROJECT_REF, "Supabase project ref must be the dedicated ATE_Pilot project.");
  const databaseUrl = process.env.DATABASE_URL;
  const actor = process.env.ATE_OPERATOR_USER_ID;
  assert(databaseUrl && actor && /^[0-9a-f-]{36}$/i.test(actor), "Connected DATABASE_URL and existing operator Auth user ID are required.");
  const parsed = new URL(databaseUrl);
  assert(`${parsed.hostname} ${decodeURIComponent(parsed.username)}`.includes(PROJECT_REF), "Database connection does not identify the ATE_Pilot project ref.");
  const client = createPostgresKnowledgeClient(databaseUrl);
  try {
    await importAcademicKnowledge(client, "DEVELOPMENT");
    const registry = await loadJson<{ records: { source_id: string; checksum_sha256: string }[] }>("knowledge-sources/derived/manifests/source-registry.json");
    for (const source of registry.records) {
      const current = await client.query<{ rights_status: string }>("SELECT rights_status FROM knowledge_sources WHERE source_id=$1", [source.source_id]);
      if (current.rows[0]?.rights_status !== "OPERATOR_AUTHORIZED_FOR_PILOT") await client.query("SELECT public.record_knowledge_pilot_operator_authorization($1,$2,$3,$4,$5)", [source.source_id, source.checksum_sha256, "Founder/operator supplied seven PDFs for controlled pilot", actor, decision.decisionId]);
    }
    for (const manifest of manifests) {
      await publishDraft(client, manifest, decision, actor);
      const release = await client.query<{ status: string }>("SELECT status FROM knowledge_curriculum_releases WHERE id=$1", [manifest.releaseId]);
      if (release.rows[0]?.status === "DRAFT") await submitKnowledgeReleaseForReview(client, manifest.releaseId);
      if (release.rows[0]?.status !== "ACTIVE") {
        const activation = await activateKnowledgeReleaseForControlledPilot(client, manifest.releaseId, actor);
        assert(activation.activated, `Release ${manifest.releaseKey} activation blocked: ${JSON.stringify(activation.issues)}`);
      }
      for (const profile of manifest.profiles) {
        const status = await client.query<{ runtime_status: string }>("SELECT runtime_status FROM knowledge_subject_profiles WHERE id=$1", [profile.profileId]);
        if (status.rows[0]?.runtime_status !== "PILOT_ACTIVE") await client.query("SELECT public.activate_knowledge_profile_pilot($1,$2,$3)", [profile.profileId, actor, "Checksum-bound founder/operator syllabus verification for controlled pilot"]);
      }
    }
    for (const manifest of manifests) {
      const result = await client.query<{ id: string; status: string; manifest_checksum_sha256: string }>("SELECT id,status,manifest_checksum_sha256 FROM knowledge_curriculum_releases WHERE id=$1", [manifest.releaseId]);
      assert(result.rows.length === 1 && result.rows[0].status === "ACTIVE" && result.rows[0].manifest_checksum_sha256 === manifest.manifestChecksumSha256, `Published release ${manifest.releaseKey} failed readback.`);
      for (const profile of manifest.profiles) {
        const count = await client.query<{ count: string }>("SELECT count(*)::text AS count FROM knowledge_profile_records WHERE subject_profile_id=$1 AND release_id=$2 AND status='APPROVED'", [profile.profileId, manifest.releaseId]);
        assert(Number(count.rows[0]?.count) === profile.recordIds.length, `Published profile count mismatch: ${profile.subject}`);
      }
      console.log(`PUBLISHED ${manifest.releaseKey}: ${result.rows[0].id} ${result.rows[0].manifest_checksum_sha256}`);
    }
  } finally { await client.close(); }
}

void main().catch((error) => { console.error(error); process.exitCode = 1; });
