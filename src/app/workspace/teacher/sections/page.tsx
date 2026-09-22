import { redirect } from "next/navigation";
import { AppShell } from "@/components/foundation/AppShell";
import { loadTeacherHomeData } from "@/teacher/application/queries";
export default async function TeacherSectionsPage() { const data = await loadTeacherHomeData("/workspace/teacher/sections"); const sectionId = data.nextLesson?.section.id; if (sectionId) redirect(`/workspace/teacher/sections/${sectionId}`); return <AppShell access={data.access}><div className="teacher-empty"><p>No assigned Teaching Sections are available.</p></div></AppShell>; }
