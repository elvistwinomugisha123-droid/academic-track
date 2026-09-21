export type AssessmentReviewStatus = "DRAFT" | "IN_REVIEW" | "FINAL";
export type LeadershipReviewRole = "HOD" | "DOS" | "PRINCIPAL";

export function canTeacherEditAssessment(status: AssessmentReviewStatus): boolean {
  return status === "DRAFT";
}

export function canReviewAssessment(role: LeadershipReviewRole, sameDepartment: boolean): boolean {
  return role === "DOS" || (role === "HOD" && sameDepartment);
}

export function approvalBlockReason(input: { profileApplicable: boolean; finalisationPermitted: boolean }): string | null {
  if (!input.profileApplicable) return "The governed assessment profile is no longer applicable.";
  if (!input.finalisationPermitted) return "Current institutional rules no longer permit this assessment to become final.";
  return null;
}
