import { AppShell } from "@/components/foundation/AppShell";
import { TeachingSectionWorkspace } from "@/components/teacher/TeachingSectionWorkspace";
import { loadTeachingSectionData } from "@/teacher/application/queries";
export default async function TeachingSectionPage({ params }: { params: Promise<{ sectionId: string }> }) { const { sectionId } = await params; const data = await loadTeachingSectionData(sectionId); return <AppShell access={data.access}><TeachingSectionWorkspace data={data} /></AppShell>; }
