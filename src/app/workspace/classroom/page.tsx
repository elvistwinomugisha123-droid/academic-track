import { AppShell } from "@/components/foundation/AppShell";
import { ClassroomContinuityWorkspace } from "@/components/classroom-continuity/ClassroomContinuityWorkspace";
import { loadClassroomContinuityData } from "@/classroom-continuity/application/queries";

export default async function ClassroomPage() {
  const data = await loadClassroomContinuityData();
  return <AppShell activePath="/workspace/classroom" access={data.access}><ClassroomContinuityWorkspace data={data} /></AppShell>;
}
