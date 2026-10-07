import { describe, expect, it } from "vitest";
import { prepareOneTeacherPilot, type OneTeacherPilotInput } from "./one-teacher-bootstrap";

const input: OneTeacherPilotInput = {
  schoolName: "Example School", schoolSlug: "example-school", schoolTimezone: "Africa/Kampala", teacherName: "Example Teacher", teacherEmail: "teacher@example.test",
  existingAuthUserId: "5dd23aa1-48ce-47c8-a741-67bd6156ade5",
  academicPeriod: { name: "Example term", periodType: "TERM", academicYear: 2026, startsOn: "2026-09-01", endsOn: "2026-09-14" },
  timetableEffectiveFrom: "2026-09-01", timetableVersionNumber: 1,
  sections: [
    { subject: "MATHEMATICS", classLevel: "S3", stream: "East", proposedCurriculumPositionId: "topic-a" },
    { subject: "MATHEMATICS", classLevel: "S3", stream: "West", proposedCurriculumPositionId: "topic-b" },
    { subject: "PRINCIPAL_MATHEMATICS", classLevel: "S5", stream: "North" },
  ],
  slots: [
    { sectionIndex: 0, dayOfWeek: 1, startsAt: "08:00", endsAt: "08:40" },
    { sectionIndex: 1, dayOfWeek: 1, startsAt: "09:00", endsAt: "09:40" },
  ],
};

describe("one-teacher pilot preparation", () => {
  it("keeps parallel streams and proposed positions independent and stable on rerun", () => {
    const first = prepareOneTeacherPilot(input);
    expect(prepareOneTeacherPilot(input)).toEqual(first);
    expect(first.sections[0].key).not.toBe(first.sections[1].key);
    expect(first.sections.map((section) => section.proposedCurriculumPositionId)).toEqual(["topic-a", "topic-b", undefined]);
    expect(first.sections.every((section) => section.curriculumPositionState === "AWAITING_TEACHER_CONFIRMATION" && section.assignmentState === "PROPOSED")).toBe(true);
    expect(first.curriculumBindings).toEqual([]);
    expect(first.timetable.scope).toBe("ONLY_THIS_TEACHER");
    expect(first.scheduledLessons).toContainEqual({ sectionKey: first.sections[0].key, scheduledDate: "2026-09-07", startsAt: "08:00", endsAt: "08:40", status: "SCHEDULED" });
    expect(first.scheduledLessons).toHaveLength(4);
  });

  it("rejects overlapping teacher slots and duplicate sections", () => {
    expect(() => prepareOneTeacherPilot({ ...input, slots: [...input.slots, { sectionIndex: 2, dayOfWeek: 1, startsAt: "08:30", endsAt: "09:10" }] })).toThrow();
    expect(() => prepareOneTeacherPilot({ ...input, sections: [...input.sections, input.sections[0]] })).toThrow();
  });

  it("requires Principal or Subsidiary Mathematics to be explicit for S5/S6", () => {
    expect(() => prepareOneTeacherPilot({ ...input, sections: [{ subject: "MATHEMATICS", classLevel: "S5", stream: "North" }] })).toThrow();
    expect(() => prepareOneTeacherPilot({ ...input, sections: [{ subject: "SUBSIDIARY_MATHEMATICS", classLevel: "S3", stream: "North" }] })).toThrow();
  });

  it("matches optional dates to the complete weekly timetable window", () => {
    expect(() => prepareOneTeacherPilot({ ...input, slots: [{ ...input.slots[0], scheduledDates: ["2026-09-08"] }] })).toThrow();
    expect(() => prepareOneTeacherPilot({ ...input, slots: [{ ...input.slots[0], scheduledDates: ["2026-09-07", "2026-09-07"] }] })).toThrow();
    expect(() => prepareOneTeacherPilot({ ...input, slots: [{ ...input.slots[0], scheduledDates: ["2026-09-07"] }] })).toThrow();
    expect(prepareOneTeacherPilot({ ...input, slots: [{ ...input.slots[0], scheduledDates: ["2026-09-07", "2026-09-14"] }] }).scheduledLessons).toHaveLength(2);
    expect(prepareOneTeacherPilot({ ...input, academicPeriod: { ...input.academicPeriod, academicYear: 2027 } }).sections[0].key)
      .not.toEqual(prepareOneTeacherPilot(input).sections[0].key);
  });

  it("keeps Chemistry school subjects distinct across levels", () => {
    const result = prepareOneTeacherPilot({ ...input, sections: [
      { subject: "CHEMISTRY", classLevel: "S3", stream: "East" },
      { subject: "CHEMISTRY", classLevel: "S5", stream: "East" },
    ], slots: [] });
    expect(result.subjects.map((subject) => subject.key)).toEqual(["LOWER_CHEMISTRY", "ADVANCED_CHEMISTRY"]);
    expect(result.sections[0].key).not.toBe(result.sections[1].key);
  });

  it("rejects implicit position confirmation and incomplete curriculum binding data", () => {
    expect(() => prepareOneTeacherPilot({ ...input, sections: [{ subject: "CHEMISTRY", classLevel: "S3", stream: "East", curriculumProfileId: "5dd23aa1-48ce-47c8-a741-67bd6156ade5" }], slots: [] })).toThrow();
    expect(() => prepareOneTeacherPilot({ ...input, sections: [{ subject: "CHEMISTRY", classLevel: "S3", stream: "East", positionConfirmed: true } as never], slots: [] })).toThrow();
  });
});
