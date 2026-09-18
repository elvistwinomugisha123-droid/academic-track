import { z } from "zod";
import { assignmentStates, scheduledLessonStatuses, teachingSectionStatuses, timetableVersionStatuses } from "@/academic-operations/domain/types";

const uuid = z.string().uuid();
const nonEmptyText = z.string().trim().min(1);

export const academicPeriodSchema = z.object({
  id: uuid,
  schoolId: uuid,
  periodType: z.enum(["YEAR", "TERM", "SEMESTER", "BREAK", "CUSTOM"]),
  status: z.enum(["PLANNED", "CURRENT", "CLOSED", "CANCELLED"]),
});

export const teachingSectionIdentitySchema = z.object({
  schoolId: uuid,
  academicPeriodId: uuid,
  teacherMembershipId: uuid,
  schoolSubjectId: uuid,
  classLevelId: uuid,
  streamId: uuid,
});

export const teachingSectionSchema = teachingSectionIdentitySchema.extend({
  id: uuid,
  assignmentState: z.enum(assignmentStates),
  operationalStatus: z.enum(teachingSectionStatuses),
  confirmedAt: z.string().datetime().nullable(),
  flagReason: z.string().trim().min(1).nullable(),
});

export const timetableSlotSchema = z.object({
  id: uuid,
  timetableVersionId: uuid,
  teachingSectionId: uuid,
  dayOfWeek: z.number().int().min(1).max(7),
  startsAt: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/),
  endsAt: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/),
  roomLabel: z.string().trim().min(1).nullable(),
});

export const timetableVersionSchema = z.object({
  id: uuid,
  schoolId: uuid,
  academicPeriodId: uuid,
  versionNumber: z.number().int().positive(),
  name: nonEmptyText,
  status: z.enum(timetableVersionStatuses),
  effectiveFrom: z.string().date(),
});

export const scheduledLessonSchema = z.object({
  id: uuid,
  schoolId: uuid,
  academicPeriodId: uuid,
  teachingSectionId: uuid,
  timetableVersionId: uuid,
  timetableSlotId: uuid,
  scheduledDate: z.string().date(),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  scheduleStatus: z.enum(scheduledLessonStatuses),
  supersededByTimetableVersionId: uuid.nullable(),
});

export const programmeEventTargetSchema = z.object({
  eventId: uuid,
  schoolId: uuid,
  classLevelId: uuid.optional(),
  streamId: uuid.optional(),
  departmentId: uuid.optional(),
}).superRefine((target, context) => {
  const count = [target.classLevelId, target.streamId, target.departmentId].filter(Boolean).length;
  if (count !== 1) context.addIssue({ code: z.ZodIssueCode.custom, message: "A programme event target must identify exactly one target type" });
});

export const confirmTeachingSectionAssignmentCommandSchema = z.object({
  sectionId: uuid,
  decision: z.enum(["CONFIRMED", "FLAGGED"]),
  reason: z.string().trim().min(1).max(500).optional(),
});

export const verifyTimetableVersionCommandSchema = z.object({ versionId: uuid });
export const activateTimetableVersionCommandSchema = z.object({ versionId: uuid });
