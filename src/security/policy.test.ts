import { describe, expect, it } from "vitest";
import { can } from "./policy";

const school = { schoolId: "school-a" };
describe("security policy boundary", () => {
  it("requires an active membership", () => expect(can({ active: false, roles: [{ role: "SCHOOL_ADMIN", scope: "SCHOOL" }] }, "workspace.read", school)).toBe(false));
  it("keeps teacher authority separate from HOD authority", () => expect(can({ active: true, roles: [{ role: "TEACHER", scope: "SCHOOL" }] }, "department.read", { ...school, departmentId: "biology" })).toBe(false));
  it("limits HOD access to the granted department", () => { const context = { active: true, roles: [{ role: "HOD", scope: "DEPARTMENT" as const, departmentId: "biology" }] }; expect(can(context, "department.read", { ...school, departmentId: "biology" })).toBe(true); expect(can(context, "department.read", { ...school, departmentId: "chemistry" })).toBe(false); });
  it("supports additive school roles", () => expect(can({ active: true, roles: [{ role: "TEACHER", scope: "SCHOOL" }, { role: "DOS", scope: "SCHOOL" }] }, "audit.read", school)).toBe(false));
  it("keeps assessment review with HOD/DOS and outside Principal authority", () => {
    expect(can({ active: true, roles: [{ role: "HOD", scope: "DEPARTMENT", departmentId: "biology" }] }, "assessment.review", { ...school, departmentId: "biology" })).toBe(true);
    expect(can({ active: true, roles: [{ role: "HOD", scope: "DEPARTMENT", departmentId: "biology" }] }, "assessment.review", { ...school, departmentId: "chemistry" })).toBe(false);
    expect(can({ active: true, roles: [{ role: "DOS", scope: "SCHOOL" }] }, "assessment.review", { ...school, departmentId: "chemistry" })).toBe(true);
    expect(can({ active: true, roles: [{ role: "PRINCIPAL", scope: "SCHOOL" }] }, "assessment.review", { ...school, departmentId: "biology" })).toBe(false);
  });
  it("does not grant leadership access to private teacher artifacts", () => {
    const context = { active: true, roles: [{ role: "DOS", scope: "SCHOOL" as const }] };
    expect(can(context, "lesson.prepare.private", school)).toBe(false);
    expect(can(context, "teaching_pack.read", school)).toBe(false);
    expect(can(context, "ask_ate.private", school)).toBe(false);
    expect(can(context, "assessment.draft.read", school)).toBe(false);
  });
});
