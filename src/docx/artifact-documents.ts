import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun,
} from "docx";
import { lessonArtifactRenderModel } from "@/artifacts/lesson-render";
import type { CanonicalArtifactVersion } from "@/artifacts/types";

type LessonArtifact = Exclude<CanonicalArtifactVersion, { artifactType: "ASSESSMENT" }>;
type AssessmentArtifact = Extract<CanonicalArtifactVersion, { artifactType: "ASSESSMENT" }>;
type AssessmentMeta = { schoolName?: string; subject?: string; classLabel?: string; date?: string };

const heading = (text: string) => new Paragraph({ text, heading: HeadingLevel.HEADING_2, spacing: { before: 240, after: 100 } });
const body = (text: string) => new Paragraph({ text, spacing: { after: 100 }, widowControl: true });
const bullet = (text: string) => new Paragraph({ text, bullet: { level: 0 }, spacing: { after: 70 } });
const title = (text: string) => new Paragraph({ text, heading: HeadingLevel.TITLE, alignment: AlignmentType.CENTER, spacing: { after: 160 } });
const meta = (text: string) => new Paragraph({ children: [new TextRun({ text, color: "607084", size: 19 })], alignment: AlignmentType.CENTER, spacing: { after: 240 } });

function provenance(artifact: CanonicalArtifactVersion) {
  if (artifact.provenance.length === 0) return [];
  return [
    heading("Source context"),
    ...artifact.provenance.map((item) => bullet([item.label, item.sourceLocation].filter(Boolean).join(" · "))),
  ];
}

function documentWith(children: Paragraph[], description: string) {
  return new Document({
    creator: "Academic Track Engine",
    title: description,
    description,
    sections: [{ properties: {}, children }],
  });
}

export async function renderLessonArtifactDocx(input: { artifact: LessonArtifact; schoolName: string; lessonMeta: string }) {
  const model = lessonArtifactRenderModel(input.artifact);
  const children: Paragraph[] = [title(model.title), meta(`${input.schoolName} · ${input.lessonMeta} · Saved version ${input.artifact.versionId}`)];
  for (const section of model.sections) {
    children.push(heading(section.heading));
    for (const value of section.paragraphs ?? []) children.push(body(value));
    for (const value of section.items ?? []) children.push(bullet(value));
    for (const [index, step] of (section.sequence ?? []).entries()) {
      children.push(new Paragraph({ children: [new TextRun({ text: `${index + 1}. ${step.label} · ${step.minutes} minutes`, bold: true })], spacing: { before: 100, after: 70 } }));
      children.push(body(`Teacher: ${step.teacherActivity}`), body(`Learners: ${step.learnerActivity}`));
      for (const prompt of step.prompts) children.push(bullet(prompt));
      if (step.formativeCheck) children.push(body(`Check: ${step.formativeCheck}`));
    }
  }
  children.push(...provenance(input.artifact));
  return Packer.toBuffer(documentWith(children, model.title));
}

function assessmentPayload(artifact: AssessmentArtifact) { return artifact.payload; }

export async function renderAssessmentDocx(input: { artifact: AssessmentArtifact; meta: AssessmentMeta; kind: "question-paper" | "marking-guide" }) {
  const assessment = assessmentPayload(input.artifact);
  const guide = input.kind === "marking-guide";
  const documentTitle = guide ? `${assessment.title} · Marking Guide` : assessment.title;
  const identity = [input.meta.schoolName, input.meta.subject, input.meta.classLabel, input.meta.date].filter(Boolean).join(" · ");
  const children: Paragraph[] = [title(documentTitle), meta(`${identity}${identity ? " · " : ""}${assessment.durationMinutes} minutes · ${assessment.totalMarks} marks`)];
  if (!guide && "instructions" in assessment && assessment.instructions.length > 0) {
    children.push(heading("Candidate instructions"));
    for (const instruction of assessment.instructions) children.push(bullet(instruction));
  }
  for (const [index, question] of assessment.questions.entries()) {
    children.push(new Paragraph({ children: [new TextRun({ text: `${index + 1}. ${question.text} (${question.marks} marks)`, bold: guide })], spacing: { before: 180, after: 100 }, keepNext: guide }));
    if (guide) for (const point of question.markingGuide) children.push(bullet(point));
  }
  children.push(...provenance(input.artifact));
  children.push(meta(guide ? "Teacher marking instrument · ATE does not mark learner scripts" : `Prepared in ATE Assessment Studio · ${input.artifact.status === "FINAL" ? "Final version" : "Teacher-review required"}`));
  return Packer.toBuffer(documentWith(children, documentTitle));
}
