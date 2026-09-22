"use client";

import { ArrowRight, ClipboardCheck, Plus, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { createAssessmentWorkspace } from "@/assessment/application/actions";
import type { AssessmentStudioListData } from "@/assessment/application/queries";

function text(value: unknown) { return typeof value === "string" ? value : ""; }
function todayInPeriod(period: Record<string, unknown> | undefined) { const today = new Date().toISOString().slice(0, 10); const startsOn = text(period?.starts_on); const endsOn = text(period?.ends_on); return startsOn && endsOn && today >= startsOn && today <= endsOn ? today : ""; }
const purposeLabels: Record<string, string> = { FORMATIVE_CHECK: "Formative check", CLASS_TEST: "Class test", DIAGNOSTIC: "Diagnostic", REVISION_PRACTICE: "Revision practice", COMMON_STREAM_TEST: "Common stream test", INTERNAL_EXAM: "Internal exam" };

export function AssessmentStudioList({ data }: { data: AssessmentStudioListData }) {
  const router = useRouter();
  const [purpose, setPurpose] = useState("CLASS_TEST");
  const [subjectId, setSubjectId] = useState(text(data.subjects[0]?.id));
  const [periodId, setPeriodId] = useState(text(data.periods[0]?.id));
  const [assessmentDate, setAssessmentDate] = useState(() => todayInPeriod(data.periods[0]));
  const [profileId, setProfileId] = useState("");
  const [curriculumProfileId, setCurriculumProfileId] = useState("");
  const [sectionIds, setSectionIds] = useState<string[]>([]);
  const [title, setTitle] = useState("");
  const [duration, setDuration] = useState("40");
  const [marks, setMarks] = useState("40");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const profiles = useMemo(() => data.profiles.filter((profile) => text(profile.purpose) === purpose), [data.profiles, purpose]);
  const sections = data.sections.filter((section) => text(section.school_subject_id) === subjectId && text(section.academic_period_id) === periodId);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage("");
    const result = await createAssessmentWorkspace({ academicPeriodId: periodId, schoolSubjectId: subjectId, curriculumSubjectProfileId: curriculumProfileId, assessmentProfileId: profileId, purpose, title, durationMinutes: duration, totalMarks: marks, sectionIds, assessmentDate });
    setBusy(false);
    if (!result.ok) { setMessage(result.error); return; }
    router.push(`/workspace/teacher/assessments/${result.id}`);
  }

  return <main className="assessment-page">
    <header className="assessment-heading"><div><p className="eyebrow">Teacher workspace · authoring</p><h1>Assessment Studio</h1><p className="lede">Build an assessment from its purpose, verified profile and confirmed classroom scope. ATE prepares the instrument; you remain the final authority.</p></div><div className="assessment-heading-note"><ShieldCheck size={16} /><span>Deterministic scope<br /><small>No mastery inference</small></span></div></header>
    <section className="assessment-create-grid">
      <form className="assessment-form" onSubmit={submit}>
        <div className="section-title"><div><span className="section-kicker">Start with the rule context</span><h2>Create an assessment</h2><p>Purpose changes the applicable profile, scope and review expectations.</p></div></div>
        <div className="assessment-form-grid">
          <label>Purpose<select value={purpose} onChange={(event) => { setPurpose(event.target.value); setProfileId(""); }} required>{data.purposes.map((item) => <option key={item} value={item}>{purposeLabels[item]}</option>)}</select></label>
          <label>Subject<select value={subjectId} onChange={(event) => setSubjectId(event.target.value)} required>{data.subjects.map((item) => <option key={text(item.id)} value={text(item.id)}>{text(item.name)}</option>)}</select></label>
          <label>Academic period<select value={periodId} onChange={(event) => { const nextPeriodId = event.target.value; setPeriodId(nextPeriodId); setAssessmentDate(todayInPeriod(data.periods.find((period) => text(period.id) === nextPeriodId))); }} required>{data.periods.map((item) => <option key={text(item.id)} value={text(item.id)}>{text(item.name)}</option>)}</select></label>
          <label>Assessment date<input type="date" value={assessmentDate} min={text(data.periods.find((period) => text(period.id) === periodId)?.starts_on)} max={text(data.periods.find((period) => text(period.id) === periodId)?.ends_on)} onChange={(event) => setAssessmentDate(event.target.value)} required /></label>
          <label>Curriculum subject profile<input value={curriculumProfileId} onChange={(event) => setCurriculumProfileId(event.target.value)} placeholder="Paste the verified curriculum profile reference" required /></label>
          <label className="wide-field">Assessment profile<select value={profileId} onChange={(event) => setProfileId(event.target.value)} required><option value="">Choose the active profile</option>{profiles.map((profile) => <option key={text(profile.id)} value={text(profile.id)}>{text(profile.display_title)} · {text(profile.regime)}</option>)}</select></label>
          <label className="wide-field">Title<input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Cell structure class test" required /></label>
          <label>Duration (minutes)<input type="number" min="1" max="600" value={duration} onChange={(event) => setDuration(event.target.value)} required /></label>
          <label>Total marks<input type="number" min="1" max="1000" value={marks} onChange={(event) => setMarks(event.target.value)} required /></label>
        </div>
        <fieldset className="section-picker"><legend>Participating Teaching Sections</legend><p>Parallel streams stay independently stateful. Common tests use their confirmed-scope intersection.</p>{sections.length === 0 ? <span className="form-note">No assigned active Teaching Sections match this subject and period.</span> : sections.map((section) => <label className="section-check" key={text(section.id)}><input type="checkbox" checked={sectionIds.includes(text(section.id))} onChange={(event) => setSectionIds((current) => event.target.checked ? [...current, text(section.id)] : current.filter((id) => id !== text(section.id)))} /><span>{text(section.id)}<small>Assigned Teaching Section</small></span></label>)}</fieldset>
        {message && <p className="form-error" role="alert">{message}</p>}
        <button className="button button-primary" disabled={busy || !profileId || !curriculumProfileId || !sectionIds.length || !assessmentDate}><Plus size={15} />{busy ? "Resolving scope…" : "Open assessment workspace"}</button>
      </form>
      <aside className="assessment-principles"><div className="principle-icon"><ClipboardCheck size={18} /></div><span className="section-kicker">Assessment Studio guardrails</span><h2>Make the paper honest before making it polished.</h2><p>ATE only offers confirmed classroom evidence as ordinary eligible scope. Broader diagnostic or revision scope appears only when the active profile permits it.</p><div className="principle-rule"><strong>Teacher-owned</strong><span>Draft, edit, review and finalise your own assessment.</span></div><div className="principle-rule"><strong>Profile-led</strong><span>Missing verified guidance is visible, never silently filled from model memory.</span></div></aside>
    </section>
    <section className="assessment-list"><div className="section-title"><div><span className="section-kicker">Your work</span><h2>Assessment drafts and finals</h2><p>Private teacher work stays with its owner in Step 9.</p></div></div>{data.workspaces.length === 0 ? <div className="assessment-empty"><ClipboardCheck size={17} /><div><strong>No assessments yet.</strong><p>Start with a purpose above; ATE will resolve the confirmed scope before authoring.</p></div></div> : <div className="assessment-work-list">{data.workspaces.map((workspace) => <a className="assessment-work-row" href={`/workspace/teacher/assessments/${text(workspace.id)}`} key={text(workspace.id)}><span><strong>{text(workspace.title)}</strong><small>{purposeLabels[text(workspace.purpose)] || text(workspace.purpose)} · {text(workspace.total_marks)} marks · {text(workspace.duration_minutes)} minutes</small></span><span className={`assessment-status ${text(workspace.status).toLowerCase()}`}>{text(workspace.status)}<ArrowRight size={15} /></span></a>)}</div>}</section>
  </main>;
}
