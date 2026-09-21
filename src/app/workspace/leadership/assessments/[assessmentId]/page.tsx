import { AppShell } from "@/components/foundation/AppShell";
import { AssessmentReviewWorkspace } from "@/components/leadership/AssessmentReviewWorkspace";
import { loadAssessmentReviewWorkspace } from "@/leadership/application/queries";

export default async function LeadershipAssessmentReviewPage({ params }: { params: Promise<{ assessmentId: string }> }) {
  const { assessmentId } = await params;
  const data = await loadAssessmentReviewWorkspace(assessmentId);
  return <AppShell activePath="/workspace/leadership/dos" access={data.access}><AssessmentReviewWorkspace data={data} /></AppShell>;
}
