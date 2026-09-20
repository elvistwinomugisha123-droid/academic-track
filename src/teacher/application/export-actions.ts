import "server-only";

import { assertCanonicalArtifactVersion } from "@/artifacts/types";
import { createPostgresKnowledgeClient } from "@/knowledge/db/client";
import { loadLessonReadinessData, type LessonArtifactRecord } from "./queries";
import { canExportLessonArtifact, type TrustedExportSourceDecision } from "./export-policy";

type ExportResult = { ok: true; data: Awaited<ReturnType<typeof loadLessonReadinessData>>; artifact: LessonArtifactRecord; canonical: Exclude<ReturnType<typeof assertCanonicalArtifactVersion>, { artifactType: "ASSESSMENT" }>; } | { ok: false; error: string };

export async function resolveLessonArtifactExport(lessonId: string, artifactId: string): Promise<ExportResult> {
  const data = await loadLessonReadinessData(lessonId);
  const artifact = data.artifacts.find((item) => item.id === artifactId);
  if (!artifact?.currentContent) return { ok: false, error: "Saved artifact not found." };
  const canonical = assertCanonicalArtifactVersion({ artifactId: artifact.id, versionId: artifact.currentVersionId || "current", artifactType: artifact.artifactType, status: artifact.status === "FINAL" ? "FINAL" : "DRAFT", ownerScope: data.lesson.section.id, curriculumAnchorIds: artifact.curriculumCanonicalId ? [artifact.curriculumCanonicalId] : [], curriculumProfileId: artifact.curriculumProfileId || undefined, rightsState: artifact.rightsState, provenance: artifact.provenance, payload: artifact.currentContent });
  if (canonical.artifactType === "ASSESSMENT") return { ok: false, error: "Assessment export is handled by Assessment Studio." };

  let sourceDecision: TrustedExportSourceDecision | null = null;
  if (artifact.curriculumCanonicalId || artifact.curriculumPositionEventId) {
    const knowledge = createPostgresKnowledgeClient();
    try {
      const result = await knowledge.query<TrustedExportSourceDecision & { canonical_id: string; source_wording: string | null }>(`select r.canonical_id, r.source_wording, coalesce(rd.rights_status, s.rights_status) as "rightsStatus", coalesce(rd.production_use_status, s.production_use_status) as "productionUseStatus", coalesce(rd.formal_artifact_allowed, s.formal_artifact_allowed) as "formalArtifactAllowed", coalesce(rd.export_allowed, s.export_allowed) as "exportAllowed" from teaching_section_curriculum_position_events e join knowledge_records r on r.canonical_id=e.canonical_id join knowledge_sources s on s.source_id=r.source_id left join lateral (select d.rights_status, d.production_use_status, d.formal_artifact_allowed, d.export_allowed from knowledge_rights_decisions d where d.source_id=s.source_id and d.source_checksum_sha256=s.checksum_sha256 order by d.decided_at desc, d.decision_id desc limit 1) rd on true where e.id=$1 and e.school_id=$2 and e.teaching_section_id=$3 and e.canonical_id=$4 and e.subject_profile_id=$5 limit 1`, [artifact.curriculumPositionEventId, data.access.schoolId, data.lesson.section.id, artifact.curriculumCanonicalId, artifact.curriculumProfileId]);
      const row = result.rows[0];
      if (row) sourceDecision = { rightsStatus: String(row.rightsStatus || "UNKNOWN"), productionUseStatus: String(row.productionUseStatus || "BLOCKED"), formalArtifactAllowed: Boolean(row.formalArtifactAllowed), exportAllowed: Boolean(row.exportAllowed), sourceWording: row.source_wording || null };
    } finally { await knowledge.close(); }
  }
  const decision = canExportLessonArtifact({ artifactRightsState: artifact.rightsState, governedAnchor: Boolean(artifact.curriculumCanonicalId || artifact.curriculumPositionEventId), sourceDecision, content: artifact.currentContent });
  return decision.allowed ? { ok: true, data, artifact, canonical } : { ok: false, error: decision.reason };
}
