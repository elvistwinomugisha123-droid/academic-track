export function assessmentLevelMatches(className: string, curriculumLevel: string): boolean {
  const number = (value: string) => value.toLowerCase().match(/\b(?:senior|s)\s*([1-6])\b/)?.[1];
  const classNumber = number(className);
  const curriculumNumber = number(curriculumLevel);
  return Boolean(classNumber && curriculumNumber && classNumber === curriculumNumber);
}
