import { describe, expect, it } from "vitest";
import { deriveNextPosition, recommendedFocus, type CurrentPosition, type PositionOption } from "@/teacher/domain/continuity";

const current: CurrentPosition = {
  eventId: "event-1", canonicalId: "topic-1", recordType: "topic", positionKind: "TOPIC", title: "Cells", sourceWording: "Cells", orderingKey: "001", topicCode: "1.2", level: "Senior 2", term: "1", confirmedAt: "2026-09-18T10:00:00Z", sourceTitle: "Biology Syllabus", sourceAuthority: "NCDC", sourceLocator: "source#cells", sourcePageStart: 18, sourcePageEnd: 18, sourceChecksum: "checksum",
};
const next: PositionOption = { canonicalId: "topic-2", recordType: "topic", positionKind: "TOPIC", title: "Nutrition", sourceWording: "Nutrition", orderingKey: "002", topicCode: "1.3", level: "Senior 2", term: "1" };

describe("teacher continuity proposal", () => {
  it("carries the confirmed position when work remains", () => {
    const proposal = deriveNextPosition({ outcome: "PARTIALLY_DELIVERED", current, options: [current, next] });
    expect(proposal.position?.canonicalId).toBe("topic-1");
    expect(proposal.reason).toBe("CONTINUE_UNFINISHED");
  });

  it("advances only as a deterministic proposal after delivery", () => {
    const proposal = deriveNextPosition({ outcome: "DELIVERED", current, options: [current, next] });
    expect(proposal.position?.canonicalId).toBe("topic-2");
    expect(proposal.reason).toBe("ADVANCE_TO_NEXT_VALID_POSITION");
  });

  it("keeps the proposal separate from confirmation", () => {
    const proposal = deriveNextPosition({ outcome: "DELIVERED", current, options: [current, next] });
    expect(proposal.position?.canonicalId).toBe("topic-2");
    expect(proposal.position?.canonicalId).not.toBe(current.canonicalId);
  });

  it("surfaces unfinished work before generic topic guidance", () => {
    expect(recommendedFocus({ current, previousOutcome: "PARTIALLY_DELIVERED", unfinishedWork: "Finish the microscope sketch", scheduledSubject: "Biology" })).toContain("microscope sketch");
  });
});
