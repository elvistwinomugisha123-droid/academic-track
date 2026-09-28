import { safeModelContext, type AIArtifactOperation, type TrustedLessonAIContext } from "./lesson-artifact-contracts";

export function lessonArtifactSystemPrompt(operation: AIArtifactOperation, artifactType?: string, selectedField?: string | null) {
  const target = artifactType ? `The target artifact type is ${artifactType}.` : "The target is a Formal Lesson Plan.";
  const field = selectedField ? `The teacher selected the ${selectedField} section; improve that section while preserving all unrelated fields.` : "Preserve all deterministic institutional facts and keep the response complete.";
  const shapes: Record<string, string> = {
    FORMAL_LESSON_PLAN: `{"title":string,"curriculumAnchor":null or {"canonicalId":string,"title":string,"positionKind":"TOPIC"|"LEARNING_OUTCOME"|null,"profileId":string|null,"rightsState":"CLEARED"|"REVIEW_REQUIRED"|"RESTRICTED"|"UNKNOWN"},"learningIntention":string,"expectedOutcome":string,"priorLearning":string,"continuityContext":string,"lessonFocus":string,"intendedCoverage":string,"durationMinutes":integer,"resources":string[],"teachingSequence":[{"id":string,"label":string,"minutes":integer,"teacherActivity":string,"learnerActivity":string,"prompts":string[],"formativeCheck":string}],"differentiation":string,"conclusionFollowUp":string,"teacherNotes":string}`,
    BOARD_NOTES: `{"title":string,"keyPoints":string[],"examples":string[],"equations":string[],"prompts":string[]}`,
    LEARNER_NOTES: `{"title":string,"keyConcepts":string[],"explanation":string,"examples":string[],"applications":string[],"summary":string}`,
    ACTIVITY_SHEET: `{"title":string,"instructions":string,"materialsRequired":string[],"tasks":string[],"questions":string[],"observationResponseArea":string,"conclusionPrompts":string[]}`,
    LESSON_SUMMARY: `{"title":string,"keyTakeaways":string[],"conciseSummary":string,"learnerReflection":string}`,
    HOMEWORK: `{"title":string,"instructions":string,"tasks":string[],"followUpNotes":string}`,
  };
  const planShape = `The complete JSON shape is ${shapes[artifactType || "FORMAL_LESSON_PLAN"]}. Include every field, even when an optional narrative is empty. ${artifactType === "FORMAL_LESSON_PLAN" ? "Copy the exact governedContext canonicalId, label, positionKind, profileId and rightsState into curriculumAnchor; use null if governedContext is null. Copy lesson.durationMinutes exactly. Do not transform differentiation into an array. Teaching sequence minutes should add up to the scheduled duration." : "Use the saved Formal Lesson Plan in currentArtifact as context, but produce only the requested Teaching Pack shape."} Use plain strings for narrative fields.`;
  return `You are ATE's bounded drafting assistant for a teacher. ${target} ${field} ${planShape}
Return only one JSON object matching the supplied schema. Do not include markdown, commentary, curriculum source quotations, invented canonical IDs, invented provenance, official approval claims, or claims that teaching has already happened.
The teacher remains the final authority. Keep the scheduled duration and governed anchor unchanged. Use practical, concise language suitable for a Ugandan secondary classroom.
Operation: ${operation}.`;
}

export function lessonArtifactUserContext(context: TrustedLessonAIContext, currentArtifact: unknown | null, instruction?: string, selectedField?: string | null) {
  return safeModelContext(context, currentArtifact, instruction || null, selectedField || null);
}
