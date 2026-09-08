import { describe, expect, it } from "vitest";
import { deriveHODView, deriveDOSExceptions, derivePrincipalSummary, eligibleOutcomes, recordLessonOutcome, roleSummary } from "./engine";
import { seedState } from "@/data/seed";
import { getCurriculumTopic } from "@/curriculum/repository";

describe("academic state engine", () => {
  it("keeps an unrecorded lesson unconfirmed", () => {
    expect(seedState.sections[0].currentOutcomeStatus).toBe("UNCONFIRMED");
    expect(seedState.lessons[0].status).toBe("DUE");
  });
  it("propagates a partial outcome into unfinished work", () => {
    const state = recordLessonOutcome(seedState, { scheduledLessonId: "lesson-1", sectionId: seedState.sections[0].id, recordedBy: "person-teacher", type: "PARTIALLY_DELIVERED", unfinishedSegmentIds: ["segment-activity"], addressedLearningOutcomeIds: ["bio-s1-t1-1.1-lo-1"], partiallyAddressedLearningOutcomeIds: ["bio-s1-t1-1.1-lo-2"], note: "Time ran short" });
    expect(state.unfinished).toHaveLength(1);
    expect(state.sections[0].currentOutcomeStatus).toBe("PARTIALLY_ADDRESSED");
    expect(state.lessons[0].status).toBe("OUTCOME_RECORDED");
  });
  it("allows a class test only from confirmed taught content", () => {
    const state = recordLessonOutcome(seedState, { scheduledLessonId: "lesson-1", sectionId: seedState.sections[0].id, recordedBy: "person-teacher", type: "DELIVERED_AS_PLANNED", addressedLearningOutcomeIds: getCurriculumTopic("bio-s1-t1-1.1").learningOutcomes.map((item) => item.id), partiallyAddressedLearningOutcomeIds: [] });
    const scope = eligibleOutcomes(state, [state.sections[0].id], "CLASS_TEST");
    expect(scope.allowed).toHaveLength(3);
  });
  it("keeps diagnostic scope distinct from coverage scope", () => {
    const scope = eligibleOutcomes(seedState, [seedState.sections[0].id], "DIAGNOSTIC");
    expect(scope.allowed).toHaveLength(3);
  });
  it("derives principal summary from shared state", () => {
    expect(roleSummary(seedState).unconfirmed).toBe(6);
  });
  it("propagates one partial teacher action through leadership views", () => {
    const state = recordLessonOutcome(seedState, { scheduledLessonId: "lesson-5", sectionId: "s2-west-biology", recordedBy: "person-teacher", type: "PARTIALLY_DELIVERED", unfinishedSegmentIds: ["segment-activity"], addressedLearningOutcomeIds: ["bio-s2-t2-3.2-lo-01"], partiallyAddressedLearningOutcomeIds: ["bio-s2-t2-3.2-lo-02"] });
    expect(deriveHODView(state).streamDrift.some((item) => item.unfinished > 0)).toBe(true);
    expect(deriveDOSExceptions(state)).toHaveLength(0);
    expect(derivePrincipalSummary(state).unconfirmedSections).toBe(5);
  });
  it("uses common stream intersection after both streams confirm the same topic", () => {
    const east = recordLessonOutcome(seedState, { scheduledLessonId: "lesson-4", sectionId: "s2-east-biology", recordedBy: "person-teacher", type: "DELIVERED_AS_PLANNED", addressedLearningOutcomeIds: getCurriculumTopic("bio-s2-t2-3.2").learningOutcomes.map((item) => item.id), partiallyAddressedLearningOutcomeIds: [] });
    const both = recordLessonOutcome(east, { scheduledLessonId: "lesson-5", sectionId: "s2-west-biology", recordedBy: "person-teacher", type: "DELIVERED_AS_PLANNED", addressedLearningOutcomeIds: getCurriculumTopic("bio-s2-t2-3.2").learningOutcomes.map((item) => item.id), partiallyAddressedLearningOutcomeIds: [] });
    expect(eligibleOutcomes(both, ["s2-east-biology", "s2-west-biology"], "COMMON_STREAM_TEST").allowed).toHaveLength(3);
  });
});
