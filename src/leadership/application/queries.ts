import "server-only";

import { requireWorkspaceAccess } from "@/lib/auth/access";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { withTransientReadRetry } from "@/lib/supabase/retry";

export type LeadershipScope = "HOD" | "DOS" | "PRINCIPAL";

export type LeadershipOverview = {
  scope: LeadershipScope;
  summary: {
    scheduledLessons: number;
    delivered: number;
    partiallyDelivered: number;
    notDelivered: number;
    changed: number;
    unconfirmed: number;
    curriculumReviewRequired: number;
    streamDrift: number;
    assessmentsInReview: number;
    programmeDisruptions: number;
  };
  attention: Array<Record<string, unknown>>;
  sections: Array<Record<string, unknown>>;
  drift: Array<Record<string, unknown>>;
  assessments: Array<Record<string, unknown>>;
  departments: Array<Record<string, unknown>>;
  programmeDisruptions: Array<Record<string, unknown>>;
};

export type LeadershipOverviewData = {
  access: Awaited<ReturnType<typeof requireWorkspaceAccess>>;
  overview: LeadershipOverview;
};

export type AssessmentReviewData = {
  access: Awaited<ReturnType<typeof requireWorkspaceAccess>>;
  workspace: {
    id: string;
    title: string;
    purpose: string;
    status: string;
    durationMinutes: number;
    totalMarks: number;
    assessmentDate: string;
    profileSnapshot: Record<string, unknown>;
    submittedAt: string | null;
    finalisedAt: string | null;
  };
  version: { id: string; versionNumber: number; content: Record<string, unknown>; createdAt: string } | null;
  sections: Array<Record<string, unknown>>;
  history: Array<Record<string, unknown>>;
};

function records(value: unknown): Array<Record<string, unknown>> { return Array.isArray(value) ? value as Array<Record<string, unknown>> : []; }
function object(value: unknown): Record<string, unknown> { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
function number(value: unknown): number { return typeof value === "number" ? value : 0; }
function string(value: unknown): string { return typeof value === "string" ? value : ""; }

async function loadLeadershipOverviewOnce(scope: LeadershipScope, nextPath = `/workspace/leadership/${scope.toLowerCase()}`): Promise<LeadershipOverviewData> {
  const access = await requireWorkspaceAccess(undefined, nextPath);
  const client = await createSupabaseServerClient();
  const result = await client.rpc("get_leadership_overview", { p_scope: scope });
  if (result.error || !result.data) throw new Error(result.error?.message || "Leadership overview could not be loaded.");
  const raw = object(result.data);
  const summary = object(raw.summary);
  return {
    access,
    overview: {
      scope,
      summary: {
        scheduledLessons: number(summary.scheduledLessons),
        delivered: number(summary.delivered),
        partiallyDelivered: number(summary.partiallyDelivered),
        notDelivered: number(summary.notDelivered),
        changed: number(summary.changed),
        unconfirmed: number(summary.unconfirmed),
        curriculumReviewRequired: number(summary.curriculumReviewRequired),
        streamDrift: number(summary.streamDrift),
        assessmentsInReview: number(summary.assessmentsInReview),
        programmeDisruptions: number(summary.programmeDisruptions),
      },
      attention: records(raw.attention),
      sections: records(raw.sections),
      drift: records(raw.drift),
      assessments: records(raw.assessments),
      departments: records(raw.departments),
      programmeDisruptions: records(raw.programmeDisruptions),
    },
  };
}

export async function loadLeadershipOverview(scope: LeadershipScope, nextPath = `/workspace/leadership/${scope.toLowerCase()}`): Promise<LeadershipOverviewData> {
  return withTransientReadRetry(() => loadLeadershipOverviewOnce(scope, nextPath), { label: "Leadership read model", attempts: 3, delayMs: 250 });
}

async function loadAssessmentReviewWorkspaceOnce(workspaceId: string, nextPath = `/workspace/leadership/assessments/${workspaceId}`): Promise<AssessmentReviewData> {
  const access = await requireWorkspaceAccess(undefined, nextPath);
  const client = await createSupabaseServerClient();
  const result = await client.rpc("get_assessment_review_workspace", { p_workspace_id: workspaceId });
  if (result.error || !result.data) throw new Error(result.error?.message || "Assessment review could not be loaded.");
  const raw = object(result.data);
  const workspace = object(raw.workspace);
  const rawVersion = raw.version == null ? null : object(raw.version);
  return {
    access,
    workspace: {
      id: string(workspace.id),
      title: string(workspace.title),
      purpose: string(workspace.purpose),
      status: string(workspace.status),
      durationMinutes: number(workspace.durationMinutes),
      totalMarks: number(workspace.totalMarks),
      assessmentDate: string(workspace.assessmentDate),
      profileSnapshot: object(workspace.profileSnapshot),
      submittedAt: workspace.submittedAt == null ? null : string(workspace.submittedAt),
      finalisedAt: workspace.finalisedAt == null ? null : string(workspace.finalisedAt),
    },
    version: rawVersion ? { id: string(rawVersion.id), versionNumber: number(rawVersion.versionNumber), content: object(rawVersion.content), createdAt: string(rawVersion.createdAt) } : null,
    sections: records(raw.sections),
    history: records(raw.history),
  };
}

export async function loadAssessmentReviewWorkspace(workspaceId: string, nextPath = `/workspace/leadership/assessments/${workspaceId}`): Promise<AssessmentReviewData> {
  return withTransientReadRetry(() => loadAssessmentReviewWorkspaceOnce(workspaceId, nextPath), { label: "Assessment review read model", attempts: 3, delayMs: 250 });
}
