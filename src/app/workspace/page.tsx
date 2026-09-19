import { AppShell } from "@/components/foundation/AppShell";
import { loadTeacherHomeData } from "@/teacher/application/queries";
import { TeacherHome } from "@/components/teacher/TeacherHome";
export default async function WorkspacePage() { const data = await loadTeacherHomeData(); return <AppShell activePath="/workspace" access={data.access}><TeacherHome data={data} /></AppShell>; }
