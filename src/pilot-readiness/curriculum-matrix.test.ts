import { describe, expect, it } from "vitest";
import { buildCurriculumReadinessMatrix, renderCurriculumReadinessMarkdown, type MatrixSqlClient } from "./curriculum-matrix";

const positiveDatabase: MatrixSqlClient = {
  async query<Row extends Record<string, unknown>>() {
    return { rows: [{ release_published: true, binding_valid: true, runtime_resolvable: true, lesson_generation_test: true, teaching_pack_test: true, ask_ate_context_test: true, assessment_profile: true } as unknown as Row] };
  },
};

describe("curriculum readiness matrix", () => {
  it("reports the complete carried-forward source catalogue without fabricating unavailable sources", async () => {
    const matrix = await buildCurriculumReadinessMatrix({ now: new Date("2026-10-03T00:00:00Z") });
    expect(matrix.rows).toHaveLength(30);
    expect(matrix.sourceRegistry.status).toBe("ABSENT_BY_DESIGN");
    expect(matrix.summary.READY).toBe(0);
    expect(matrix.summary["BLOCKED_BY_EXTERNAL_SOURCE/ACTION"]).toBe(30);
    const biology = matrix.rows.find((row) => row.subject === "Biology" && row.educationLevel === "lower-secondary");
    expect(biology).toMatchObject({ sourceIdentified: { status: "PASS" }, extracted: { status: "PASS" }, structurallyValidated: { status: "PASS" }, provenancePresent: { status: "PASS" }, rightsStateKnown: { status: "BLOCKED" }, releasePublished: { status: "BLOCKED" } });
    const advancedPhysics = matrix.rows.find((row) => row.subject === "Physics" && row.educationLevel === "advanced-secondary");
    expect(advancedPhysics?.sourceIdentified).toMatchObject({ status: "BLOCKED" });
  });

  it("uses database evidence without allowing uncleared source rights to become READY", async () => {
    const matrix = await buildCurriculumReadinessMatrix({ database: positiveDatabase, now: new Date("2026-10-03T00:00:00Z") });
    const biology = matrix.rows.find((row) => row.subject === "Biology" && row.educationLevel === "lower-secondary");
    expect(biology?.releasePublished.status).toBe("PASS");
    expect(biology?.lessonGenerationTest.status).toBe("PASS");
    expect(biology?.overallStatus).toBe("BLOCKED_BY_EXTERNAL_SOURCE/ACTION");
  });

  it("renders an auditable Markdown view", async () => {
    const markdown = renderCurriculumReadinessMarkdown(await buildCurriculumReadinessMatrix({ now: new Date("2026-10-03T00:00:00Z") }));
    expect(markdown).toContain("# Curriculum readiness matrix");
    expect(markdown).toContain("ABSENT_BY_DESIGN");
    expect(markdown).toContain("Lower Secondary Biology workbench");
  });
});
