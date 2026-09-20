import { describe, expect, it } from "vitest";
import { createInitialFormalLessonPlan } from "@/artifacts/lesson-defaults";
import { formalArtifactRightsState, recommendedFocus, safeCurriculumPositionLabel, type CurrentPosition } from "@/teacher/domain/continuity";

const protectedWording = "Protected curriculum source wording must not enter the artifact.";
const rightsLimitedPosition: CurrentPosition = {
  eventId: "event-rights-limited",
  canonicalId: "canonical-rights-limited",
  recordType: "topic",
  positionKind: "TOPIC",
  title: protectedWording,
  sourceWording: protectedWording,
  orderingKey: "001",
  topicCode: "1.1",
  level: "Senior 2",
  term: "1",
  confirmedAt: "2026-09-20T10:00:00Z",
  sourceTitle: "Governed source",
  sourceAuthority: "Test authority",
  sourceLocator: "page:12",
  sourcePageStart: 12,
  sourcePageEnd: 12,
  sourceChecksum: "checksum",
  rightsStatus: "REVIEW_REQUIRED",
  productionUseStatus: "PERMISSION_PENDING",
  formalArtifactAllowed: false,
  exportAllowed: false,
  attributionRequired: true,
};

describe("rights-safe lesson plan defaults", () => {
  it("keeps governed identifiers and provenance metadata while neutralising protected wording", () => {
    const focus = recommendedFocus({ current: rightsLimitedPosition, previousOutcome: null, unfinishedWork: null, scheduledSubject: "Biology" });
    const plan = createInitialFormalLessonPlan({
      recommendedFocus: focus,
      lesson: { startsAt: "2026-09-21T08:00:00Z", endsAt: "2026-09-21T09:00:00Z", unfinishedWork: null },
      curriculum: { subjectProfileId: "profile-rights-limited", current: rightsLimitedPosition },
      previousLesson: null,
    });

    expect(formalArtifactRightsState(rightsLimitedPosition)).toBe("REVIEW_REQUIRED");
    expect(focus).toContain(safeCurriculumPositionLabel);
    expect(plan.curriculumAnchor).toMatchObject({ canonicalId: rightsLimitedPosition.canonicalId, profileId: "profile-rights-limited", title: safeCurriculumPositionLabel, rightsState: "REVIEW_REQUIRED" });
    expect(JSON.stringify(plan)).not.toContain(protectedWording);
    expect(rightsLimitedPosition).toMatchObject({ canonicalId: "canonical-rights-limited", sourceTitle: "Governed source", sourceLocator: "page:12", sourcePageStart: 12, sourcePageEnd: 12 });
  });
});
