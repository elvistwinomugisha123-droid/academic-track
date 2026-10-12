import { canonicalJson } from "@/ai/canonical-json";
import type { AssessmentPayload } from "./types";

/** A regeneration may change the selected question's teaching content, not the paper's contract. */
export function singleQuestionChangeError(previous: AssessmentPayload, proposed: AssessmentPayload, questionId: string): string | null {
  const original = previous.questions.find((question) => question.id === questionId);
  if (!original) return "The selected saved question no longer exists. Refresh the assessment.";
  if (previous.questions.length !== proposed.questions.length) return "ATE changed the number of questions.";
  if (canonicalJson({ ...previous, questions: [] }) !== canonicalJson({ ...proposed, questions: [] })) return "ATE changed the paper or saved blueprint.";
  for (let index = 0; index < previous.questions.length; index++) {
    const before = previous.questions[index];
    const after = proposed.questions[index];
    if (before.id !== after.id) return "ATE changed question order or identifiers.";
    if (before.id !== questionId && canonicalJson(before) !== canonicalJson(after)) return `ATE changed question ${index + 1} outside the selected question.`;
    if (before.id === questionId && (before.marks !== after.marks || before.itemType !== after.itemType || before.difficulty !== after.difficulty || canonicalJson(before.canonicalIds) !== canonicalJson(after.canonicalIds))) return "ATE changed the selected question's marks, type, difficulty or curriculum scope.";
  }
  const replacement = proposed.questions.find((question) => question.id === questionId)!;
  if (canonicalJson(original) === canonicalJson(replacement)) return "ATE returned the same question. Try again or edit it manually.";
  return null;
}
