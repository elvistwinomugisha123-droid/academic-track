import type { Assessment } from "@/domain/types";
import { assertCanonicalArtifactVersion, type CanonicalArtifactVersion } from "./types";

export function assessmentToCanonicalArtifact(assessment: Assessment, versionId = `${assessment.id}-v1`): CanonicalArtifactVersion {
  return assertCanonicalArtifactVersion({ artifactId: assessment.id, versionId, artifactType: "ASSESSMENT", status: assessment.status === "FINALIZED" ? "FINAL" : assessment.status === "DRAFT" ? "DRAFT" : "REVIEW", ownerScope: assessment.sectionIds.join(","), curriculumAnchorIds: assessment.allowedLearningOutcomeIds, provenance: assessment.provenance, payload: { title: assessment.title, durationMinutes: assessment.durationMinutes, totalMarks: assessment.totalMarks, questions: assessment.questions.map((question) => ({ id: question.id, text: question.text, marks: question.marks, markingGuide: question.markingGuide })) } });
}
