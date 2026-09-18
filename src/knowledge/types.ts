export type EducationLevel = "lower-secondary" | "advanced-secondary" | "cross-level";
export type RightsStatus = "CLEARED" | "REVIEW_REQUIRED" | "RESTRICTED" | "UNKNOWN";
export type VerificationStatus = "UNVERIFIED" | "REVIEW_REQUIRED" | "VERIFIED";
export type ProductionUseStatus = "PERMITTED" | "PERMISSION_PENDING" | "BLOCKED";
export type ImportMode = "DEVELOPMENT" | "PRODUCTION_AUTHORISED";
export type RetrievalUse = "DEVELOPMENT_VIEW" | "PRODUCTION_APP" | "FORMAL_ARTIFACT" | "EXTERNAL_AI";
export type KnowledgeEntityType = "SOURCE" | "SPAN" | "RECORD" | "RELATIONSHIP";
export type KnowledgeReleaseStatus = "DRAFT" | "REVIEW" | "ACTIVE" | "SUPERSEDED" | "RETIRED";

export const governedRecordTypes = [
  "subject_profile", "programme_planner", "level_unit", "term_unit", "theme", "topic", "subtopic", "curriculum_framework",
  "competency", "learning_outcome", "learning_experience", "activity", "skill", "generic_skill", "value", "cross_cutting_issue",
  "resource", "ict_support", "practical_requirement", "time_allocation", "assessment_profile", "assessment_framework",
  "assessment_objective", "assessment_guidance", "assessment_strategy", "construct", "ability", "indicator", "assessment_rule",
  "paper_structure", "scoring_rule", "rubric_rule", "performance_descriptor", "source_note", "source_definition", "review_note",
] as const;
export type GovernedRecordType = typeof governedRecordTypes[number];

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
  formalArtifactAllowed: boolean;
  exportAllowed: boolean;
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
  sourceContentSha256?: string | null;
  recordContentSha256?: string | null;
  rightsStatus: RightsStatus;
  productionUseStatus: ProductionUseStatus;
  attributionRequired: boolean;
  formalArtifactAllowed: boolean;
  exportAllowed: boolean;
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
  governance?: {
    releaseId: string;
    releaseKey: string;
    subjectProfileId: string;
    subjectProfileKey: string;
    effectiveOn: string;
    releaseStatus: KnowledgeReleaseStatus;
    profileStatus: "DRAFT" | "ACTIVE" | "RETIRED";
    membershipStatus: "DRAFT" | "APPROVED" | "RETIRED";
    conflictFree: boolean;
  };
};

export type ExactRetrievalRequest = {
  use: RetrievalUse;
  canonicalId?: string;
  legacyId?: string;
  subject?: string;
  educationLevel?: EducationLevel;
  recordTypes?: string[];
  releaseId?: string;
  subjectProfileId?: string;
  effectiveOn?: string;
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

export type KnowledgeErrorCode =
  | "NOT_FOUND"
  | "NOT_VERIFIED"
  | "RIGHTS_DENIED"
  | "PROFILE_MISMATCH"
  | "CONFLICT_UNRESOLVED"
  | "SOURCE_INACTIVE"
  | "RELEASE_SUPERSEDED"
  | "PROVENANCE_BROKEN"
  | "SUBJECT_PROFILE_MISMATCH"
  | "KNOWLEDGE_NOT_FOUND"
  | "KNOWLEDGE_RIGHTS_DENIED";

export class KnowledgeGovernanceError extends Error {
  constructor(readonly code: KnowledgeErrorCode, message: string) {
    super(message);
    this.name = "KnowledgeGovernanceError";
  }
}

export class KnowledgeRightsError extends KnowledgeGovernanceError {
  constructor(code: "KNOWLEDGE_RIGHTS_DENIED" | "KNOWLEDGE_NOT_FOUND", message: string) {
    super(code, message);
    this.name = "KnowledgeRightsError";
  }
}
