import type { Assessment } from "@/domain/types";
import type { AssessmentPayload } from "@/assessment/domain/types";
import { assertCanonicalArtifactVersion, type CanonicalArtifactVersion } from "./types";

export function assessmentToCanonicalArtifact(assessment: Assessment, versionId = `${assessment.id}-v1`): CanonicalArtifactVersion {
  return assertCanonicalArtifactVersion({ artifactId: assessment.id, versionId, artifactType: "ASSESSMENT", status: assessment.status === "FINALIZED" ? "FINAL" : assessment.status === "DRAFT" ? "DRAFT" : "REVIEW", ownerScope: assessment.sectionIds.join(","), curriculumAnchorIds: assessment.allowedLearningOutcomeIds, provenance: assessment.provenance, payload: { title: assessment.title, durationMinutes: assessment.durationMinutes, totalMarks: assessment.totalMarks, questions: assessment.questions.map((question) => ({ id: question.id, text: question.text, marks: question.marks, markingGuide: question.markingGuide })) } });
}

export function assessmentPayloadToCanonicalArtifact(input: { id: string; versionId: string; status: "DRAFT" | "IN_REVIEW" | "FINAL"; ownerScope: string[]; curriculumAnchorIds: string[]; provenance: Array<{ category: string; label: string; sourceId?: string; sourceLocation?: string; rightsState?: string }>; payload: AssessmentPayload }): CanonicalArtifactVersion {
  return assertCanonicalArtifactVersion({ artifactId: input.id, versionId: input.versionId, artifactType: "ASSESSMENT", status: input.status, ownerScope: input.ownerScope.join(","), curriculumAnchorIds: input.curriculumAnchorIds, provenance: input.provenance, payload: input.payload });
}
