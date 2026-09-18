import { academicPeriodSchema, programmeEventTargetSchema, timetableSlotSchema } from "@/academic-operations/schemas";
import type { OperationalAcademicPeriod, ProgrammeEventTargetInput, TimetableOverlap, TimetableSlotForValidation, TimetableVersionStatus, TimetableVersionTransition } from "@/academic-operations/domain/types";

const operationalPeriodTypes = new Set(["TERM", "SEMESTER", "CUSTOM"]);

export function assertOperationalAcademicPeriod(period: OperationalAcademicPeriod): void {
  academicPeriodSchema.parse(period);
  if (!operationalPeriodTypes.has(period.periodType)) throw new Error("Academic operations require a TERM, SEMESTER, or CUSTOM period");
  if (period.status === "CLOSED" || period.status === "CANCELLED") throw new Error("Closed or cancelled academic periods cannot receive new operational configuration");
}

export function teachingSectionIdentityKey(identity: {
  schoolId: string;
  academicPeriodId: string;
  teacherMembershipId: string;
  schoolSubjectId: string;
  classLevelId: string;
  streamId: string;
}): string {
  return [identity.schoolId, identity.academicPeriodId, identity.teacherMembershipId, identity.schoolSubjectId, identity.classLevelId, identity.streamId].join(":");
}

export function assertStreamBelongsToClassLevel(streamClassLevelId: string, statedClassLevelId: string): void {
  if (streamClassLevelId !== statedClassLevelId) throw new Error("Stream does not belong to the stated class/level");
}

function minutes(value: string): number {
  const [hours, mins, seconds = 0] = value.split(":").map(Number);
  return hours * 60 + mins + seconds / 60;
}

export function assertValidSlotTimeRange(startsAt: string, endsAt: string): void {
  timetableSlotSchema.shape.startsAt.parse(startsAt);
  timetableSlotSchema.shape.endsAt.parse(endsAt);
  if (minutes(endsAt) <= minutes(startsAt)) throw new Error("Timetable slot must end after it starts");
}

export function detectTimetableOverlaps(slots: readonly TimetableSlotForValidation[]): TimetableOverlap[] {
  const overlaps: TimetableOverlap[] = [];
  for (let leftIndex = 0; leftIndex < slots.length; leftIndex += 1) {
    const left = slots[leftIndex];
    assertValidSlotTimeRange(left.startsAt, left.endsAt);
    for (let rightIndex = leftIndex + 1; rightIndex < slots.length; rightIndex += 1) {
      const right = slots[rightIndex];
      if (left.dayOfWeek !== right.dayOfWeek) continue;
      assertValidSlotTimeRange(right.startsAt, right.endsAt);
      const intersects = minutes(left.startsAt) < minutes(right.endsAt) && minutes(right.startsAt) < minutes(left.endsAt);
      if (!intersects) continue;
      if (left.teacherMembershipId === right.teacherMembershipId) overlaps.push({ leftSlotId: left.id, rightSlotId: right.id, reason: "TEACHER" });
      else if (left.classLevelId === right.classLevelId && left.streamId === right.streamId) overlaps.push({ leftSlotId: left.id, rightSlotId: right.id, reason: "STREAM" });
    }
  }
  return overlaps;
}

export function assertProgrammeEventTargetCardinality(target: ProgrammeEventTargetInput): void {
  programmeEventTargetSchema.parse({ eventId: "00000000-0000-0000-0000-000000000001", schoolId: "00000000-0000-0000-0000-000000000002", ...target });
}

const allowedTransitions: Record<TimetableVersionStatus, readonly TimetableVersionStatus[]> = {
  DRAFT: ["DRAFT", "VERIFIED", "RETIRED"],
  VERIFIED: ["VERIFIED", "ACTIVE", "RETIRED"],
  ACTIVE: ["ACTIVE", "RETIRED"],
  RETIRED: ["RETIRED"],
};

export function assertTimetableVersionTransition(transition: TimetableVersionTransition): void {
  if (!allowedTransitions[transition.current].includes(transition.next)) throw new Error(`Invalid timetable version transition: ${transition.current} -> ${transition.next}`);
}

export function assertTimetableVersionEditable(status: TimetableVersionStatus): void {
  if (status === "ACTIVE") throw new Error("Active timetable versions cannot be edited in place");
}

export function assertScheduledLessonIsScheduleIntent(status: string): asserts status is "SCHEDULED" | "CANCELLED" | "SUPERSEDED" {
  if (!["SCHEDULED", "CANCELLED", "SUPERSEDED"].includes(status)) throw new Error("Scheduled lessons only represent schedule intent");
}
