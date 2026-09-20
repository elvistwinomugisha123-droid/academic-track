"use client";

import { Check, CircleAlert, Plus, Save, ShieldCheck } from "lucide-react";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { parseLessonPayload, joinLines } from "@/artifacts/lesson";
import { createInitialFormalLessonPlan } from "@/artifacts/lesson-defaults";
import type { FormalLessonPlanPayload } from "@/artifacts/types";
import { createFormalLessonPlan, saveLessonArtifactVersion } from "@/teacher/application/artifact-actions";
import type { LessonReadinessData } from "@/teacher/application/queries";

function initialPlan(data: LessonReadinessData): FormalLessonPlanPayload { return createInitialFormalLessonPlan(data); }

export function LessonPlanEditor({ data }: { data: LessonReadinessData }) {
  const router = useRouter();
  const artifact = data.artifacts.find((item) => item.artifactType === "FORMAL_LESSON_PLAN");
  const [plan, setPlan] = useState<FormalLessonPlanPayload>(() => artifact?.currentContent ? parseLessonPayload("FORMAL_LESSON_PLAN", artifact.currentContent) : initialPlan(data));
  const [version, setVersion] = useState(artifact?.currentVersionNumber ?? null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const update = <K extends keyof FormalLessonPlanPayload>(key: K, value: FormalLessonPlanPayload[K]) => setPlan((current) => ({ ...current, [key]: value }));
  const save = () => startTransition(async () => {
    const result = artifact?.id && version ? await saveLessonArtifactVersion({ scheduledLessonId: data.lesson.id, artifactType: "FORMAL_LESSON_PLAN", content: plan, expectedVersion: version }) : await createFormalLessonPlan(data.lesson.id);
    setMessage(result.ok ? (result.version === 1 ? "Formal Lesson Plan created as version 1." : `Formal Lesson Plan saved as version ${result.version}.`) : result.error);
    if (result.ok) { setVersion(result.version); router.refresh(); }
  });
  return <section className="artifact-editor" aria-labelledby="lesson-plan-title">
    <div className="artifact-editor-heading"><div><span className="section-kicker">Parent planning artifact</span><h2 id="lesson-plan-title">Formal Lesson Plan</h2><p>Shape a professional plan from the governed lesson context. Everything here remains teacher-authored.</p></div><div className="artifact-version-state">{version ? <span className="saved-state"><Check size={14} />Version {version}</span> : <span className="status status-neutral">Not saved yet</span>}</div></div>
    {message && <div className={`teacher-message ${message.endsWith(".") && !message.includes("could not") ? "success" : "error"}`} role="status">{message.includes("could not") ? <CircleAlert size={16} /> : <Check size={16} />}{message}</div>}
    <div className="artifact-context-line"><ShieldCheck size={15} /><span>{data.lesson.section.subjectName} · {data.lesson.section.classLevelName} {data.lesson.section.streamName} · {plan.durationMinutes} minutes</span><span className="provenance"><i />{plan.curriculumAnchor ? `Anchor: ${plan.curriculumAnchor.title}` : "No governed curriculum position resolved"}</span></div>
    {plan.curriculumAnchor?.rightsState !== "CLEARED" && <div className="rights-note"><ShieldCheck size={16} /><div><strong>Curriculum wording is rights-limited.</strong><span>This plan preserves the anchor and provenance without copying protected source wording. Teacher-authored instructional work remains editable.</span></div></div>}
    <div className="artifact-form-grid">
      <label>Plan title<input value={plan.title} onChange={(event) => update("title", event.target.value)} maxLength={240} /></label>
      <label>Lesson focus<input value={plan.lessonFocus} onChange={(event) => update("lessonFocus", event.target.value)} maxLength={240} /></label>
      <label>Learning intention<textarea rows={3} value={plan.learningIntention} onChange={(event) => update("learningIntention", event.target.value)} placeholder="What should learners understand or be able to do?" /></label>
      <label>Expected outcome / evidence<textarea rows={3} value={plan.expectedOutcome} onChange={(event) => update("expectedOutcome", event.target.value)} placeholder="What will make the intention visible?" /></label>
      <label>Prior learning / continuity<textarea rows={3} value={plan.priorLearning} onChange={(event) => update("priorLearning", event.target.value)} /></label>
      <label>Carry-forward context<textarea rows={3} value={plan.continuityContext} onChange={(event) => update("continuityContext", event.target.value)} placeholder="Only record what the previous classroom state makes relevant." /></label>
      <label>Intended coverage<textarea rows={3} value={plan.intendedCoverage} onChange={(event) => update("intendedCoverage", event.target.value)} placeholder="What will this lesson address?" /></label>
      <label>Resources<textarea rows={3} value={joinLines(plan.resources)} onChange={(event) => update("resources", event.target.value.split(/\r?\n/))} placeholder="One resource per line" /></label>
    </div>
    <div className="artifact-subsection"><div className="section-title"><div><span className="section-kicker">Teaching sequence</span><h3>How the lesson moves</h3><p>Keep the sequence practical; timings are planning intent, not a claim that teaching happened.</p></div><button className="button small" type="button" onClick={() => update("teachingSequence", [...plan.teachingSequence, { id: `sequence-${plan.teachingSequence.length + 1}`, label: "New lesson step", minutes: 0, teacherActivity: "", learnerActivity: "", prompts: [], formativeCheck: "" }])}><Plus size={14} />Add step</button></div><div className="sequence-list">{plan.teachingSequence.map((step, index) => <div className="sequence-item" key={step.id}><div className="sequence-item-title"><strong>{index + 1}</strong><input aria-label={`Sequence step ${index + 1} label`} value={step.label} onChange={(event) => update("teachingSequence", plan.teachingSequence.map((item) => item.id === step.id ? { ...item, label: event.target.value } : item))} /><label>Minutes<input type="number" min={0} value={step.minutes} onChange={(event) => update("teachingSequence", plan.teachingSequence.map((item) => item.id === step.id ? { ...item, minutes: Number(event.target.value) } : item))} /></label></div><div className="sequence-fields"><label>Teacher activity<textarea rows={3} value={step.teacherActivity} onChange={(event) => update("teachingSequence", plan.teachingSequence.map((item) => item.id === step.id ? { ...item, teacherActivity: event.target.value } : item))} /></label><label>Learner activity<textarea rows={3} value={step.learnerActivity} onChange={(event) => update("teachingSequence", plan.teachingSequence.map((item) => item.id === step.id ? { ...item, learnerActivity: event.target.value } : item))} /></label><label>Questions / prompts<textarea rows={3} value={joinLines(step.prompts)} onChange={(event) => update("teachingSequence", plan.teachingSequence.map((item) => item.id === step.id ? { ...item, prompts: event.target.value.split(/\r?\n/) } : item))} placeholder="One prompt per line" /></label><label>Formative check<textarea rows={3} value={step.formativeCheck} onChange={(event) => update("teachingSequence", plan.teachingSequence.map((item) => item.id === step.id ? { ...item, formativeCheck: event.target.value } : item))} /></label></div></div>)}</div></div>
    <div className="artifact-form-grid"><label>Differentiation / adaptation<textarea rows={4} value={plan.differentiation} onChange={(event) => update("differentiation", event.target.value)} placeholder="What will you adapt for this class?" /></label><label>Conclusion / follow-up<textarea rows={4} value={plan.conclusionFollowUp} onChange={(event) => update("conclusionFollowUp", event.target.value)} placeholder="What should happen after the lesson?" /></label><label>Teacher notes<textarea rows={4} value={plan.teacherNotes} onChange={(event) => update("teacherNotes", event.target.value)} /></label></div>
    <div className="editor-footer"><span className="provenance"><i />Saved versions are immutable; editing creates the next version.</span><button className="button button-primary" type="button" onClick={save} disabled={pending || !plan.title.trim()}><Save size={15} />{pending ? "Saving…" : version ? `Save version ${version + 1}` : "Create Formal Lesson Plan"}</button></div>
  </section>;
}
