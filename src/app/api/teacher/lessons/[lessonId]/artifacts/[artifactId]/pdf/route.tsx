import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { assertCanonicalArtifactVersion } from "@/artifacts/types";
import { loadLessonReadinessData } from "@/teacher/application/queries";
import { LessonArtifactDocument } from "@/pdf/lesson-artifacts";

export async function GET(_request: Request, { params }: { params: Promise<{ lessonId: string; artifactId: string }> }) {
  const { lessonId, artifactId } = await params;
  const data = await loadLessonReadinessData(lessonId);
  const artifact = data.artifacts.find((item) => item.id === artifactId);
  if (!artifact?.currentContent || artifact.rightsState === "RESTRICTED") return new Response("This saved artifact is not available for export.", { status: 403 });
  const canonical = assertCanonicalArtifactVersion({ artifactId: artifact.id, versionId: artifact.currentVersionId || "current", artifactType: artifact.artifactType, status: artifact.status === "FINAL" ? "FINAL" : "DRAFT", ownerScope: data.lesson.section.id, curriculumAnchorIds: [], rightsState: artifact.rightsState, provenance: artifact.provenance, payload: artifact.currentContent });
  if (canonical.artifactType === "ASSESSMENT") return new Response("Assessment export is handled by Assessment Studio.", { status: 400 });
  const pdf = await renderToBuffer(<LessonArtifactDocument artifact={canonical} schoolName={data.schoolName} lessonMeta={`${data.lesson.section.subjectName} · ${data.lesson.section.classLevelName} ${data.lesson.section.streamName}`} />);
  return new Response(pdf as unknown as BodyInit, { headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${artifact.artifactType.toLowerCase()}-${lessonId}.pdf"` } });
}
