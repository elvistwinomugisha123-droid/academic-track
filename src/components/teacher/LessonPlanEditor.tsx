"use client";

import { Check, CircleAlert, Plus, Save, ShieldCheck, Sparkles } from "lucide-react";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { parseLessonPayload, joinLines } from "@/artifacts/lesson";
import { createInitialFormalLessonPlan } from "@/artifacts/lesson-defaults";
import type { FormalLessonPlanPayload } from "@/artifacts/types";
import { createFormalLessonPlan, saveLessonArtifactVersion } from "@/teacher/application/artifact-actions";
import { acceptAIProposal, askATEForArtifact, generateFormalLessonPlanDraft, rejectAIProposal, type AIProposal } from "@/teacher/application/ai-artifact-actions";
import { GenerationProgress } from "./GenerationProgress";
import { AIProposalError, AIProposalHint, AIProposalPanel } from "./AIProposalPanel";
import type { LessonReadinessData } from "@/teacher/application/queries";

function initialPlan(data: LessonReadinessData): FormalLessonPlanPayload { return createInitialFormalLessonPlan(data); }

export function LessonPlanEditor({ data, initialEdit = false }: { data: LessonReadinessData; initialEdit?: boolean }) {
  const router = useRouter();
  const artifact = data.artifacts.find((item) => item.artifactType === "FORMAL_LESSON_PLAN");
  const [plan, setPlan] = useState<FormalLessonPlanPayload>(() => artifact?.currentContent ? parseLessonPayload("FORMAL_LESSON_PLAN", artifact.currentContent) : initialPlan(data));
  const [savedSnapshot, setSavedSnapshot] = useState(() => JSON.stringify(artifact?.currentContent ? parseLessonPayload("FORMAL_LESSON_PLAN", artifact.currentContent) : initialPlan(data)));
  const [version, setVersion] = useState(artifact?.currentVersionNumber ?? null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [aiProposal, setAiProposal] = useState<AIProposal | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [askInstruction, setAskInstruction] = useState("");
  const [manualEditing, setManualEditing] = useState(initialEdit);
  const [generating, setGenerating] = useState(false);
  const hasUnsavedChanges = JSON.stringify(plan) !== savedSnapshot;
  const update = <K extends keyof FormalLessonPlanPayload>(key: K, value: FormalLessonPlanPayload[K]) => setPlan((current) => ({ ...current, [key]: value }));
  const save = () => startTransition(async () => {
    const result = artifact?.id && version ? await saveLessonArtifactVersion({ scheduledLessonId: data.lesson.id, artifactType: "FORMAL_LESSON_PLAN", content: plan, expectedVersion: version }) : await createFormalLessonPlan({ scheduledLessonId: data.lesson.id, content: plan });
    setMessage(result.ok ? (result.version === 1 ? "Formal Lesson Plan created as version 1." : `Formal Lesson Plan saved as version ${result.version}.`) : result.error);
    if (result.ok) { setVersion(result.version); setSavedSnapshot(JSON.stringify(plan)); router.push(`/workspace/teacher/lessons/${data.lesson.id}/artifacts/${result.id}`); router.refresh(); }
  });
  const generate = () => {
    if (generating || pending) return;
    setGenerating(true);
    startTransition(async () => {
      setAiError(null);
      try {
        const result = await generateFormalLessonPlanDraft(data.lesson.id);
        if (result.ok) {
          setAiProposal(result);
        } else {
          setAiProposal(null);
          setAiError(result.error);
        }
      } catch (error) {
        // A server-action transport/timeout failure must not crash the teacher workspace.
        // The server might have completed AI generation even when its response was lost.
        console.error("ATE lesson draft response failed", { name: error instanceof Error ? error.name : "UnknownError" });
        setAiProposal(null);
        setAiError("ATE could not return the generated draft to this page. Your saved lesson has not changed. Please contact the pilot administrator before generating again.");
      } finally {
        setGenerating(false);
      }
    });
  };
  const ask = () => startTransition(async () => { if (!artifact?.id || !askInstruction.trim()) return; setAiError(null); const result = await askATEForArtifact({ scheduledLessonId: data.lesson.id, artifactId: artifact.id, artifactType: "FORMAL_LESSON_PLAN", instruction: askInstruction }); setAiProposal(result); if (!result.ok) setAiError(result.error); });
  const accept = () => { if (!aiProposal?.ok) return; startTransition(async () => { const result = await acceptAIProposal({ runId: aiProposal.runId, scheduledLessonId: data.lesson.id, artifactId: aiProposal.artifactId, artifactType: aiProposal.artifactType, expectedVersion: aiProposal.expectedVersion, parentArtifactId: aiProposal.parentArtifactId, parentVersionId: aiProposal.parentVersionId, content: aiProposal.content, contextFingerprint: aiProposal.contextFingerprint, outputFingerprint: aiProposal.outputFingerprint, instruction: aiProposal.instruction, selectedField: aiProposal.selectedField, changeSummary: "Teacher accepted ATE Formal Lesson Plan proposal" }); setMessage(result.ok ? `ATE proposal saved as version ${result.version}.` : result.error); if (result.ok) { setAiProposal(null); router.push(`/workspace/teacher/lessons/${data.lesson.id}/artifacts/${result.id}`); router.refresh(); } }); };
  const reject = () => { if (!aiProposal?.ok) return; startTransition(async () => { const result = await rejectAIProposal(aiProposal.runId); setAiProposal(null); setMessage(result.ok ? "ATE proposal rejected; no artifact version was created." : result.error || "Proposal could not be rejected."); }); };
  const showManualEditor = manualEditing;
  if (generating) return <GenerationProgress material="lesson plan" />;
  if (aiProposal?.ok) return <AIProposalPanel proposal={aiProposal} pending={pending} onAccept={accept} onReject={reject} />;
  return <section className="artifact-editor" aria-labelledby="lesson-plan-title">
    <div className="artifact-editor-heading"><div><span className="section-kicker">Parent planning artifact</span><h2 id="lesson-plan-title">{manualEditing ? "Edit Formal Lesson Plan" : "Formal Lesson Plan"}</h2><p>{manualEditing ? "Changes stay in this draft until you save a new version." : "Shape a professional plan from the verified lesson context. Everything here remains teacher-authored."}</p></div><div className="pack-editor-actions">{(artifact?.currentContent || manualEditing) && <button className="button small" type="button" onClick={generate} disabled={pending}><Sparkles size={14} />{pending ? "Preparing…" : "Generate with ATE"}</button>}{version ? <span className={`saved-state${hasUnsavedChanges ? " unsaved" : ""}`} role="status" aria-live="polite">{hasUnsavedChanges ? <CircleAlert size={14} /> : <Check size={14} />}{hasUnsavedChanges ? `Unsaved changes · saved version ${version}` : `Saved version ${version}`}</span> : <span className="status status-neutral">Not saved yet</span>}{manualEditing && artifact?.id && <a className="button small button-quiet" href={`/workspace/teacher/lessons/${data.lesson.id}/artifacts/${artifact.id}`}>Read saved version</a>}</div></div>
    {aiError && <AIProposalError message={aiError} />}
    {aiProposal?.ok && <AIProposalPanel proposal={aiProposal} pending={pending} onAccept={accept} onReject={reject} />}
    {message && <div className={`teacher-message ${message.endsWith(".") && !message.includes("could not") ? "success" : "error"}`} role="status">{message.includes("could not") ? <CircleAlert size={16} /> : <Check size={16} />}{message}</div>}
    {Boolean(artifact?.currentContent) && !manualEditing && !aiProposal?.ok && <div className="saved-work-card"><div><span className="section-kicker">Saved work</span><h3>Your lesson plan is ready to read</h3><p>Open the document to read it comfortably, download it, or return to edit.</p></div><div className="action-row"><a className="button button-primary" href={`/workspace/teacher/lessons/${data.lesson.id}/artifacts/${artifact?.id}`}>Read lesson plan</a><button className="button" type="button" onClick={() => setManualEditing(true)}>Edit fields</button></div></div>}
    <div className="artifact-context-line"><ShieldCheck size={15} /><span>{data.lesson.section.subjectName} · {data.lesson.section.classLevelName} {data.lesson.section.streamName} · {plan.durationMinutes} minutes</span><span className="provenance"><i />{plan.curriculumAnchor ? `Curriculum anchor: ${plan.curriculumAnchor.title}` : "Choose where this class is currently teaching before preparing the lesson."}</span></div>
    {!artifact?.currentContent && !aiProposal?.ok && !showManualEditor && <div className="generation-start" aria-label="Start lesson plan preparation"><div><span className="section-kicker">Start with ATE</span><h3>Generate the complete lesson draft.</h3><p>ATE uses the confirmed curriculum position, lesson duration, carry-forward context and teaching section. You review the result before anything is saved.</p></div><div className="generation-start-actions"><button className="button button-primary" type="button" onClick={generate} disabled={pending}><Sparkles size={15} />{pending ? "Preparing…" : "Generate lesson with ATE"}</button><button className="button button-quiet" type="button" onClick={() => setManualEditing(true)}>Write one manually instead</button></div></div>}
    {showManualEditor && !aiProposal?.ok && <>
    {plan.curriculumAnchor?.rightsState !== "CLEARED" && plan.curriculumAnchor?.rightsState !== "OPERATOR_AUTHORIZED_FOR_PILOT" && <div className="rights-note"><ShieldCheck size={16} /><div><strong>Review the lesson details before saving.</strong><span>You can adjust the plan to fit your class while keeping the selected curriculum position.</span></div></div>}
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
    {artifact?.id && <div className="ask-ate-strip"><div><span className="section-kicker">Contextual Ask ATE</span><strong>Request a bounded change to this plan</strong><AIProposalHint /></div><div className="ask-ate-controls"><input value={askInstruction} onChange={(event) => setAskInstruction(event.target.value)} placeholder="Make the teaching sequence fit 20 minutes…" maxLength={1000} /><button className="button small" type="button" onClick={ask} disabled={pending || !askInstruction.trim()}><Sparkles size={14} />Preview changes</button></div></div>}
    <div className="editor-footer"><span className="provenance"><i />Saved versions are immutable; editing creates the next version.</span><div className="action-row">{artifact?.id && <><a className="button small button-quiet" href={`/workspace/teacher/lessons/${data.lesson.id}/print?artifactId=${artifact.id}`} target="_blank" rel="noreferrer">Print view</a><a className="button small button-quiet" href={`/api/teacher/lessons/${data.lesson.id}/artifacts/${artifact.id}/pdf`} target="_blank" rel="noreferrer">PDF · saved version</a><a className="button small button-quiet" href={`/api/teacher/lessons/${data.lesson.id}/artifacts/${artifact.id}/docx`}>DOCX · saved version</a></>}<button className="button button-primary" type="button" onClick={save} disabled={pending || !plan.title.trim() || !hasUnsavedChanges && Boolean(version)}><Save size={15} />{pending ? "Saving…" : version ? `Save version ${version + 1}` : "Create Formal Lesson Plan"}</button></div></div>
    </>}
  </section>;
}
