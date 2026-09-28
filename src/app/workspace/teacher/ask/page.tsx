import { AppShell } from "@/components/foundation/AppShell";
import { AskATEWorkspace } from "@/components/teacher/AskATEWorkspace";
import { loadTeacherHomeData } from "@/teacher/application/queries";
import { loadLessonReadinessData } from "@/teacher/application/queries";

export default async function AskATEPage({ searchParams }: { searchParams: Promise<{ lessonId?: string }> }) {
  const data = await loadTeacherHomeData();
  const { lessonId } = await searchParams;
  const selected = lessonId ? await loadLessonReadinessData(lessonId) : null;
  return <AppShell activePath="/workspace/teacher/ask" access={data.access} contextLessonId={selected?.lesson.id}><AskATEWorkspace lesson={selected?.lesson || data.nextLesson} /></AppShell>;
}
