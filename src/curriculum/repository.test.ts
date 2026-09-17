import { describe, expect, it } from "vitest";
import { buildCurriculumContext } from "./context-builders";
import { getCurriculumLearningOutcome, getCurriculumTopic } from "./repository";
import { fixtureState as seedState } from "@/test/fixtures/academic-state";

describe("Astra curriculum repository", () => {
  it("resolves Senior 1 Introduction to Biology with canonical IDs", () => {
    const topic = getCurriculumTopic("bio-s1-t1-1.1");
    expect(topic.title).toBe("INTRODUCTION TO BIOLOGY");
    expect(topic.learningOutcomes.map((item) => item.id)).toEqual([
      "bio-s1-t1-1.1-lo-01",
      "bio-s1-t1-1.1-lo-02",
      "bio-s1-t1-1.1-lo-03",
    ]);
    expect(getCurriculumLearningOutcome("bio-s1-t1-1.1-lo-01")?.text).toContain("biology is the study of life");
  });

  it("resolves Nutrition in Green Plants and preserves review scope", () => {
    const topic = getCurriculumTopic("bio-s2-t2-3.2");
    expect(topic.title).toBe("NUTRITION IN GREEN PLANTS");
    expect(topic.allocatedPeriods).toBe(10);
    expect(topic.learningOutcomes.map((item) => item.id)).toContain("bio-s2-t2-3.2-lo-01");
    expect(getCurriculumLearningOutcome("bio-s2-t2-3.2-lo-03")?.review).toMatchObject({ state: "REVIEW_REQUIRED", reviewIds: ["review-023"] });
    expect(topic.learningOutcomes.find((item) => item.id === "bio-s2-t2-3.2-lo-02")?.review.state).toBe("VERIFIED");
  });

  it("resolves Teaching Section context from canonical topic IDs", () => {
    const context = buildCurriculumContext(seedState, "s2-east-biology");
    expect(context.topic.id).toBe("bio-s2-t2-3.2");
    expect(context.topic.suggestedLearningActivities.length).toBeGreaterThan(0);
    expect(context.topic.provenance.documentId).toBe("ncdc-biology-2019");
  });
});
