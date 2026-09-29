import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { describe, expect, it } from "vitest";
import type { CanonicalArtifactVersion } from "@/artifacts/types";
import { LessonArtifactDocument } from "./lesson-artifacts";

const artifact: Exclude<CanonicalArtifactVersion, { artifactType: "ASSESSMENT" }> = {
  artifactId: "saved", versionId: "version", artifactType: "HOMEWORK", status: "DRAFT",
  ownerScope: "section", curriculumAnchorIds: [], provenance: [],
  payload: { title: "Transport in Plants – Homework", instructions: "Complete the tasks.", tasks: ["Draw and label xylem tissue.", "Explain water movement from roots to leaves."], followUpNotes: "Bring your work to the next lesson." },
};

describe("lesson artifact PDF", () => {
  it("renders a saved homework artifact as PDF", async () => {
    const pdf = await renderToBuffer(React.createElement(LessonArtifactDocument, { artifact, schoolName: "ATE Preview Demo School", lessonMeta: "Biology · Senior 1 East · 2026-10-05" }) as unknown as Parameters<typeof renderToBuffer>[0]);
    expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
    expect(pdf.byteLength).toBeGreaterThan(100);
  });
});
