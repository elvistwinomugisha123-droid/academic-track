import { readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

export const ReadinessStageStatusSchema = z.enum(["PASS", "FAIL", "BLOCKED", "NOT_APPLICABLE"]);
export type ReadinessStageStatus = z.infer<typeof ReadinessStageStatusSchema>;
export type MatrixStatus = "READY" | "NOT_READY" | "BLOCKED_BY_EXTERNAL_SOURCE/ACTION";

const CatalogSchema = z.object({
  schema_version: z.literal("ate-pilot-source-catalog-v1"),
  authority: z.string().min(1),
  contract: z.string().min(1),
  entries: z.array(z.object({
    education_level: z.enum(["lower-secondary", "advanced-secondary"]),
    subject: z.string().min(1),
    sources: z.array(z.object({
      relative_path: z.string().min(1),
      document_type: z.string().min(1),
      publication_year: z.number().int().nullable(),
      purpose: z.enum(["CURRICULUM", "ASSESSMENT"]),
    })).min(1),
  })).min(1),
  shared_sources: z.array(z.object({
    education_level: z.enum(["lower-secondary", "advanced-secondary"]),
    relative_path: z.string().min(1),
    document_type: z.string().min(1),
    publication_year: z.number().int().nullable(),
    purpose: z.literal("ASSESSMENT"),
  })),
});

type Stage = { status: ReadinessStageStatus; detail: string; evidence?: string[] };
export type CurriculumReadinessRow = {
  subject: string;
  educationLevel: "lower-secondary" | "advanced-secondary";
  overallStatus: MatrixStatus;
  sourceIdentified: Stage;
  extracted: Stage;
  structurallyValidated: Stage;
  provenancePresent: Stage;
  rightsStateKnown: Stage;
  releasePublished: Stage;
  bindingValid: Stage;
  runtimeResolvable: Stage;
  lessonGenerationTest: Stage;
  teachingPackTest: Stage;
  askAteContextTest: Stage;
  assessmentProfile: Stage;
};

export type CurriculumReadinessMatrix = {
  schemaVersion: "ate-curriculum-readiness-matrix-v1";
  generatedAt: string;
  catalogueContract: string;
  sourceRegistry: { status: "AVAILABLE" | "ABSENT_BY_DESIGN"; path: string; detail: string };
  databaseEvidence: "AVAILABLE" | "NOT_AVAILABLE";
  summary: Record<MatrixStatus, number>;
  rows: CurriculumReadinessRow[];
};

export interface MatrixSqlClient {
  query<Row extends Record<string, unknown>>(statement: string, parameters?: unknown[]): Promise<{ rows: Row[] }>;
}

type DatabaseEvidence = {
  releasePublished: boolean;
  bindingValid: boolean;
  runtimeResolvable: boolean;
  lessonGenerationTest: boolean;
  teachingPackTest: boolean;
  askAteContextTest: boolean;
  assessmentProfile: boolean;
};

function pass(detail: string, evidence?: string[]): Stage { return { status: "PASS", detail, ...(evidence ? { evidence } : {}) }; }
function fail(detail: string): Stage { return { status: "FAIL", detail }; }
function blocked(detail: string): Stage { return { status: "BLOCKED", detail }; }
function notApplicable(detail: string): Stage { return { status: "NOT_APPLICABLE", detail }; }

async function exists(filePath: string): Promise<boolean> {
  try { await readFile(filePath); return true; } catch { return false; }
}

async function readJson<T>(filePath: string): Promise<T> {
  return JSON.parse(await readFile(filePath, "utf8")) as T;
}

async function inspectLegacyBiology(root: string) {
  const manifestPath = path.join(root, "curriculum-data", "01_source_manifest.json");
  const entitiesPath = path.join(root, "curriculum-data", "05_biology_entities.jsonl");
  const relationshipsPath = path.join(root, "curriculum-data", "06_curriculum_relationships.jsonl");
  const validationPath = path.join(root, "curriculum-data", "08_validation_report.md");
  const reviewPath = path.join(root, "curriculum-data", "09_human_review_queue.json");
  if (!(await Promise.all([manifestPath, entitiesPath, relationshipsPath, validationPath, reviewPath].map(exists))).every(Boolean)) return null;
  const manifest = await readJson<{ status?: string; rights_and_authority?: { permission_endorsement_or_license_inferred?: boolean }; documents?: Array<Record<string, unknown>> }>(manifestPath);
  const documents = (manifest.documents ?? []).filter((document) => document.document_type !== "task_instructions");
  const biology = documents.find((document) => document.id === "ncdc-biology-2019");
  const framework = documents.find((document) => document.id === "ncdc-framework-2019");
  const entityLines = (await readFile(entitiesPath, "utf8")).split(/\r?\n/).filter(Boolean);
  const relationshipLines = (await readFile(relationshipsPath, "utf8")).split(/\r?\n/).filter(Boolean);
  const entities = entityLines.map((line) => JSON.parse(line) as { source?: { document_id?: string; page_pdf?: number } });
  const queue = await readJson<{ items?: Array<{ status?: string }> }>(reviewPath);
  const provenanceValid = entities.length > 0 && entities.every((entity) =>
    ["ncdc-biology-2019", "ncdc-framework-2019"].includes(entity.source?.document_id ?? "")
      && Number.isInteger(entity.source?.page_pdf) && Number(entity.source?.page_pdf) > 0);
  return {
    sourceIdentified: Boolean(biology && framework),
    extracted: entities.length > 0 && relationshipLines.length > 0,
    structurallyValidated: (await readFile(validationPath, "utf8")).includes("## Checks completed") && provenanceValid,
    provenancePresent: provenanceValid,
    rightsKnown: documents.every((document) => typeof document.rights_notice === "string" && document.rights_notice.length > 0)
      && manifest.rights_and_authority?.permission_endorsement_or_license_inferred === false,
    entities: entities.length,
    relationships: relationshipLines.length,
    openReviewItems: (queue.items ?? []).filter((item) => item.status === "open").length,
  };
}

async function loadRegistry(root: string) {
  const registryPath = path.join(root, "knowledge-sources", "derived", "manifests", "source-registry.json");
  if (!(await exists(registryPath))) return { registryPath, records: null };
  const raw = await readJson<{ records?: Array<Record<string, unknown>> }>(registryPath);
  return { registryPath, records: raw.records ?? [] };
}

async function databaseEvidence(client: MatrixSqlClient, subject: string, educationLevel: string): Promise<DatabaseEvidence> {
  const result = await client.query<Record<string, unknown>>(`
    select
      exists(select 1 from knowledge_subject_profiles p join knowledge_curriculum_subjects s on s.id=p.governed_subject_id join knowledge_curriculum_releases r on r.id=p.release_id where lower(s.title)=lower($1) and p.education_level=$2 and p.status='ACTIVE' and r.status in ('ACTIVE','SUPERSEDED')) as release_published,
      exists(select 1 from teaching_section_curriculum_bindings b join knowledge_subject_profiles p on p.id=b.subject_profile_id join knowledge_curriculum_subjects s on s.id=p.governed_subject_id where lower(s.title)=lower($1) and p.education_level=$2 and b.status='ACTIVE') as binding_valid,
      exists(select 1 from knowledge_profile_records pr join knowledge_subject_profiles p on p.id=pr.subject_profile_id join knowledge_curriculum_subjects s on s.id=p.governed_subject_id where lower(s.title)=lower($1) and p.education_level=$2 and p.status='ACTIVE' and p.runtime_status='PILOT_ACTIVE' and pr.status='APPROVED' and pr.runtime_status='PILOT_ACTIVE') as runtime_resolvable,
      exists(select 1 from ai_generation_runs ar join scheduled_lessons l on l.id=ar.scheduled_lesson_id join teaching_section_curriculum_bindings b on b.teaching_section_id=l.teaching_section_id and b.school_id=l.school_id and b.status='ACTIVE' join knowledge_subject_profiles p on p.id=b.subject_profile_id join knowledge_curriculum_subjects s on s.id=p.governed_subject_id where lower(s.title)=lower($1) and p.education_level=$2 and ar.operation='GENERATE_FORMAL_LESSON_PLAN' and ar.status in ('SUCCEEDED','ACCEPTED') and ar.validation_status='PASSED') as lesson_generation_test,
      exists(select 1 from ai_generation_runs ar join scheduled_lessons l on l.id=ar.scheduled_lesson_id join teaching_section_curriculum_bindings b on b.teaching_section_id=l.teaching_section_id and b.school_id=l.school_id and b.status='ACTIVE' join knowledge_subject_profiles p on p.id=b.subject_profile_id join knowledge_curriculum_subjects s on s.id=p.governed_subject_id where lower(s.title)=lower($1) and p.education_level=$2 and ar.operation='GENERATE_TEACHING_PACK' and ar.status in ('SUCCEEDED','ACCEPTED') and ar.validation_status='PASSED') as teaching_pack_test,
      exists(select 1 from ai_generation_runs ar join scheduled_lessons l on l.id=ar.scheduled_lesson_id join teaching_section_curriculum_bindings b on b.teaching_section_id=l.teaching_section_id and b.school_id=l.school_id and b.status='ACTIVE' join knowledge_subject_profiles p on p.id=b.subject_profile_id join knowledge_curriculum_subjects s on s.id=p.governed_subject_id where lower(s.title)=lower($1) and p.education_level=$2 and ar.operation='ASK_ATE' and ar.status in ('SUCCEEDED','ACCEPTED') and ar.validation_status='PASSED') as ask_ate_context_test,
      exists(select 1 from knowledge_assessment_profiles ap join knowledge_subject_profiles p on p.id=ap.subject_profile_id join knowledge_curriculum_subjects s on s.id=p.governed_subject_id where lower(s.title)=lower($1) and p.education_level=$2 and ap.status='ACTIVE') as assessment_profile
  `, [subject, educationLevel]);
  const row = result.rows[0] ?? {};
  return {
    releasePublished: Boolean(row.release_published), bindingValid: Boolean(row.binding_valid), runtimeResolvable: Boolean(row.runtime_resolvable),
    lessonGenerationTest: Boolean(row.lesson_generation_test), teachingPackTest: Boolean(row.teaching_pack_test), askAteContextTest: Boolean(row.ask_ate_context_test), assessmentProfile: Boolean(row.assessment_profile),
  };
}

function overallStatus(stages: Stage[]): MatrixStatus {
  if (stages.every((stage) => stage.status === "PASS" || stage.status === "NOT_APPLICABLE")) return "READY";
  if (stages.some((stage) => stage.status === "BLOCKED")) return "BLOCKED_BY_EXTERNAL_SOURCE/ACTION";
  return "NOT_READY";
}

export async function buildCurriculumReadinessMatrix(input: { root?: string; database?: MatrixSqlClient; now?: Date } = {}): Promise<CurriculumReadinessMatrix> {
  const root = input.root ?? process.cwd();
  const catalog = CatalogSchema.parse(await readJson(path.join(root, "knowledge-tools", "catalog", "pilot-source-catalog.json")));
  const registry = await loadRegistry(root);
  const pilotAuthorizationPath = path.join(root, "knowledge-tools", "catalog", "pilot-operator-authorization.json");
  const pilotAuthorization = await exists(pilotAuthorizationPath)
    ? await readJson<{ state: string; decision_source: string; sources: Array<{ relative_path: string; sha256: string }> }>(pilotAuthorizationPath)
    : null;
  const legacy = await inspectLegacyBiology(root);
  const rows: CurriculumReadinessRow[] = [];

  for (const entry of catalog.entries) {
    const requiredSourcePaths = entry.sources.filter((source) => source.purpose === "CURRICULUM").map((source) => `knowledge-sources/raw/${source.relative_path}`);
    const registrySources = registry.records?.filter((record) => record.education_level === entry.education_level && String(record.subject).toLowerCase() === entry.subject.toLowerCase()) ?? [];
    const isLegacyBiology = entry.education_level === "lower-secondary" && entry.subject === "Biology" && legacy;
    const sourceIdentified = registrySources.length > 0
      ? pass(`${registrySources.length} checksum-identified private source record(s) are available.`, registrySources.map((record) => String(record.source_id)))
      : isLegacyBiology && legacy.sourceIdentified
        ? pass("The committed historical Biology syllabus and framework manifests preserve source identity and checksums.", ["curriculum-data/01_source_manifest.json"])
        : blocked(`The expected private source file(s) are not available in this checkout: ${requiredSourcePaths.join(", ")}.`);
    const extracted = registrySources.length > 0
      ? ((await exists(path.join(root, "knowledge-sources", "derived", "structured", entry.education_level, entry.subject.toLowerCase().replace(/[^a-z0-9]+/g, "-"), "subject-profile.json")))
        ? pass("Private derived subject output is present.") : fail("The source registry exists, but no derived subject profile was found."))
      : isLegacyBiology && legacy.extracted
        ? pass(`The committed adapter input contains ${legacy.entities} entities and ${legacy.relationships} relationships.`)
        : blocked("Extraction cannot run until the authoritative private source is supplied and checksum-registered.");
    const structurallyValidated = isLegacyBiology && legacy.structurallyValidated
      ? pass(`Committed structural checks pass with ${legacy.openReviewItems} explicitly open human-review items; this is not production approval.`, ["curriculum-data/08_validation_report.md", "curriculum-data/09_human_review_queue.json"])
      : registrySources.length > 0 && await exists(path.join(root, "knowledge-sources", "review", "validation", "knowledge-dataset-validation.json"))
        ? pass("A generated deterministic validation report is present.")
        : sourceIdentified.status === "BLOCKED" ? blocked("Structural validation requires source extraction.") : fail("No deterministic validation report proves this subject extraction.");
    const provenancePresent = isLegacyBiology && legacy.provenancePresent
      ? pass("Every committed flat Biology entity resolves to a documented source and physical PDF page.")
      : registrySources.length > 0 ? fail("Provenance must be proven by the generated validation report before readiness.") : blocked("Provenance cannot be established without the authoritative source/extraction.");
    const requiredPilotPaths = entry.education_level === "advanced-secondary" && ["Chemistry", "Principal Mathematics"].includes(entry.subject)
      ? [...entry.sources.map((source) => source.relative_path), ...catalog.shared_sources.filter((source) => source.education_level === "advanced-secondary" && source.document_type === "assessment-framework").map((source) => source.relative_path)]
      : entry.sources.map((source) => source.relative_path);
    const explicitPilotAuthorization = pilotAuthorization?.state === "OPERATOR_AUTHORIZED_FOR_PILOT" && Boolean(pilotAuthorization.decision_source)
      && requiredPilotPaths.every((relativePath) => {
        const source = registry.records?.find((record) => record.local_path === `knowledge-sources/raw/${relativePath}`);
        const decision = pilotAuthorization.sources.find((item) => item.relative_path === relativePath);
        return source?.rights_status === "OPERATOR_AUTHORIZED_FOR_PILOT" && source.authorization_reference === pilotAuthorization.decision_source
          && source.checksum_sha256 === decision?.sha256 && source.production_use_status === "PERMITTED";
      });
    const rightsStateKnown = isLegacyBiology && legacy.rightsKnown
      ? blocked("Rights are known to be uncleared: the source reserves reproduction rights and permission/endorsement/licence was not inferred.")
      : explicitPilotAuthorization
        ? pass("All required sources have checksum-matched, explicit operator authorization for this controlled pilot; this does not establish wider rights.")
      : registrySources.length > 0 && registrySources.every((record) => record.rights_status === "CLEARED" && record.production_use_status === "PERMITTED")
        ? pass("Every registered source declares cleared production use; database decisions still require separate validation.")
        : blocked("No matching eligible rights or controlled-pilot operator authorization is recorded for every required source.");

    let db: DatabaseEvidence | null = null;
    if (input.database) {
      try { db = await databaseEvidence(input.database, entry.subject, entry.education_level); } catch { db = null; }
    }
    const dbStage = (value: boolean | undefined, success: string, failure: string): Stage => db === null
      ? blocked("Database evidence is unavailable; no pilot runtime state is inferred from repository files.")
      : value ? pass(success) : fail(failure);
    const assessmentApplicable = entry.sources.some((source) => source.purpose === "ASSESSMENT") || entry.education_level === "lower-secondary";
    const rowWithoutStatus = {
      subject: entry.subject,
      educationLevel: entry.education_level,
      sourceIdentified, extracted, structurallyValidated, provenancePresent, rightsStateKnown,
      releasePublished: dbStage(db?.releasePublished, "An active governed release/profile exists.", "No active governed release/profile exists."),
      bindingValid: dbStage(db?.bindingValid, "At least one active Teaching Section binding resolves.", "No active Teaching Section binding resolves."),
      runtimeResolvable: dbStage(db?.runtimeResolvable, "Approved PILOT_ACTIVE runtime records resolve.", "No approved PILOT_ACTIVE runtime records resolve."),
      lessonGenerationTest: dbStage(db?.lessonGenerationTest, "A validated successful lesson-generation run exists.", "No validated successful lesson-generation run exists."),
      teachingPackTest: dbStage(db?.teachingPackTest, "A validated successful Teaching Pack run exists.", "No validated successful Teaching Pack run exists."),
      askAteContextTest: dbStage(db?.askAteContextTest, "A validated successful Ask ATE run exists.", "No validated successful Ask ATE run exists."),
      assessmentProfile: assessmentApplicable ? dbStage(db?.assessmentProfile, "An active assessment profile exists.", "No active applicable assessment profile exists.") : notApplicable("The source catalogue does not identify a subject assessment profile requirement."),
    };
    const stages = Object.values(rowWithoutStatus).filter((value): value is Stage => typeof value === "object" && value !== null && "status" in value);
    rows.push({ ...rowWithoutStatus, overallStatus: overallStatus(stages) });
  }

  const summary = { READY: 0, NOT_READY: 0, "BLOCKED_BY_EXTERNAL_SOURCE/ACTION": 0 } satisfies Record<MatrixStatus, number>;
  rows.forEach((row) => { summary[row.overallStatus] += 1; });
  return {
    schemaVersion: "ate-curriculum-readiness-matrix-v1", generatedAt: (input.now ?? new Date()).toISOString(), catalogueContract: catalog.contract,
    sourceRegistry: registry.records ? { status: "AVAILABLE", path: path.relative(root, registry.registryPath), detail: "Generated from local private sources; not committed." } : { status: "ABSENT_BY_DESIGN", path: path.relative(root, registry.registryPath), detail: "The registry is a generated, gitignored derivative of protected raw sources and must not be fabricated or restored without those sources." },
    databaseEvidence: input.database ? "AVAILABLE" : "NOT_AVAILABLE", summary, rows,
  };
}

export function renderCurriculumReadinessMarkdown(matrix: CurriculumReadinessMatrix): string {
  const cell = (stage: Stage) => `${stage.status}${stage.status === "PASS" ? "" : ` — ${stage.detail}`}`.replace(/\|/g, "\\|");
  const lines = [
    "# Curriculum readiness matrix", "",
    `**Generated:** ${matrix.generatedAt}`, "",
    `**Overall:** READY ${matrix.summary.READY}; NOT_READY ${matrix.summary.NOT_READY}; BLOCKED_BY_EXTERNAL_SOURCE/ACTION ${matrix.summary["BLOCKED_BY_EXTERNAL_SOURCE/ACTION"]}.`, "",
    "## Authority and reproducibility", "",
    `The private source registry is **${matrix.sourceRegistry.status}** at \`${matrix.sourceRegistry.path}\`. ${matrix.sourceRegistry.detail}`,
    "", `Catalogue contract: ${matrix.catalogueContract}`, "",
    "A PASS is evidence for that stage only. It does not elevate review-required extraction, infer rights, publish a release, or advertise a subject as pilot-ready. READY requires every applicable stage to pass.", "",
    "## Matrix", "",
    "| Level | Subject | Overall | Source | Extracted | Validated | Provenance | Rights | Release | Binding | Runtime | Lesson AI | Pack AI | Ask ATE | Assessment |",
    "|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|",
    ...matrix.rows.map((row) => `| ${row.educationLevel} | ${row.subject} | **${row.overallStatus}** | ${cell(row.sourceIdentified)} | ${cell(row.extracted)} | ${cell(row.structurallyValidated)} | ${cell(row.provenancePresent)} | ${cell(row.rightsStateKnown)} | ${cell(row.releasePublished)} | ${cell(row.bindingValid)} | ${cell(row.runtimeResolvable)} | ${cell(row.lessonGenerationTest)} | ${cell(row.teachingPackTest)} | ${cell(row.askAteContextTest)} | ${cell(row.assessmentProfile)} |`),
    "", "## Current blockers", "",
    "- The full private raw corpus and its derived registry are absent from this checkout by design.",
    "- The committed Lower Secondary Biology workbench has reproducible extraction/provenance evidence, but 26 human-review items remain open and rights are not cleared.",
    "- Database-backed release, binding, runtime and workflow evidence requires the intended pilot database; no local files are treated as proof of those states.",
    "- No subject is READY until the complete chain is evidenced for that exact subject and level.", "",
  ];
  return lines.join("\n");
}
