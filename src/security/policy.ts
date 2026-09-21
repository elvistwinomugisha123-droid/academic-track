export type PolicyContext = { active: boolean; roles: ReadonlyArray<{ role: string; scope: "SCHOOL" | "DEPARTMENT"; departmentId?: string }> };
export type PolicyResource = { schoolId: string; departmentId?: string };

export function can(context: PolicyContext, action: string, resource: PolicyResource): boolean {
  if (!context.active || !resource.schoolId) return false;
  const schoolRole = (role: string) => context.roles.some((grant) => grant.role === role && grant.scope === "SCHOOL");
  const departmentRole = (role: string) => Boolean(resource.departmentId && context.roles.some((grant) => grant.role === role && grant.scope === "DEPARTMENT" && grant.departmentId === resource.departmentId));
  if (action === "workspace.read") return true;
  if (action === "assessment.review") return schoolRole("DOS") || departmentRole("HOD");
  if (["school.configure", "membership.manage", "role.grant", "role.revoke", "department.manage", "academic_period.manage", "invitation.create", "invitation.revoke"].includes(action)) return schoolRole("SCHOOL_ADMIN");
  if (action === "audit.read") return schoolRole("SCHOOL_ADMIN") || schoolRole("PRINCIPAL");
  if (action === "department.read") return schoolRole("SCHOOL_ADMIN") || schoolRole("PRINCIPAL") || schoolRole("DOS") || departmentRole("HOD");
  return false;
}
