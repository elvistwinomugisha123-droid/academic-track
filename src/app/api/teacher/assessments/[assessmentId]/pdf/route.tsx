import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { MarkingGuideDocument, QuestionPaperDocument } from "@/pdf/assessment-documents";
import { resolveAssessmentExport } from "@/assessment/application/export-actions";

export async function GET(request: Request, { params }: { params: Promise<{ assessmentId: string }> }) {
  const { assessmentId } = await params;
  const kind = new URL(request.url).searchParams.get("kind") === "marking-guide" ? "marking-guide" : "question-paper";
  const result = await resolveAssessmentExport(assessmentId);
  if (!result.ok) return new Response(result.error, { status: 403 });
  const meta = { schoolName: result.schoolName, subject: undefined, classLabel: undefined };
  const pdf = await renderToBuffer(kind === "marking-guide" ? <MarkingGuideDocument artifact={result.canonical} meta={meta} /> : <QuestionPaperDocument artifact={result.canonical} meta={meta} />);
  return new Response(pdf as unknown as BodyInit, { headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${kind}-${assessmentId}.pdf"` } });
}
