import { describe, expect, it } from "vitest";
import {
  assertOperationalAcademicPeriod,
  assertProgrammeEventTargetCardinality,
  assertScheduledLessonIsScheduleIntent,
  assertStreamBelongsToClassLevel,
  assertTimetableVersionEditable,
  assertTimetableVersionTransition,
  detectTimetableOverlaps,
  teachingSectionIdentityKey,
} from "@/academic-operations/validation/invariants";

const ids = {
  school: "00000000-0000-0000-0000-000000000001",
  period: "00000000-0000-0000-0000-000000000002",
  teacher: "00000000-0000-0000-0000-000000000003",
  subject: "00000000-0000-0000-0000-000000000004",
  level: "00000000-0000-0000-0000-000000000005",
  stream: "00000000-0000-0000-0000-000000000006",
};

describe("academic operations invariants", () => {
  it("rejects a stream assigned to a different class/level", () => {
    expect(() => assertStreamBelongsToClassLevel("level-a", "level-b")).toThrow("does not belong");
    expect(() => assertStreamBelongsToClassLevel("level-a", "level-a")).not.toThrow();
  });

  it("accepts only open operational academic periods", () => {
    const period = { id: ids.period, schoolId: ids.school, periodType: "TERM" as const, status: "CURRENT" as const };
    expect(() => assertOperationalAcademicPeriod(period)).not.toThrow();
    expect(() => assertOperationalAcademicPeriod({ ...period, periodType: "YEAR" })).toThrow("TERM");
    expect(() => assertOperationalAcademicPeriod({ ...period, status: "CLOSED" })).toThrow("Closed");
  });

  it("uses all Teaching Section identity dimensions", () => {
    const identity = { schoolId: ids.school, academicPeriodId: ids.period, teacherMembershipId: ids.teacher, schoolSubjectId: ids.subject, classLevelId: ids.level, streamId: ids.stream };
    expect(teachingSectionIdentityKey(identity)).toContain(ids.teacher);
    expect(teachingSectionIdentityKey(identity)).not.toBe(teachingSectionIdentityKey({ ...identity, streamId: "00000000-0000-0000-0000-000000000007" }));
  });

  it("detects overlapping slots for the same teacher", () => {
    const overlaps = detectTimetableOverlaps([
      { id: "a", teacherMembershipId: "teacher-a", classLevelId: "level-a", streamId: "stream-a", dayOfWeek: 1, startsAt: "08:00", endsAt: "09:00" },
      { id: "b", teacherMembershipId: "teacher-a", classLevelId: "level-b", streamId: "stream-b", dayOfWeek: 1, startsAt: "08:30", endsAt: "09:30" },
    ]);
    expect(overlaps).toEqual([{ leftSlotId: "a", rightSlotId: "b", reason: "TEACHER" }]);
  });

  it("detects overlapping slots for the same stream/class context", () => {
    const overlaps = detectTimetableOverlaps([
      { id: "a", teacherMembershipId: "teacher-a", classLevelId: "level-a", streamId: "stream-a", dayOfWeek: 2, startsAt: "10:00", endsAt: "11:00" },
      { id: "b", teacherMembershipId: "teacher-b", classLevelId: "level-a", streamId: "stream-a", dayOfWeek: 2, startsAt: "10:30", endsAt: "11:30" },
    ]);
    expect(overlaps).toEqual([{ leftSlotId: "a", rightSlotId: "b", reason: "STREAM" }]);
  });

  it("does not flag different days or adjacent slots", () => {
    expect(detectTimetableOverlaps([
      { id: "a", teacherMembershipId: "teacher-a", classLevelId: "level-a", streamId: "stream-a", dayOfWeek: 1, startsAt: "08:00", endsAt: "09:00" },
      { id: "b", teacherMembershipId: "teacher-a", classLevelId: "level-a", streamId: "stream-a", dayOfWeek: 2, startsAt: "08:00", endsAt: "09:00" },
      { id: "c", teacherMembershipId: "teacher-a", classLevelId: "level-a", streamId: "stream-a", dayOfWeek: 1, startsAt: "09:00", endsAt: "10:00" },
    ])).toEqual([]);
  });

  it("requires exactly one programme event target", () => {
    expect(() => assertProgrammeEventTargetCardinality({ classLevelId: ids.level })).not.toThrow();
    expect(() => assertProgrammeEventTargetCardinality({ classLevelId: ids.level, streamId: ids.stream })).toThrow("exactly one");
    expect(() => assertProgrammeEventTargetCardinality({})).toThrow("exactly one");
  });

  it("enforces timetable version lifecycle and active immutability", () => {
    expect(() => assertTimetableVersionTransition({ current: "DRAFT", next: "VERIFIED" })).not.toThrow();
    expect(() => assertTimetableVersionTransition({ current: "DRAFT", next: "ACTIVE" })).toThrow("Invalid");
    expect(() => assertTimetableVersionTransition({ current: "ACTIVE", next: "RETIRED" })).not.toThrow();
    expect(() => assertTimetableVersionEditable("ACTIVE")).toThrow("cannot be edited");
    expect(() => assertTimetableVersionEditable("DRAFT")).not.toThrow();
  });

  it("keeps scheduled lessons as schedule intent only", () => {
    expect(() => assertScheduledLessonIsScheduleIntent("SCHEDULED")).not.toThrow();
    expect(() => assertScheduledLessonIsScheduleIntent("DELIVERED")).toThrow("schedule intent");
  });
});
