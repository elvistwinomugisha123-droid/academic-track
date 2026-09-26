import { renderAssessmentDocx } from "@/docx/artifact-documents";
import { resolveAssessmentExport } from "@/assessment/application/export-actions";

export async function GET(request: Request, { params }: { params: Promise<{ assessmentId: string }> }) {
  const { assessmentId } = await params;
  const kind = new URL(request.url).searchParams.get("kind") === "marking-guide" ? "marking-guide" : "question-paper";
  const result = await resolveAssessmentExport(assessmentId);
  if (!result.ok) return new Response("This assessment is not available for export.", { status: 403 });
  if (result.canonical.artifactType !== "ASSESSMENT") return new Response("Unsupported artifact type.", { status: 400 });
  const docx = await renderAssessmentDocx({ artifact: result.canonical, meta: { schoolName: result.schoolName, subject: result.subjectName, classLabel: result.classLabel }, kind });
  return new Response(new Uint8Array(docx), { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "Content-Disposition": `attachment; filename="${kind}-${assessmentId}.docx"` } });
}
