import { AppShell } from "@/components/foundation/AppShell";
import { LessonReadinessWorkspace } from "@/components/teacher/LessonReadinessWorkspace";
import { loadLessonReadinessData } from "@/teacher/application/queries";
export default async function LessonReadinessPage({ params, searchParams }: { params: Promise<{ lessonId: string }>; searchParams: Promise<{ tab?: string; edit?: string }> }) { const { lessonId } = await params; const data = await loadLessonReadinessData(lessonId); const query = await searchParams; const initialTab = query.tab === "pack" || query.tab === "readiness" ? query.tab : "plan"; return <AppShell access={data.access} contextLessonId={lessonId}><LessonReadinessWorkspace data={data} initialTab={initialTab} editArtifactId={query.edit} /></AppShell>; }
