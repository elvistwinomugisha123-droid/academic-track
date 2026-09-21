import { describe, expect, it } from "vitest";
import { approvalBlockReason, canReviewAssessment, canTeacherEditAssessment } from "./assessment-review";

describe("leadership assessment review contracts", () => {
  it("keeps IN_REVIEW frozen and RETURNED drafts editable", () => {
    expect(canTeacherEditAssessment("IN_REVIEW")).toBe(false);
    expect(canTeacherEditAssessment("DRAFT")).toBe(true);
  });

  it("keeps HOD review department-scoped and excludes Principal", () => {
    expect(canReviewAssessment("HOD", true)).toBe(true);
    expect(canReviewAssessment("HOD", false)).toBe(false);
    expect(canReviewAssessment("DOS", false)).toBe(true);
    expect(canReviewAssessment("PRINCIPAL", true)).toBe(false);
  });

  it("blocks approval when profile applicability or finalisation permission changes", () => {
    expect(approvalBlockReason({ profileApplicable: false, finalisationPermitted: true })).toContain("no longer applicable");
    expect(approvalBlockReason({ profileApplicable: true, finalisationPermitted: false })).toContain("no longer permit");
    expect(approvalBlockReason({ profileApplicable: true, finalisationPermitted: true })).toBeNull();
  });
});
