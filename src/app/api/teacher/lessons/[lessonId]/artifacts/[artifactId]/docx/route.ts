import { renderLessonArtifactDocx } from "@/docx/artifact-documents";
import { resolveLessonArtifactExport } from "@/teacher/application/export-actions";

export async function GET(_request: Request, { params }: { params: Promise<{ lessonId: string; artifactId: string }> }) {
  const { lessonId, artifactId } = await params;
  const result = await resolveLessonArtifactExport(lessonId, artifactId);
  if (!result.ok) return new Response("This artifact is not available for export.", { status: 403 });
  const { data, artifact, canonical } = result;
  const docx = await renderLessonArtifactDocx({ artifact: canonical, schoolName: data.schoolName, lessonMeta: `${data.lesson.section.subjectName} · ${data.lesson.section.classLevelName} ${data.lesson.section.streamName} · ${data.lesson.scheduledDate}` });
  return new Response(new Uint8Array(docx), { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "Content-Disposition": `attachment; filename="${artifact.artifactType.toLowerCase()}-${lessonId}.docx"` } });
}
