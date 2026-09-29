import { detectTimetableOverlaps } from "@/academic-operations/validation/invariants";

export type ImportedTimetableRow = { rowNumber: number; day: string; startsAt: string; endsAt: string; subject: string; classLevel: string; stream: string; teacher: string; room: string };
export type ImportSection = { id: string; subject: string; classLevel: string; stream: string; teacher: string; teacherMembershipId: string; classLevelId: string; streamId: string; confirmed: boolean; active: boolean };
export type ReconciledTimetableRow = ImportedTimetableRow & { sectionId?: string; errors: string[] };

const headings = ["day", "start time", "end time", "subject", "class/level", "stream", "teacher", "room"] as const;
const dayNumbers: Record<string, number> = { monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6, sunday: 7 };
const normalise = (value: string) => value.trim().replace(/\s+/g, " ").toLocaleLowerCase();

function parseCsvLine(line: string): string[] {
  const values: string[] = []; let value = ""; let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"' && quoted && line[index + 1] === '"') { value += '"'; index += 1; }
    else if (character === '"') quoted = !quoted;
    else if (character === "," && !quoted) { values.push(value.trim()); value = ""; }
    else value += character;
  }
  if (quoted) throw new Error("The CSV has an unclosed quoted value.");
  values.push(value.trim());
  return values;
}

export function parseTimetableCsv(source: string): ImportedTimetableRow[] {
  const lines = source.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) throw new Error("The timetable CSV needs a header row and at least one timetable row.");
  const header = parseCsvLine(lines[0]).map(normalise);
  const indexes = headings.map((heading) => header.indexOf(heading));
  const required = [0, 1, 2, 3, 4, 5, 6];
  if (required.some((index) => indexes[index] === -1)) throw new Error("Use these CSV headings: Day, Start Time, End Time, Subject, Class/Level, Stream, Teacher, Room.");
  return lines.slice(1).map((line, index) => {
    const cells = parseCsvLine(line);
    const at = (heading: typeof headings[number]) => cells[indexes[headings.indexOf(heading)]] || "";
    return { rowNumber: index + 2, day: at("day"), startsAt: at("start time"), endsAt: at("end time"), subject: at("subject"), classLevel: at("class/level"), stream: at("stream"), teacher: at("teacher"), room: at("room") };
  });
}

export function reconcileTimetableRows(rows: ImportedTimetableRow[], sections: ImportSection[]): ReconciledTimetableRow[] {
  const resolved = rows.map((row) => {
    const errors: string[] = [];
    const day = dayNumbers[normalise(row.day)];
    if (!day) errors.push("Day must be Monday through Sunday.");
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(row.startsAt) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(row.endsAt) || row.startsAt >= row.endsAt) errors.push("Use valid 24-hour start and end times.");
    const matches = sections.filter((section) => [section.subject, section.classLevel, section.stream, section.teacher].every((value, index) => normalise(value) === normalise([row.subject, row.classLevel, row.stream, row.teacher][index])));
    if (matches.length !== 1) errors.push(matches.length ? "More than one Teaching Section matches this row." : "No confirmed Teaching Section matches subject, class, stream and teacher.");
    else if (!matches[0].confirmed || !matches[0].active) errors.push("The matched Teaching Section is not confirmed and active.");
    return { ...row, sectionId: matches[0]?.id, errors };
  });
  const validSlots = resolved.filter((row) => !row.errors.length && row.sectionId).map((row) => {
    const section = sections.find((item) => item.id === row.sectionId)!;
    return { id: String(row.rowNumber), teacherMembershipId: section.teacherMembershipId, classLevelId: section.classLevelId, streamId: section.streamId, dayOfWeek: dayNumbers[normalise(row.day)], startsAt: row.startsAt, endsAt: row.endsAt };
  });
  for (const overlap of detectTimetableOverlaps(validSlots)) for (const row of resolved) if (String(row.rowNumber) === overlap.leftSlotId || String(row.rowNumber) === overlap.rightSlotId) row.errors.push(`${overlap.reason === "TEACHER" ? "Teacher" : "Class/stream"} overlaps another imported row.`);
  return resolved;
}

export function timetableDayNumber(day: string) { return dayNumbers[normalise(day)] || 0; }
