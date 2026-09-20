"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { parseLessonPayload, splitLines } from "@/artifacts/lesson";
import { createInitialFormalLessonPlan } from "@/artifacts/lesson-defaults";
import { lessonArtifactTypes, type FormalLessonPlanPayload, type LessonArtifactType } from "@/artifacts/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireWorkspaceAccess } from "@/lib/auth/access";
import { loadLessonReadinessData } from "./queries";

const uuid = z.string().uuid();
const lessonArtifactType = z.enum(lessonArtifactTypes as [LessonArtifactType, ...LessonArtifactType[]]);
const artifactInput = z.object({ scheduledLessonId: uuid, artifactType: lessonArtifactType, content: z.unknown(), expectedVersion: z.number().int().positive().nullable().optional() });
type ActionResult = { ok: true; id: string; version: number } | { ok: false; error: string };

function provenanceFor(data: Awaited<ReturnType<typeof loadLessonReadinessData>>) {
  const current = data.curriculum.current;
  return current ? [{ category: "CURRICULUM_ANCHOR", label: current.title, sourceId: current.canonicalId, sourceLocation: current.sourceLocator, rightsState: current.rightsStatus }] : [{ category: "TEACHER", label: "Teacher-authored planning context" }];
}

function defaultPackPayload(type: Exclude<LessonArtifactType, "FORMAL_LESSON_PLAN">, plan: FormalLessonPlanPayload) {
  const resources = plan.resources.filter(Boolean);
  const tasks = plan.teachingSequence.map((step) => step.learnerActivity).filter(Boolean);
  const prompts = plan.teachingSequence.flatMap((step) => step.prompts).filter(Boolean);
  const summary = plan.expectedOutcome || plan.learningIntention;
  const defaults = {
    BOARD_NOTES: { title: `Board notes · ${plan.title}`, keyPoints: splitLines(plan.intendedCoverage), examples: [], equations: [], prompts },
    LEARNER_NOTES: { title: `Learner notes · ${plan.title}`, keyConcepts: splitLines(plan.intendedCoverage), explanation: plan.learningIntention, examples: [], applications: [], summary },
    ACTIVITY_SHEET: { title: `Activity sheet · ${plan.title}`, instructions: "Use the lesson sequence to complete the activity.", materialsRequired: resources, tasks, questions: prompts, observationResponseArea: "", conclusionPrompts: splitLines(plan.conclusionFollowUp) },
    LESSON_SUMMARY: { title: `Lesson summary · ${plan.title}`, keyTakeaways: splitLines(plan.intendedCoverage), conciseSummary: summary, learnerReflection: "" },
    HOMEWORK: { title: `Homework · ${plan.title}`, instructions: plan.conclusionFollowUp, tasks: [], followUpNotes: "" },
  } as const;
  return defaults[type];
}

function refreshLesson(lessonId: string, sectionId: string) { revalidatePath(`/workspace/teacher/lessons/${lessonId}`); revalidatePath(`/workspace/teacher/sections/${sectionId}`); revalidatePath("/workspace"); }

export async function createFormalLessonPlan(scheduledLessonId: string): Promise<ActionResult> {
  try {
    const access = await requireWorkspaceAccess();
    if (!access.roles.includes("TEACHER")) throw new Error("An active TEACHER role is required to create a lesson plan.");
    const data = await loadLessonReadinessData(uuid.parse(scheduledLessonId));
    const content = createInitialFormalLessonPlan(data);
    const client = await createSupabaseServerClient();
    const result = await client.rpc("create_lesson_artifact", { p_scheduled_lesson_id: scheduledLessonId, p_artifact_type: "FORMAL_LESSON_PLAN", p_content_json: content, p_curriculum_profile_id: data.curriculum.subjectProfileId, p_curriculum_position_event_id: data.curriculum.current?.eventId ?? null, p_curriculum_canonical_id: data.curriculum.current?.canonicalId ?? null, p_provenance: provenanceFor(data), p_rights_state: content.curriculumAnchor?.rightsState ?? "UNKNOWN" });
    if (result.error || !result.data) throw new Error(result.error?.message || "Formal Lesson Plan could not be created.");
    refreshLesson(scheduledLessonId, data.lesson.section.id);
    const response = result.data as { artifactId: string; versionId: string; versionNumber: number };
    return { ok: true, id: response.artifactId, version: response.versionNumber };
  } catch (error) { return { ok: false, error: error instanceof Error ? error.message : "Formal Lesson Plan could not be created." }; }
}

export async function createTeachingPackArtifact(input: unknown): Promise<ActionResult> {
  try {
    const value = artifactInput.pick({ scheduledLessonId: true, artifactType: true }).parse(input);
    if (value.artifactType === "FORMAL_LESSON_PLAN") throw new Error("Use the Formal Lesson Plan action for the parent artifact.");
    const access = await requireWorkspaceAccess();
    if (!access.roles.includes("TEACHER")) throw new Error("An active TEACHER role is required to create Teaching Pack materials.");
    const data = await loadLessonReadinessData(value.scheduledLessonId);
    const plan = data.artifacts.find((artifact) => artifact.artifactType === "FORMAL_LESSON_PLAN");
    if (!plan?.currentVersionId || !plan.currentContent) throw new Error("Create and save the Formal Lesson Plan before adding Teaching Pack materials.");
    const parsedPlan = parseLessonPayload("FORMAL_LESSON_PLAN", plan.currentContent);
    const content = defaultPackPayload(value.artifactType, parsedPlan);
    const client = await createSupabaseServerClient();
    const result = await client.rpc("create_lesson_artifact", { p_scheduled_lesson_id: value.scheduledLessonId, p_artifact_type: value.artifactType, p_content_json: content, p_parent_artifact_id: plan.id, p_parent_version_id: plan.currentVersionId, p_curriculum_profile_id: data.curriculum.subjectProfileId, p_curriculum_position_event_id: data.curriculum.current?.eventId ?? null, p_curriculum_canonical_id: data.curriculum.current?.canonicalId ?? null, p_provenance: provenanceFor(data), p_rights_state: parsedPlan.curriculumAnchor?.rightsState ?? "UNKNOWN" });
    if (result.error || !result.data) throw new Error(result.error?.message || "Teaching Pack material could not be created.");
    refreshLesson(value.scheduledLessonId, data.lesson.section.id);
    const response = result.data as { artifactId: string; versionNumber: number };
    return { ok: true, id: response.artifactId, version: response.versionNumber };
  } catch (error) { return { ok: false, error: error instanceof Error ? error.message : "Teaching Pack material could not be created." }; }
}

export async function saveLessonArtifactVersion(input: unknown): Promise<ActionResult> {
  try {
    const value = artifactInput.parse(input);
    const access = await requireWorkspaceAccess();
    if (!access.roles.includes("TEACHER")) throw new Error("An active TEACHER role is required to save lesson artifacts.");
    const data = await loadLessonReadinessData(value.scheduledLessonId);
    const artifact = data.artifacts.find((item) => item.artifactType === value.artifactType);
    if (!artifact) throw new Error("Lesson artifact not found in this scheduled lesson.");
    if (!artifact.currentVersionId) throw new Error("Create the artifact before saving a new version.");
    const content = parseLessonPayload(value.artifactType, value.content);
    const client = await createSupabaseServerClient();
    const result = await client.rpc("create_lesson_artifact_version", { p_artifact_id: artifact.id, p_content_json: content, p_expected_version: value.expectedVersion ?? artifact.currentVersionNumber, p_change_source: "TEACHER", p_change_summary: "Teacher edited structured lesson artifact" });
    if (result.error || !result.data) throw new Error(result.error?.message || "Lesson artifact version could not be saved.");
    refreshLesson(value.scheduledLessonId, data.lesson.section.id);
    const response = result.data as { artifactId: string; versionNumber: number };
    return { ok: true, id: response.artifactId, version: response.versionNumber };
  } catch (error) { return { ok: false, error: error instanceof Error ? error.message : "Lesson artifact version could not be saved." }; }
}
