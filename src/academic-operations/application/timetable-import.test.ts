import { describe, expect, it } from "vitest";
import { parseTimetableCsv, reconcileTimetableRows } from "./timetable-import";

const section = { id: "section-1", subject: "Physics", classLevel: "Senior 1", stream: "East", teacher: "Amina", teacherMembershipId: "teacher-1", classLevelId: "level-1", streamId: "stream-1", confirmed: true, active: true };

describe("timetable CSV import", () => {
  it("parses quoted values and reconciles a matched row", () => {
    const rows = parseTimetableCsv('Day,Start Time,End Time,Subject,Class/Level,Stream,Teacher,Room\nMonday,08:00,09:00,Physics,Senior 1,East,Amina,"Lab, 2"');
    expect(reconcileTimetableRows(rows, [section])).toEqual([expect.objectContaining({ sectionId: "section-1", room: "Lab, 2", errors: [] })]);
  });
  it("blocks missing sections and timetable overlap", () => {
    const rows = parseTimetableCsv("Day,Start Time,End Time,Subject,Class/Level,Stream,Teacher,Room\nMonday,08:00,09:00,Physics,Senior 1,East,Amina,1\nMonday,08:30,09:30,Physics,Senior 1,East,Amina,1\nTuesday,08:00,09:00,Chemistry,Senior 1,East,Amina,1");
    const result = reconcileTimetableRows(rows, [section]);
    expect(result[0].errors).toContain("Teacher overlaps another imported row.");
    expect(result[1].errors).toContain("Teacher overlaps another imported row.");
    expect(result[2].errors[0]).toContain("No confirmed Teaching Section");
  });
});
