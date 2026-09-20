import { describe, expect, it } from "vitest";
import { isPotentiallyStale, recommendTeachingPack } from "./lesson";
import { assertCanonicalArtifactVersion, FormalLessonPlanPayloadSchema } from "./types";

const plan = FormalLessonPlanPayloadSchema.parse({
  title: "Cell observation lesson", curriculumAnchor: { canonicalId: "bio-cell", title: "Cell structure", positionKind: "TOPIC", profileId: "profile", rightsState: "REVIEW_REQUIRED" },
  learningIntention: "Explain cell structures", expectedOutcome: "Learners identify two structures", priorLearning: "Microscope safety", continuityContext: "", lessonFocus: "Cell structure", intendedCoverage: "Structures and observation", durationMinutes: 60,
  resources: ["Microscopes"], teachingSequence: [{ id: "s1", label: "Observe", minutes: 25, teacherActivity: "Model an observation", learnerActivity: "Investigate a slide", prompts: ["What do you notice?"], formativeCheck: "Pair explanation" }], differentiation: "", conclusionFollowUp: "Complete the observation table", teacherNotes: "",
});

describe("lesson artifact contracts", () => {
  it("keeps formal lesson plans typed and rights-aware", () => {
    const artifact = assertCanonicalArtifactVersion({ artifactId: "plan", versionId: "plan-v1", artifactType: "FORMAL_LESSON_PLAN", status: "DRAFT", ownerScope: "section", curriculumAnchorIds: ["bio-cell"], rightsState: "REVIEW_REQUIRED", provenance: [], payload: plan });
    if (artifact.artifactType !== "FORMAL_LESSON_PLAN") throw new Error("Expected a Formal Lesson Plan artifact");
    expect(artifact.payload.teachingSequence[0].learnerActivity).toContain("slide");
    expect(artifact.rightsState).toBe("REVIEW_REQUIRED");
  });
  it("recommends only explainable teaching pack children", () => {
    expect(recommendTeachingPack(plan).map((item) => item.artifactType)).toEqual(["ACTIVITY_SHEET", "BOARD_NOTES", "HOMEWORK"]);
  });
  it("detects parent version mismatch without rewriting the child", () => {
    expect(isPotentiallyStale("plan-v2", "plan-v3")).toBe(true);
    expect(isPotentiallyStale("plan-v3", "plan-v3")).toBe(false);
    expect(isPotentiallyStale(null, "plan-v3")).toBe(false);
  });
});
