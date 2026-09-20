import Link from "next/link";
import { assertCanonicalArtifactVersion } from "@/artifacts/types";
import { loadLessonReadinessData } from "@/teacher/application/queries";

export default async function LessonArtifactPrintPage({ params, searchParams }: { params: Promise<{ lessonId: string }>; searchParams: Promise<{ artifactId?: string }> }) {
  const { lessonId } = await params; const { artifactId } = await searchParams; const data = await loadLessonReadinessData(lessonId); const artifact = data.artifacts.find((item) => item.id === artifactId);
  if (!artifact?.currentContent) return <main className="print-page"><p>Saved artifact not found.</p></main>;
  const canonical = assertCanonicalArtifactVersion({ artifactId: artifact.id, versionId: artifact.currentVersionId || "current", artifactType: artifact.artifactType, status: "DRAFT", ownerScope: data.lesson.section.id, curriculumAnchorIds: [], rightsState: artifact.rightsState, provenance: artifact.provenance, payload: artifact.currentContent });
  const payload = canonical.payload;
  return <main className="print-page"><header><p>{data.schoolName}</p><h1>{payload.title}</h1><span>{data.lesson.section.subjectName} · {data.lesson.section.classLevelName} {data.lesson.section.streamName} · {data.lesson.scheduledDate}</span></header><section className="print-content"><pre>{JSON.stringify(payload, null, 2)}</pre></section><footer><Link href={`/workspace/teacher/lessons/${lessonId}`}>Return to lesson</Link><button type="button" onClick={() => window.print()}>Print this page</button></footer></main>;
}
