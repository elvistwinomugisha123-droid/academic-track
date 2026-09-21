import { describe, expect, it } from "vitest";
import { resolveEligibleScope } from "./eligibility";
import type { SectionEligibility } from "./types";

function section(id: string, confirmedCanonicalIds: string[], explicitlyConfirmedPartialCanonicalIds: string[] = []): SectionEligibility {
  return {
    sectionId: id,
    confirmedCanonicalIds,
    explicitlyConfirmedPartialCanonicalIds,
    evidence: [
      ...confirmedCanonicalIds.map((canonicalId) => ({ canonicalId, sectionId: id, evidenceType: "CONFIRMED_DELIVERY" as const, evidenceReferenceId: `${id}-${canonicalId}`, confirmedByMembershipId: "teacher" })),
      ...explicitlyConfirmedPartialCanonicalIds.map((canonicalId) => ({ canonicalId, sectionId: id, evidenceType: "EXPLICIT_PARTIAL_SCOPE_CONFIRMATION" as const, evidenceReferenceId: `${id}-${canonicalId}`, confirmedByMembershipId: "teacher" })),
    ],
  };
}

describe("assessment taught-scope eligibility", () => {
  it("accumulates delivered preparation anchors instead of replacing them with the current position", () => {
    const result = resolveEligibleScope({
      purpose: "CLASS_TEST",
      sections: [section("stream-a", ["A", "B", "C"])],
      profileAllowsBroaderScope: false,
    });
    expect(result.canonicalIds).toEqual(["A", "B", "C"]);
  });

  it("uses the intersection of accumulated classroom-confirmed scope for common tests", () => {
    const result = resolveEligibleScope({
      purpose: "COMMON_STREAM_TEST",
      sections: [section("stream-a", ["A", "B", "C", "D"]), section("stream-b", ["A", "B", "C"])],
      profileAllowsBroaderScope: false,
    });
    expect(result.canonicalIds).toEqual(["A", "B", "C"]);
  });

  it("does not include partial content until the teacher explicitly confirms that portion", () => {
    const beforeConfirmation = resolveEligibleScope({
      purpose: "CLASS_TEST",
      sections: [section("stream-a", ["A"])],
      profileAllowsBroaderScope: false,
    });
    const afterConfirmation = resolveEligibleScope({
      purpose: "CLASS_TEST",
      sections: [section("stream-a", ["A"], ["B"])],
      profileAllowsBroaderScope: false,
    });
    expect(beforeConfirmation.canonicalIds).toEqual(["A"]);
    expect(afterConfirmation.canonicalIds).toEqual(["A", "B"]);
  });

  it("only joins a partial confirmation after every common-test stream independently confirms it", () => {
    const oneStreamConfirmed = resolveEligibleScope({
      purpose: "COMMON_STREAM_TEST",
      sections: [section("stream-a", ["A"], ["B"]), section("stream-b", ["A"])],
      profileAllowsBroaderScope: false,
    });
    const bothStreamsConfirmed = resolveEligibleScope({
      purpose: "COMMON_STREAM_TEST",
      sections: [section("stream-a", ["A"], ["B"]), section("stream-b", ["A"], ["B"])],
      profileAllowsBroaderScope: false,
    });
    expect(oneStreamConfirmed.canonicalIds).toEqual(["A"]);
    expect(bothStreamsConfirmed.canonicalIds).toEqual(["A", "B"]);
  });

  it("does not turn a changed or not-delivered event into eligibility", () => {
    const result = resolveEligibleScope({
      purpose: "CLASS_TEST",
      sections: [section("stream-a", [])],
      profileAllowsBroaderScope: false,
    });
    expect(result.canonicalIds).toEqual([]);
  });
});
