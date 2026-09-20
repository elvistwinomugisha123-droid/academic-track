import type { AIArtifactOperation, TrustedLessonAIContext } from "./lesson-artifact-contracts";

export function lessonArtifactSystemPrompt(operation: AIArtifactOperation, artifactType?: string, selectedField?: string | null) {
  const target = artifactType ? `The target artifact type is ${artifactType}.` : "The target is a Formal Lesson Plan.";
  const field = selectedField ? `The teacher selected the ${selectedField} section; improve that section while preserving all unrelated fields.` : "Preserve all deterministic institutional facts and keep the response complete.";
  return `You are ATE's bounded drafting assistant for a teacher. ${target} ${field}
Return only one JSON object matching the supplied schema. Do not include markdown, commentary, curriculum source quotations, invented canonical IDs, invented provenance, official approval claims, or claims that teaching has already happened.
The teacher remains the final authority. Keep the scheduled duration and governed anchor unchanged. Use practical, concise language suitable for a Ugandan secondary classroom.
Operation: ${operation}.`;
}

export function lessonArtifactUserContext(context: TrustedLessonAIContext, currentArtifact: unknown | null, instruction?: string, selectedField?: string | null) {
  return {
    safeContext: {
      subject: context.subjectName,
      classLevel: context.classLevelName,
      stream: context.streamName,
      durationMinutes: context.durationMinutes,
      lessonFocus: context.lessonFocus,
      intendedCoverage: context.intendedCoverage,
      teacherNotes: context.teacherNotes,
      preparationNotes: context.preparationNotes,
      continuityNote: context.continuityNote,
      previousOutcome: context.previousOutcome,
      governedAnchor: context.anchor ? {
        canonicalId: context.anchor.canonicalId,
        profileId: context.anchor.profileId,
        positionKind: context.anchor.positionKind,
        label: context.anchor.safeLabel,
        sourceId: context.anchor.sourceId,
        locator: context.anchor.sourceLocator,
        pageStart: context.anchor.sourcePageStart,
        pageEnd: context.anchor.sourcePageEnd,
        rightsState: context.anchor.rightsState,
      } : null,
    },
    currentArtifact,
    teacherInstruction: instruction || null,
    selectedField: selectedField || null,
  };
}
