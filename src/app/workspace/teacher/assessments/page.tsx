import { AppShell } from "@/components/foundation/AppShell";
import { loadAssessmentStudioList } from "@/assessment/application/queries";
import { AssessmentStudioList } from "@/components/assessment/AssessmentStudioList";

export default async function AssessmentStudioPage() {
  const data = await loadAssessmentStudioList("/workspace/teacher/assessments");
  return <AppShell access={data.access}><AssessmentStudioList data={data} /></AppShell>;
}
