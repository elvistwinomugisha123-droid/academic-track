import { AteApp } from "@/components/AteApp";
import type { Role } from "@/domain/types";

const views = new Set(["home", "lesson", "outcome", "assessment", "resources", "hod", "dos", "principal", "timetable", "design"]);
const roles = new Set<Role>(["TEACHER", "HOD", "DOS", "PRINCIPAL"]);

export default async function Page({ searchParams }: { searchParams: Promise<{ view?: string; role?: string; reset?: string }> }) {
  const params = await searchParams;
  const view = params.view && views.has(params.view) ? params.view as Parameters<typeof AteApp>[0]["initialView"] : "home";
  const role = params.role && roles.has(params.role as Role) ? params.role as Role : "TEACHER";
  return <AteApp initialView={view} initialRole={role} resetOnLoad={params.reset === "1"} />;
}
