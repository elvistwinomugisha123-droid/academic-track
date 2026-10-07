import { z } from "zod";

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const subject = z.enum(["MATHEMATICS", "CHEMISTRY", "PRINCIPAL_MATHEMATICS", "SUBSIDIARY_MATHEMATICS"]);
const sectionInput = z.object({
  subject,
  classLevel: z.enum(["S1", "S2", "S3", "S4", "S5", "S6"]),
  stream: z.string().trim().min(1),
  classroomConstraints: z.array(z.string().trim().min(1)).default([]),
  proposedCurriculumPositionId: z.string().trim().min(1).optional(),
  curriculumProfileId: z.string().uuid().optional(),
  bindingEffectiveFrom: date.optional(),
}).strict();
const slotInput = z.object({
  sectionIndex: z.number().int().nonnegative(),
  dayOfWeek: z.number().int().min(1).max(7),
  startsAt: time,
  endsAt: time,
  room: z.string().trim().optional(),
  scheduledDates: z.array(date).default([]),
}).strict();

function occurrenceDates(first: string, last: string, dayOfWeek: number): string[] {
  const dates: string[] = [];
  for (let milliseconds = Date.parse(`${first}T00:00:00Z`); milliseconds <= Date.parse(`${last}T00:00:00Z`); milliseconds += 86_400_000) {
    const current = new Date(milliseconds);
    if ((current.getUTCDay() || 7) === dayOfWeek) dates.push(current.toISOString().slice(0, 10));
  }
  return dates;
}

export const oneTeacherPilotInput = z.object({
  createSchoolIfMissing: z.boolean().default(false),
  schoolName: z.string().trim().min(1),
  schoolSlug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  schoolTimezone: z.string().trim().min(1),
  teacherName: z.string().trim().min(1),
  teacherEmail: z.string().email(),
  existingAuthUserId: z.string().uuid(),
  academicPeriod: z.object({ name: z.string().trim().min(1), periodType: z.enum(["TERM", "SEMESTER", "CUSTOM"]), academicYear: z.number().int(), startsOn: date, endsOn: date }).strict(),
  timetableEffectiveFrom: date,
  timetableVersionNumber: z.number().int().positive(),
  sections: z.array(sectionInput).min(1),
  slots: z.array(slotInput),
}).strict().superRefine((input, ctx) => {
  if (input.academicPeriod.endsOn < input.academicPeriod.startsOn) ctx.addIssue({ code: "custom", path: ["academicPeriod", "endsOn"], message: "Period ends before it starts." });
  if (input.timetableEffectiveFrom < input.academicPeriod.startsOn || input.timetableEffectiveFrom > input.academicPeriod.endsOn) ctx.addIssue({ code: "custom", path: ["timetableEffectiveFrom"], message: "Timetable effective date must be within the academic period." });
  const sectionKeys = new Set<string>();
  input.sections.forEach((section, index) => {
    const advanced = section.classLevel === "S5" || section.classLevel === "S6";
    if (advanced && section.subject === "MATHEMATICS") ctx.addIssue({ code: "custom", path: ["sections", index], message: "Choose Principal or Subsidiary Mathematics explicitly." });
    if (!advanced && (section.subject === "PRINCIPAL_MATHEMATICS" || section.subject === "SUBSIDIARY_MATHEMATICS")) ctx.addIssue({ code: "custom", path: ["sections", index], message: "Advanced Mathematics requires S5 or S6." });
    if (Boolean(section.curriculumProfileId) !== Boolean(section.bindingEffectiveFrom)) ctx.addIssue({ code: "custom", path: ["sections", index], message: "A curriculum binding requires both an eligible profile ID and an explicit effective date." });
    if (section.bindingEffectiveFrom && (section.bindingEffectiveFrom < input.academicPeriod.startsOn || section.bindingEffectiveFrom > input.academicPeriod.endsOn)) ctx.addIssue({ code: "custom", path: ["sections", index, "bindingEffectiveFrom"], message: "Binding effective date must be within the academic period." });
    const key = [section.subject, section.classLevel, section.stream.toLowerCase()].join("|");
    if (sectionKeys.has(key)) ctx.addIssue({ code: "custom", path: ["sections", index], message: "Duplicate Teaching Section." });
    sectionKeys.add(key);
  });
  input.slots.forEach((slot, index) => {
    if (!input.sections[slot.sectionIndex]) ctx.addIssue({ code: "custom", path: ["slots", index, "sectionIndex"], message: "Unknown Teaching Section." });
    if (slot.endsAt <= slot.startsAt) ctx.addIssue({ code: "custom", path: ["slots", index], message: "Lesson end must follow start." });
    if (new Set(slot.scheduledDates).size !== slot.scheduledDates.length) ctx.addIssue({ code: "custom", path: ["slots", index, "scheduledDates"], message: "Scheduled dates must be unique within a timetable slot." });
    for (const scheduledDate of slot.scheduledDates) {
      const weekday = new Date(`${scheduledDate}T00:00:00Z`).getUTCDay() || 7;
      if (scheduledDate < input.academicPeriod.startsOn || scheduledDate > input.academicPeriod.endsOn || weekday !== slot.dayOfWeek) ctx.addIssue({ code: "custom", path: ["slots", index, "scheduledDates"], message: "Scheduled date must be in the period and match the timetable day." });
    }
    const expectedDates = occurrenceDates(input.timetableEffectiveFrom, input.academicPeriod.endsOn, slot.dayOfWeek);
    if (slot.scheduledDates.length && (slot.scheduledDates.length !== expectedDates.length || slot.scheduledDates.some((value, dateIndex) => value !== expectedDates[dateIndex]))) ctx.addIssue({ code: "custom", path: ["slots", index, "scheduledDates"], message: "Supplied occurrence dates must match every weekly slot date through the academic period." });
    if (input.slots.some((other, otherIndex) => otherIndex < index && other.dayOfWeek === slot.dayOfWeek && other.startsAt < slot.endsAt && slot.startsAt < other.endsAt)) ctx.addIssue({ code: "custom", path: ["slots", index], message: "Teacher timetable slots overlap." });
  });
});

export type OneTeacherPilotInput = z.input<typeof oneTeacherPilotInput>;

/** A deterministic, read-only preparation plan. Application actions must enforce Auth, RLS and release eligibility when applying it. */
export function prepareOneTeacherPilot(input: OneTeacherPilotInput) {
  const value = oneTeacherPilotInput.parse(input);
  const sections = value.sections.map((section, index) => ({
    ...section,
    schoolSubjectKey: `${section.classLevel === "S5" || section.classLevel === "S6" ? "ADVANCED" : "LOWER"}_${section.subject}`,
    key: [value.schoolSlug, value.academicPeriod.academicYear, value.academicPeriod.name, value.existingAuthUserId, section.subject, section.classLevel, section.stream.toLowerCase()].join("|"),
    assignmentState: "PROPOSED" as const,
    curriculumPositionState: "AWAITING_TEACHER_CONFIRMATION" as const,
    index,
  }));
  return {
    school: { name: value.schoolName, slug: value.schoolSlug, timezone: value.schoolTimezone, createIfMissing: value.createSchoolIfMissing },
    teacher: { name: value.teacherName, email: value.teacherEmail, existingAuthUserId: value.existingAuthUserId, role: "TEACHER" as const },
    academicPeriod: value.academicPeriod,
    classLevels: [...new Set(sections.map((section) => section.classLevel))],
    streams: [...new Map(sections.map((section) => [[section.classLevel, section.stream.toLowerCase()].join("|"), { classLevel: section.classLevel, name: section.stream }])).values()],
    subjects: [...new Map(sections.map((section) => [section.schoolSubjectKey,
      { key: section.schoolSubjectKey, subject: section.subject, educationLevel: section.classLevel === "S5" || section.classLevel === "S6" ? "advanced-secondary" as const : "lower-secondary" as const }])).values()],
    sections,
    timetable: { name: "ONE-TEACHER CONTROLLED PILOT TIMETABLE", scope: "ONLY_THIS_TEACHER" as const, effectiveFrom: value.timetableEffectiveFrom, versionNumber: value.timetableVersionNumber, slots: value.slots.map((slot) => ({ ...slot, sectionKey: sections[slot.sectionIndex].key })) },
    curriculumBindings: [] as string[],
    scheduledLessons: value.slots.flatMap((slot) => occurrenceDates(value.timetableEffectiveFrom, value.academicPeriod.endsOn, slot.dayOfWeek).map((scheduledDate) => ({ sectionKey: sections[slot.sectionIndex].key, scheduledDate, startsAt: slot.startsAt, endsAt: slot.endsAt, status: "SCHEDULED" as const }))),
  };
}
