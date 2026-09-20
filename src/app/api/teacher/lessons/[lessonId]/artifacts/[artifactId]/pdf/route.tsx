import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { resolveLessonArtifactExport } from "@/teacher/application/export-actions";
import { LessonArtifactDocument } from "@/pdf/lesson-artifacts";

export async function GET(_request: Request, { params }: { params: Promise<{ lessonId: string; artifactId: string }> }) {
  const { lessonId, artifactId } = await params;
  const result = await resolveLessonArtifactExport(lessonId, artifactId);
  if (!result.ok) return new Response(result.error, { status: result.error.includes("Assessment") ? 400 : 403 });
  const { data, artifact, canonical } = result;
  const pdf = await renderToBuffer(<LessonArtifactDocument artifact={canonical} schoolName={data.schoolName} lessonMeta={`${data.lesson.section.subjectName} · ${data.lesson.section.classLevelName} ${data.lesson.section.streamName} · ${data.lesson.scheduledDate}`} />);
  return new Response(pdf as unknown as BodyInit, { headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${artifact.artifactType.toLowerCase()}-${lessonId}.pdf"` } });
}
