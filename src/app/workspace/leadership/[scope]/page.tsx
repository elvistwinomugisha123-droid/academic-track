import { redirect } from "next/navigation";
import { AppShell } from "@/components/foundation/AppShell";
import { LeadershipWorkspace } from "@/components/leadership/LeadershipWorkspace";
import { loadLeadershipOverview, type LeadershipScope } from "@/leadership/application/queries";

const scopes = new Set<LeadershipScope>(["HOD", "DOS", "PRINCIPAL"]);

export default async function LeadershipPage({ params }: { params: Promise<{ scope: string }> }) {
  const { scope: rawScope } = await params;
  const scope = rawScope.toUpperCase() as LeadershipScope;
  if (!scopes.has(scope)) redirect("/access-denied");
  const data = await loadLeadershipOverview(scope);
  if (!data.access.roles.includes(scope)) redirect("/access-denied");
  return <AppShell activePath={`/workspace/leadership/${rawScope.toLowerCase()}`} access={data.access}><LeadershipWorkspace data={data} /></AppShell>;
}
