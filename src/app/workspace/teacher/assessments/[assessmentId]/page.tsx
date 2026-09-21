import { AppShell } from "@/components/foundation/AppShell";
import { loadAssessmentWorkspace } from "@/assessment/application/queries";
import { AssessmentWorkspace } from "@/components/assessment/AssessmentWorkspace";

export default async function AssessmentWorkspacePage({ params }: { params: Promise<{ assessmentId: string }> }) {
  const { assessmentId } = await params;
  const data = await loadAssessmentWorkspace(assessmentId);
  return <AppShell access={data.access}><AssessmentWorkspace data={data} /></AppShell>;
}
