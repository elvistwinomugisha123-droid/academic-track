import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/foundation/AppShell";
import { ArtifactDocument } from "@/components/teacher/ArtifactDocument";
import { lessonArtifactRenderModel } from "@/artifacts/lesson-render";
import { assertCanonicalArtifactVersion } from "@/artifacts/types";
import { loadLessonReadinessData } from "@/teacher/application/queries";

export default async function SavedLessonDocument({ params }: { params: Promise<{ lessonId: string; artifactId: string }> }) {
  const { lessonId, artifactId } = await params;
  const data = await loadLessonReadinessData(lessonId);
  const artifact = data.artifacts.find((item) => item.id === artifactId && item.currentContent);
  if (!artifact) notFound();
  const canonical = assertCanonicalArtifactVersion({ artifactId: artifact.id, versionId: artifact.currentVersionId || "current", artifactType: artifact.artifactType, status: artifact.status === "FINAL" ? "FINAL" : "DRAFT", ownerScope: data.lesson.section.id, curriculumAnchorIds: artifact.curriculumCanonicalId ? [artifact.curriculumCanonicalId] : [], curriculumProfileId: artifact.curriculumProfileId || undefined, rightsState: artifact.rightsState, provenance: artifact.provenance, payload: artifact.currentContent });
  if (canonical.artifactType === "ASSESSMENT") notFound();
  const tab = artifact.artifactType === "FORMAL_LESSON_PLAN" ? "plan" : "pack";
  return <AppShell access={data.access} contextLessonId={lessonId}><main className="teacher-page saved-document-page"><div className="saved-document-toolbar"><Link href={`/workspace/teacher/lessons/${lessonId}?tab=${tab}`}>← Back to lesson</Link><span>Saved version {artifact.currentVersionNumber}</span></div><ArtifactDocument model={lessonArtifactRenderModel(canonical)} /><div className="saved-document-actions"><Link className="button button-primary" href={`/workspace/teacher/lessons/${lessonId}?tab=${tab}&edit=${artifact.id}`}>Edit this document</Link><a className="button" href={`/api/teacher/lessons/${lessonId}/artifacts/${artifact.id}/pdf`} target="_blank" rel="noreferrer">PDF</a><a className="button" href={`/api/teacher/lessons/${lessonId}/artifacts/${artifact.id}/docx`}>DOCX</a></div></main></AppShell>;
}
