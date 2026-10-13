import { AppShell } from "@/components/foundation/AppShell";
import { loadTeacherHomeData } from "@/teacher/application/queries";
import { TeacherHome } from "@/components/teacher/TeacherHome";
import { redirect } from "next/navigation";

export default async function WorkspacePage() {
  const data = await loadTeacherHomeData();
  if (!data.access.roles.includes("TEACHER")) {
    if (data.access.roles.includes("SCHOOL_ADMIN")) redirect("/workspace/academic-operations");
    if (data.access.roles.includes("DOS")) redirect("/workspace/leadership/dos");
    if (data.access.roles.includes("HOD")) redirect("/workspace/leadership/hod");
    if (data.access.roles.includes("PRINCIPAL")) redirect("/workspace/leadership/principal");
  }
  return <AppShell activePath="/workspace" access={data.access}><TeacherHome data={data} /></AppShell>;
}
