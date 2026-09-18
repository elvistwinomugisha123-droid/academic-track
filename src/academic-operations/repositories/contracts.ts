import type { ProgrammeEventOverlap } from "@/academic-operations/application/commands";

export interface AcademicOperationsCommands {
  confirmTeachingSectionAssignment(input: unknown): Promise<string>;
  verifyTimetableVersion(input: unknown): Promise<string>;
  activateTimetableVersion(input: unknown): Promise<string>;
}

export interface AcademicOperationsQueries {
  findProgrammeEventOverlaps(scheduledLessonId: string): Promise<ProgrammeEventOverlap[]>;
}
