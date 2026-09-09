import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { assessmentItemSchema, curriculumItemSchema, relationshipSchema, sourceMetadataSchema } from ".";

const corpusRoot = path.resolve(process.cwd(), "knowledge-sources", "derived");
const sourceSpans = path.join(corpusRoot, "source-spans", "source-spans.jsonl");
const curriculumItems = path.join(corpusRoot, "structured", "curriculum-items.jsonl");
const assessmentItems = path.join(corpusRoot, "structured", "assessment-items.jsonl");
const relationships = path.join(corpusRoot, "structured", "curriculum-relationships.jsonl");
const corpusAvailable = [sourceSpans, curriculumItems, assessmentItems, relationships].every(existsSync);

function readJsonLines(filePath: string): unknown[] {
  return readFileSync(filePath, "utf8").split("\n").filter(Boolean).map((line) => JSON.parse(line));
}

describe.skipIf(!corpusAvailable)("generated ATE knowledge corpus", () => {
  it("conforms to the canonical Zod contracts", () => {
    const spans = readJsonLines(sourceSpans) as Array<{ source: unknown }>;
    const curriculum = readJsonLines(curriculumItems);
    const assessment = readJsonLines(assessmentItems);
    const links = readJsonLines(relationships);

    expect(spans).not.toHaveLength(0);
    expect(curriculum).not.toHaveLength(0);
    expect(assessment).not.toHaveLength(0);
    expect(links).toHaveLength(curriculum.length + assessment.length);
    spans.forEach((span) => sourceMetadataSchema.parse(span.source));
    curriculum.forEach((item) => curriculumItemSchema.parse(item));
    assessment.forEach((item) => assessmentItemSchema.parse(item));
    links.forEach((link) => relationshipSchema.parse(link));
  });
});
