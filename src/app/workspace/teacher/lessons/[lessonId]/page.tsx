import { AppShell } from "@/components/foundation/AppShell";
import { LessonReadinessWorkspace } from "@/components/teacher/LessonReadinessWorkspace";
import { loadLessonReadinessData } from "@/teacher/application/queries";
export default async function LessonReadinessPage({ params }: { params: Promise<{ lessonId: string }> }) { const { lessonId } = await params; const data = await loadLessonReadinessData(lessonId); return <AppShell access={data.access}><LessonReadinessWorkspace data={data} /></AppShell>; }
