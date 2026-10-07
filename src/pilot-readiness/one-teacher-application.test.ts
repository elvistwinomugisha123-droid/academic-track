import { describe, expect, it, vi } from "vitest";
import { applyOneTeacherPilot, activateOneTeacherPilotTimetable } from "./one-teacher-application";
import type { OneTeacherPilotInput } from "./one-teacher-bootstrap";

const input: OneTeacherPilotInput = {
  schoolName: "Fixture School", schoolSlug: "fixture-school", schoolTimezone: "Africa/Kampala",
  teacherName: "Fixture Teacher", teacherEmail: "teacher@example.test",
  existingAuthUserId: "5dd23aa1-48ce-47c8-a741-67bd6156ade5",
  academicPeriod: { name: "Term 3", periodType: "TERM", academicYear: 2026,
    startsOn: "2026-09-01", endsOn: "2026-09-14" },
  timetableEffectiveFrom: "2026-09-01", timetableVersionNumber: 1,
  sections: [
    { subject: "MATHEMATICS", classLevel: "S3", stream: "East" },
    { subject: "MATHEMATICS", classLevel: "S3", stream: "West" },
    { subject: "CHEMISTRY", classLevel: "S3", stream: "East" },
    { subject: "CHEMISTRY", classLevel: "S5", stream: "East" },
  ],
  slots: [{ sectionIndex: 0, dayOfWeek: 1, startsAt: "08:00", endsAt: "08:40" }],
};

describe("one-teacher controlled-pilot application", () => {
  it("sends a deterministic dry run without a write command", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { dryRun: true, schoolId: null,
      academicPeriodId: null, teacherMembershipId: null, timetableVersionId: null,
      teachingSectionIds: {}, scheduledLessonsPendingActivation: true }, error: null });
    const result = await applyOneTeacherPilot({ rpc }, input, { dryRun: true });
    expect(result.dryRun).toBe(true);
    expect(rpc).toHaveBeenCalledOnce();
    expect(rpc.mock.calls[0][0]).toBe("apply_one_teacher_controlled_pilot");
    expect(rpc.mock.calls[0][1].p_dry_run).toBe(true);
    expect(rpc.mock.calls[0][1].p_plan.sections.map((section: { key: string }) => section.key)).toHaveLength(4);
  });

  it("rejects an automatic position-confirmation field before the RPC", async () => {
    const rpc = vi.fn();
    await expect(applyOneTeacherPilot({ rpc }, { ...input,
      sections: [{ ...input.sections[0], positionConfirmed: true } as never] }, { dryRun: false })).rejects.toThrow();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("surfaces an RPC security rejection and rejects a dry-run mismatch", async () => {
    const denied = vi.fn().mockResolvedValue({ data: null, error: { message: "Auth identity missing" } });
    await expect(applyOneTeacherPilot({ rpc: denied }, input, { dryRun: false })).rejects.toThrow("Auth identity missing");
    const mismatch = vi.fn().mockResolvedValue({ data: { dryRun: false }, error: null });
    await expect(applyOneTeacherPilot({ rpc: mismatch }, input, { dryRun: true })).rejects.toThrow("mismatch");
  });

  it("uses existing DOS timetable commands only after a separate call", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: "ok", error: null });
    await activateOneTeacherPilotTimetable({ rpc }, "5dd23aa1-48ce-47c8-a741-67bd6156ade5");
    expect(rpc.mock.calls.map((call) => call[0])).toEqual(["verify_timetable_version", "activate_timetable_version"]);
    expect(rpc.mock.calls.some((call) => String(call[0]).includes("position"))).toBe(false);
  });
});
