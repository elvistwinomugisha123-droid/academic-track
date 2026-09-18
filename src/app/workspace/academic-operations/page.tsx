import { AppShell } from "@/components/foundation/AppShell";
import { loadAcademicOperationsData } from "@/academic-operations/application/queries";
import { AcademicOperationsWorkspace } from "@/components/academic-operations/AcademicOperationsWorkspace";

export default async function AcademicOperationsPage() {
  const data = await loadAcademicOperationsData();
  return <AppShell activePath="/workspace/academic-operations" access={data.access}><AcademicOperationsWorkspace data={data} /></AppShell>;
}
