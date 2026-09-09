export type EducationLevel = "lower-secondary" | "advanced-secondary" | "cross-level";
export type RightsStatus = "CLEARED" | "REVIEW_REQUIRED" | "RESTRICTED" | "UNKNOWN";
export type VerificationStatus = "UNVERIFIED" | "REVIEW_REQUIRED" | "VERIFIED";
export type ProductionUseStatus = "PERMITTED" | "PERMISSION_PENDING" | "BLOCKED";
export type ImportMode = "DEVELOPMENT" | "PRODUCTION_AUTHORISED";
export type RetrievalUse = "DEVELOPMENT_VIEW" | "PRODUCTION_APP" | "EXTERNAL_AI";

export type KnowledgeSource = {
  sourceId: string;
  authority: string;
  title: string;
  documentType: string;
  educationLevel: EducationLevel;
  subject: string | null;
  publicationYear: number | null;
  effectiveYear: number | null;
  sourceVersion: string | null;
  checksumSha256: string;
  rightsStatus: RightsStatus;
  productionUseStatus: ProductionUseStatus;
  externalAiAllowed: boolean;
  attributionRequired: boolean;
  processingStatus: string;
  verificationStatus: VerificationStatus;
  sourcePath: string;
};

export type KnowledgeProvenance = {
  sourceId: string;
  sourceTitle: string;
  authority: string;
  sourceVersion: string | null;
  pageStart: number;
  pageEnd: number;
  spanId: string;
  locator: string;
  extractionConfidence: "HIGH" | "MEDIUM" | "LOW";
  rightsStatus: RightsStatus;
  productionUseStatus: ProductionUseStatus;
  attributionRequired: boolean;
};

export type RetrievedKnowledgeRecord = {
  canonicalId: string;
  recordType: string;
  educationLevel: EducationLevel;
  subject: string | null;
  sourceWording: string;
  normalized: Record<string, unknown>;
  verificationStatus: VerificationStatus;
  provenance: KnowledgeProvenance;
};

export type ExactRetrievalRequest = {
  use: RetrievalUse;
  canonicalId?: string;
  legacyId?: string;
  subject?: string;
  educationLevel?: EducationLevel;
  recordTypes?: string[];
  limit?: number;
};

export type ImportReport = {
  importRunId: string;
  mode: ImportMode;
  recordsImportedByType: Record<string, number>;
  sourcesImported: number;
  spansImported: number;
  relationshipsImported: number;
  legacyIdsMapped: number;
  sourcesRejected: Array<{ sourceId: string; reason: string }>;
  recordsRejected: Array<{ id: string; reason: string }>;
};

export class KnowledgeRightsError extends Error {
  constructor(readonly code: "KNOWLEDGE_RIGHTS_DENIED" | "KNOWLEDGE_NOT_FOUND", message: string) {
    super(message);
    this.name = "KnowledgeRightsError";
  }
}
