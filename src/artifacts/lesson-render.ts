import type { CanonicalArtifactVersion } from "./types";

export type LessonRenderSection = { heading: string; paragraphs?: string[]; items?: string[]; sequence?: Array<{ label: string; minutes: number; teacherActivity: string; learnerActivity: string; prompts: string[]; formativeCheck: string }> };
export type LessonRenderModel = { title: string; sections: LessonRenderSection[] };

const paragraph = (heading: string, value: string): LessonRenderSection => ({ heading, paragraphs: value ? [value] : [] });
const list = (heading: string, values: string[]): LessonRenderSection => ({ heading, items: values.filter(Boolean) });

export function lessonArtifactRenderModel(artifact: Exclude<CanonicalArtifactVersion, { artifactType: "ASSESSMENT" }>): LessonRenderModel {
  switch (artifact.artifactType) {
    case "FORMAL_LESSON_PLAN": { const p = artifact.payload; const sections = [paragraph("Learning intention", p.learningIntention), paragraph("Expected outcome", p.expectedOutcome), paragraph("Lesson focus", p.lessonFocus), paragraph("Prior learning / continuity", [p.priorLearning, p.continuityContext].filter(Boolean).join("\n")), list("Resources", p.resources), { heading: "Teaching sequence", sequence: p.teachingSequence }, paragraph("Differentiation", p.differentiation), paragraph("Follow-up", p.conclusionFollowUp), paragraph("Teacher notes", p.teacherNotes)]; return { title: p.title, sections: populatedSections(sections) }; }
    case "BOARD_NOTES": { const p = artifact.payload; return { title: p.title, sections: [list("Key points", p.keyPoints), list("Examples", p.examples), list("Equations", p.equations), list("Prompts", p.prompts)] }; }
    case "LEARNER_NOTES": { const p = artifact.payload; return { title: p.title, sections: [list("Key concepts", p.keyConcepts), paragraph("Explanation", p.explanation), list("Examples", p.examples), list("Applications", p.applications), paragraph("Summary", p.summary)] }; }
    case "ACTIVITY_SHEET": { const p = artifact.payload; return { title: p.title, sections: [paragraph("Instructions", p.instructions), list("Materials required", p.materialsRequired), list("Tasks", p.tasks), list("Questions", p.questions), paragraph("Observation / response", p.observationResponseArea), list("Conclusion", p.conclusionPrompts)] }; }
    case "LESSON_SUMMARY": { const p = artifact.payload; return { title: p.title, sections: [list("Key takeaways", p.keyTakeaways), paragraph("Summary", p.conciseSummary), paragraph("Learner reflection", p.learnerReflection)] }; }
    case "HOMEWORK": { const p = artifact.payload; return { title: p.title, sections: [paragraph("Instructions", p.instructions), list("Tasks", p.tasks), paragraph("Follow-up", p.followUpNotes)] }; }
  }
}

function populatedSections(sections: LessonRenderSection[]): LessonRenderSection[] {
  return sections.filter((section) => Boolean(section.paragraphs?.some((value) => value.trim()) || section.items?.some((value) => value.trim()) || section.sequence?.length));
}
