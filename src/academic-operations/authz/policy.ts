export type AcademicOperationsRole = "TEACHER" | "HOD" | "DOS" | "PRINCIPAL" | "SCHOOL_ADMIN";

export function canManageAcademicConfiguration(role: AcademicOperationsRole): boolean {
  return role === "SCHOOL_ADMIN";
}

export function canManageTimetable(role: AcademicOperationsRole): boolean {
  return role === "DOS" || role === "SCHOOL_ADMIN";
}

export function canReadSchoolWideAcademicOperations(role: AcademicOperationsRole): boolean {
  return role === "DOS" || role === "PRINCIPAL" || role === "SCHOOL_ADMIN";
}

export function canTeacherSeeAssignedSection(actorMembershipId: string, sectionTeacherMembershipId: string): boolean {
  return actorMembershipId === sectionTeacherMembershipId;
}

export function canConfirmTeachingSection(role: AcademicOperationsRole, actorMembershipId: string, sectionTeacherMembershipId: string): boolean {
  return role === "TEACHER" && canTeacherSeeAssignedSection(actorMembershipId, sectionTeacherMembershipId);
}
