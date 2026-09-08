import type { AppState, TeachingSection } from "@/domain/types";
const people = [
  { id: "person-teacher", displayName: "Ms. Sarah Auma", roles: ["TEACHER" as const], departmentIds: ["biology"] },
  { id: "person-hod", displayName: "Mr. Daniel Okello", roles: ["HOD" as const], departmentIds: ["biology"] },
  { id: "person-dos", displayName: "Mrs. Grace Nansubuga", roles: ["DOS" as const], departmentIds: ["school"] },
  { id: "person-principal", displayName: "Mr. Peter Kato", roles: ["PRINCIPAL" as const], departmentIds: ["school"] }
];
const streams = [{ id: "east", name: "East" }, { id: "west", name: "West" }, { id: "north", name: "North" }];
const levels = [{ id: "s1", name: "Senior 1" }, { id: "s2", name: "Senior 2" }];
const section = (levelId: string, streamId: string, index: number, topicId: string): TeachingSection => ({ id: `${levelId}-${streamId}-biology`, teacherId: "person-teacher", subjectName: "Biology", levelId, streamId, termId: "term-1", topicId, scheduledEntryIds: [`entry-${index}`], confirmedOutcomeIds: [], currentOutcomeStatus: "UNCONFIRMED", unfinishedWorkIds: [], constraints: streamId === "east" ? ["Four microscopes available"] : [] });
const sections = [section("s1", "east", 1, "bio-s1-t1-1.1"), section("s1", "west", 2, "bio-s1-t1-1.1"), section("s1", "north", 3, "bio-s1-t1-1.1"), section("s2", "east", 4, "bio-s2-t2-3.2"), section("s2", "west", 5, "bio-s2-t2-3.2"), section("s2", "north", 6, "bio-s2-t2-3.2")];
const timetable = sections.map((s, i) => ({ id: `entry-${i + 1}`, day: i % 2 === 0 ? "Monday" : "Tuesday", period: (i % 4) + 1, startsAt: `${8 + (i % 4)}:00`, endsAt: `${9 + (i % 4)}:00`, sectionId: s.id, room: `Lab ${i % 2 + 1}`, verificationStatus: "CONFIRMED" as const, confidence: 1 }));
const lessons = sections.map((s, i) => ({ id: `lesson-${i + 1}`, sectionId: s.id, timetableEntryId: timetable[i].id, date: "2026-09-08", status: i === 0 ? "DUE" as const : "SCHEDULED" as const, topicId: s.topicId, segmentIds: ["segment-context", "segment-activity", "segment-check"] }));
export const seedState: AppState = { school: { id: "mount-olives", name: "Mount of Olives College", location: "Kakiri" }, term: { id: "term-1", name: "Term 1", academicYear: 2026 }, people, levels, streams, timetable, sections, lessons, outcomes: [], unfinished: [], recovery: [], exceptions: [], resources: [
  { id: "resource-1", title: "Observe local leaves and compare features", type: "CURRICULUM_ACTIVITY", provenance: "CURRICULUM", state: "DISCOVERED", detail: "Suggested activity in the supplied Biology curriculum context." },
  { id: "resource-2", title: "School biology microscope set", type: "SCHOOL_RESOURCE", provenance: "SCHOOL", state: "SCHOOL_RECOMMENDED", detail: "Configured school resource; availability should be checked before use." },
  { id: "resource-3", title: "Low-equipment observation station", type: "ATE_ADAPTATION", provenance: "ATE", state: "DISCOVERED", detail: "Fixture adaptation for large classes and limited equipment." }
], assessments: [] };
