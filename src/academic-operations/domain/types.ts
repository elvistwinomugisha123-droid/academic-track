export const assignmentStates = ["PROPOSED", "CONFIRMED", "FLAGGED"] as const;
export type AssignmentState = (typeof assignmentStates)[number];

export const teachingSectionStatuses = ["ACTIVE", "PAUSED", "CLOSED"] as const;
export type TeachingSectionStatus = (typeof teachingSectionStatuses)[number];

export const timetableVersionStatuses = ["DRAFT", "VERIFIED", "ACTIVE", "RETIRED"] as const;
export type TimetableVersionStatus = (typeof timetableVersionStatuses)[number];

export const scheduledLessonStatuses = ["SCHEDULED", "CANCELLED", "SUPERSEDED"] as const;
export type ScheduledLessonStatus = (typeof scheduledLessonStatuses)[number];

export type OperationalAcademicPeriod = {
  id: string;
  schoolId: string;
  periodType: "YEAR" | "TERM" | "SEMESTER" | "BREAK" | "CUSTOM";
  status: "PLANNED" | "CURRENT" | "CLOSED" | "CANCELLED";
};

export type TeachingSectionIdentity = {
  schoolId: string;
  academicPeriodId: string;
  teacherMembershipId: string;
  schoolSubjectId: string;
  classLevelId: string;
  streamId: string;
};

export type TimetableSlotForValidation = {
  id: string;
  teacherMembershipId: string;
  classLevelId: string;
  streamId: string;
  dayOfWeek: number;
  startsAt: string;
  endsAt: string;
};

export type TimetableOverlap = {
  leftSlotId: string;
  rightSlotId: string;
  reason: "TEACHER" | "STREAM";
};

export type ProgrammeEventTargetInput = {
  classLevelId?: string;
  streamId?: string;
  departmentId?: string;
};

export type TimetableVersionTransition = {
  current: TimetableVersionStatus;
  next: TimetableVersionStatus;
};
