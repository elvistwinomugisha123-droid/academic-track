import "server-only";
import { sourcePermitsUse } from "./rights";
import type { KnowledgeSqlClient } from "./db/client";
import type { ExactRetrievalRequest, KnowledgeRightsError, RetrievedKnowledgeRecord } from "./types";
import { KnowledgeRightsError as RightsError } from "./types";

type RetrievalRow = {
  canonical_id: string; record_type: string; education_level: RetrievedKnowledgeRecord["educationLevel"]; subject: string | null;
  source_wording: string; normalized: Record<string, unknown>; verification_status: RetrievedKnowledgeRecord["verificationStatus"];
  source_id: string; title: string; authority: string; source_version: string | null; page_start: number; page_end: number; span_id: string; locator: string;
  extraction_confidence: RetrievedKnowledgeRecord["provenance"]["extractionConfidence"]; rights_status: RetrievedKnowledgeRecord["provenance"]["rightsStatus"];
  production_use_status: RetrievedKnowledgeRecord["provenance"]["productionUseStatus"]; attribution_required: boolean; external_ai_allowed: boolean;
};

export async function retrieveExactKnowledge(client: KnowledgeSqlClient, request: ExactRetrievalRequest): Promise<RetrievedKnowledgeRecord[]> {
  if (!request.canonicalId && !request.legacyId && (!request.subject || !request.educationLevel)) {
    throw new Error("Exact retrieval requires a canonical/legacy ID or both subject and educationLevel.");
  }
  const parameters: unknown[] = []; const identityClauses: string[] = []; const filterClauses: string[] = [];
  const bind = (value: unknown) => { parameters.push(value); return `$${parameters.length}`; };
  if (request.canonicalId) identityClauses.push(`r.canonical_id = ${bind(request.canonicalId)}`);
  if (request.legacyId) identityClauses.push(`r.canonical_id = (SELECT canonical_id FROM knowledge_legacy_id_mappings WHERE legacy_id = ${bind(request.legacyId)})`);
  if (request.subject) filterClauses.push(`r.subject = ${bind(request.subject)}`);
  if (request.educationLevel) filterClauses.push(`r.education_level = ${bind(request.educationLevel)}`);
  if (request.recordTypes?.length) filterClauses.push(`r.record_type IN (${request.recordTypes.map((type) => bind(type)).join(",")})`);
  const where = [...(identityClauses.length ? [`(${identityClauses.join(" OR ")})`] : []), ...filterClauses].join(" AND ");
  const result = await client.query<RetrievalRow>(`SELECT r.canonical_id, r.record_type, r.education_level, r.subject, r.source_wording, r.normalized, r.verification_status, s.source_id, s.title, s.authority, s.source_version, sp.page_start, sp.page_end, sp.span_id, sp.locator, sp.extraction_confidence, s.rights_status, s.production_use_status, s.attribution_required, s.external_ai_allowed
    FROM knowledge_records r JOIN knowledge_sources s ON s.source_id = r.source_id JOIN knowledge_source_spans sp ON sp.span_id = r.span_id
    WHERE ${where} ORDER BY r.canonical_id LIMIT ${bind(Math.min(Math.max(request.limit ?? 20, 1), 100))}`, parameters);
  if (!result.rows.length) throw new RightsError("KNOWLEDGE_NOT_FOUND", "No exact curriculum knowledge matched the request.");
  const permitted = result.rows.filter((row) => sourcePermitsUse({ rightsStatus: row.rights_status, productionUseStatus: row.production_use_status, externalAiAllowed: row.external_ai_allowed }, request.use));
  if (!permitted.length) throw new RightsError("KNOWLEDGE_RIGHTS_DENIED", "The matched curriculum source is not authorised for the requested use.");
  return permitted.map((row) => ({
    canonicalId: row.canonical_id, recordType: row.record_type, educationLevel: row.education_level, subject: row.subject,
    sourceWording: row.source_wording, normalized: row.normalized, verificationStatus: row.verification_status,
    provenance: { sourceId: row.source_id, sourceTitle: row.title, authority: row.authority, sourceVersion: row.source_version, pageStart: row.page_start, pageEnd: row.page_end, spanId: row.span_id, locator: row.locator, extractionConfidence: row.extraction_confidence, rightsStatus: row.rights_status, productionUseStatus: row.production_use_status, attributionRequired: row.attribution_required },
  }));
}
