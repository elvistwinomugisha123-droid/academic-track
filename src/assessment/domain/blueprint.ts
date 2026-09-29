import { assessmentDifficulties, assessmentItemTypes, type AssessmentBlueprint } from "./types";

export function blueprintIssues(blueprint: AssessmentBlueprint): string[] {
  const issues: string[] = [];
  const count = assessmentItemTypes.reduce((sum, type) => sum + (blueprint.itemDistribution[type] || 0), 0);
  const marks = assessmentItemTypes.reduce((sum, type) => sum + (blueprint.marksDistribution[type] || 0), 0);
  const difficultyCount = assessmentDifficulties.reduce((sum, level) => sum + (blueprint.difficultyDistribution[level] || 0), 0);
  if (!blueprint.scopeCanonicalIds.length) issues.push("Confirm eligible curriculum content before setting the paper.");
  if (!count) issues.push("Set the number of questions in the blueprint.");
  if (marks !== blueprint.totalMarks) issues.push(`Allocate all ${blueprint.totalMarks} marks across question types.`);
  if (difficultyCount !== count) issues.push("The difficulty mix must add up to the number of questions.");
  for (const type of assessmentItemTypes) {
    const typeCount = blueprint.itemDistribution[type] || 0;
    const typeMarks = blueprint.marksDistribution[type] || 0;
    if (typeCount > typeMarks) issues.push(`${type.replaceAll("_", " ")} needs at least one mark per question.`);
    if (!typeCount && typeMarks) issues.push(`Remove marks allocated to unused ${type.replaceAll("_", " ")} questions.`);
  }
  return issues;
}
