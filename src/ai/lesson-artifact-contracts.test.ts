import { describe, expect, it } from "vitest";
import { canUseExternalAI, safeModelContext, validateGeneratedArtifact, type TrustedLessonAIContext } from "./lesson-artifact-contracts";
import { canonicalJson } from "./canonical-json";
import { lessonArtifactSystemPrompt } from "./lesson-artifact-prompts";
import { askATEOutputSchema, lessonArtifactOutputSchemas } from "./lesson-artifact-output-schema";

const context: TrustedLessonAIContext = {
  schoolId: "00000000-0000-0000-0000-000000000001", membershipId: "00000000-0000-0000-0000-000000000002", userId: "00000000-0000-0000-0000-000000000003", scheduledLessonId: "00000000-0000-0000-0000-000000000004", teachingSectionId: "00000000-0000-0000-0000-000000000005", subjectName: "Biology", classLevelName: "S2", streamName: "East", durationMinutes: 40, lessonFocus: "Cell structure", intendedCoverage: "Cell parts", teacherNotes: "Use local materials", preparationNotes: "No projector", continuityNote: "Finish the diagram", previousOutcome: "PARTIALLY_DELIVERED", anchor: { canonicalId: "canon-1", profileId: "profile-1", positionKind: "TOPIC", safeLabel: "Cell structure", sourceId: "source-1", sourceLocator: "page:2", sourcePageStart: 2, sourcePageEnd: 2, rightsState: "CLEARED", externalAiAllowed: true, formalArtifactAllowed: true, exportAllowed: true }, protectedSourceWording: "Protected source wording", supportingRecords: [] };

const plan = { title: "Cell structure lesson", curriculumAnchor: { canonicalId: "canon-1", title: "Cell structure", positionKind: "TOPIC" as const, profileId: "profile-1", rightsState: "CLEARED" as const }, learningIntention: "Explain cell parts", expectedOutcome: "Learners label a cell", priorLearning: "Living things", continuityContext: "Finish the diagram", lessonFocus: "Cell structure", intendedCoverage: "Cell parts", durationMinutes: 40, resources: ["Chart"], teachingSequence: [{ id: "step-1", label: "Introduction", minutes: 10, teacherActivity: "Model", learnerActivity: "Observe", prompts: ["What do you notice?"], formativeCheck: "Questioning" }], differentiation: "Pair support", conclusionFollowUp: "Review", teacherNotes: "" };

describe("lesson artifact AI trust boundary", () => {
  it("supplies complete JSON schemas to the provider", () => {
    for (const schema of Object.values(lessonArtifactOutputSchemas)) {
      expect(schema.additionalProperties).toBe(false);
      expect(schema.required).toEqual(Object.keys(schema.properties as Record<string, unknown>));
    }
    expect(lessonArtifactOutputSchemas.FORMAL_LESSON_PLAN.required).toContain("teachingSequence");
    expect(lessonArtifactOutputSchemas.FORMAL_LESSON_PLAN.required).toContain("curriculumAnchor");
    expect(askATEOutputSchema.required).toEqual(["answer", "suggestedFollowUps"]);
  });
  it("blocks a curriculum-grounded external call when the governed source is not AI-cleared", () => {
    const blocked = { ...context, anchor: { ...context.anchor!, externalAiAllowed: false } };
    expect(canUseExternalAI(blocked)).toBe(false);
    expect(JSON.stringify(safeModelContext(blocked))).not.toContain(blocked.protectedSourceWording!);
  });

  it("rejects a generic lesson template even when its fields are valid", () => {
    const generic = { ...plan, title: "Current confirmed curriculum position", lessonFocus: "Verify the exact topic" };
    expect(() => validateGeneratedArtifact("FORMAL_LESSON_PLAN", generic, context)).toThrow(/ATE_QUALITY_GATE_GENERIC/);
  });

  it("includes approved supporting curriculum in the trusted model context", () => {
    const enriched = { ...context, supportingRecords: [{ recordType: "learning_outcome", title: "Explain mole–mass relationships" }] };
    expect(JSON.stringify(safeModelContext(enriched))).toContain("mole–mass relationships");
  });

  it("preserves the trusted anchor and scheduled duration", () => {
    expect(validateGeneratedArtifact("FORMAL_LESSON_PLAN", plan, context)).toMatchObject({ durationMinutes: 40, curriculumAnchor: { canonicalId: "canon-1", profileId: "profile-1" } });
    expect(() => validateGeneratedArtifact("FORMAL_LESSON_PLAN", { ...plan, durationMinutes: 20 }, context)).toThrow(/duration/);
    expect(() => validateGeneratedArtifact("FORMAL_LESSON_PLAN", { ...plan, curriculumAnchor: { ...plan.curriculumAnchor, canonicalId: "invented" } }, context)).toThrow(/anchor/);
  });

  it("rejects malformed model output and protected wording in rights-limited artifacts", () => {
    expect(() => validateGeneratedArtifact("ACTIVITY_SHEET", { title: "Activity", instructions: "Do this" }, context)).toThrow();
    const restricted = { ...context, anchor: { ...context.anchor!, formalArtifactAllowed: false, rightsState: "REVIEW_REQUIRED" as const } };
    expect(() => validateGeneratedArtifact("BOARD_NOTES", { title: "Board notes", keyPoints: ["Protected source wording"], examples: [], equations: [], prompts: [] }, restricted)).toThrow(/curriculum wording/);
  });

  it("tells the model the required plan and pack shapes before validating its response", () => {
    const lessonPrompt = lessonArtifactSystemPrompt("GENERATE_FORMAL_LESSON_PLAN", "FORMAL_LESSON_PLAN");
    expect(lessonPrompt).toContain('"teachingSequence"');
    expect(lessonPrompt).toContain('"curriculumAnchor"');
    expect(lessonPrompt).toContain("Do not transform differentiation into an array");
    const packPrompt = lessonArtifactSystemPrompt("GENERATE_TEACHING_PACK", "ACTIVITY_SHEET");
    expect(packPrompt).toContain('"observationResponseArea"');
    expect(packPrompt).toContain("saved Formal Lesson Plan");
  });

  it("canonicalizes reordered proposal objects identically and keeps safe context rights-aware", () => {
    const first = { b: 2, a: { y: true, x: ["one", "two"] } };
    const second = { a: { x: ["one", "two"], y: true }, b: 2 };
    expect(canonicalJson(first)).toBe(canonicalJson(second));
    const safe = safeModelContext({ ...context, anchor: { ...context.anchor!, formalArtifactAllowed: false, externalAiAllowed: false } }, plan, "Make it shorter", "teachingSequence");
    expect(safe).toMatchObject({ currentArtifact: plan, teacherInstruction: "Make it shorter", selectedField: "teachingSequence" });
    expect(canonicalJson(safe)).not.toContain(context.protectedSourceWording!);
  });
});
