import { describe, expect, it } from "vitest";
import { can } from "./policy";

const school = { schoolId: "school-a" };
describe("security policy boundary", () => {
  it("requires an active membership", () => expect(can({ active: false, roles: [{ role: "SCHOOL_ADMIN", scope: "SCHOOL" }] }, "workspace.read", school)).toBe(false));
  it("keeps teacher authority separate from HOD authority", () => expect(can({ active: true, roles: [{ role: "TEACHER", scope: "SCHOOL" }] }, "department.read", { ...school, departmentId: "biology" })).toBe(false));
  it("limits HOD access to the granted department", () => { const context = { active: true, roles: [{ role: "HOD", scope: "DEPARTMENT" as const, departmentId: "biology" }] }; expect(can(context, "department.read", { ...school, departmentId: "biology" })).toBe(true); expect(can(context, "department.read", { ...school, departmentId: "chemistry" })).toBe(false); });
  it("supports additive school roles", () => expect(can({ active: true, roles: [{ role: "TEACHER", scope: "SCHOOL" }, { role: "DOS", scope: "SCHOOL" }] }, "audit.read", school)).toBe(false));
});
