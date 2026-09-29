"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { AlertCircle, Check, Clock3, RotateCcw } from "lucide-react";
import type { ClassroomContinuityData, ContinuityRow } from "@/classroom-continuity/application/queries";
import { correctRecordedOutcome, recordClassroomOutcome } from "@/classroom-continuity/application/ui-actions";

const outcomeLabels = { DELIVERED: "Delivered", PARTIALLY_DELIVERED: "Partially delivered", NOT_DELIVERED: "Not delivered", CHANGED: "Changed" } as const;
const ownStateLabels = { PARTIAL_CARRY_FORWARD: "This lesson was partially delivered.", NOT_DELIVERED_CARRY_FORWARD: "This scheduled lesson was not delivered.", CHANGED_REVIEW: "This lesson changed from the timetable.", UNCONFIRMED: "This scheduled lesson is awaiting confirmation." } as const;
const carryLabels = { PARTIAL_CARRY_FORWARD: "Previous lesson was partially delivered.", NOT_DELIVERED_CARRY_FORWARD: "Previous scheduled lesson was not delivered.", CHANGED_REVIEW: "Previous lesson changed from the timetable." } as const;

function formatTime(value: string, timeZone: string) { return new Intl.DateTimeFormat("en-UG", { hour: "numeric", minute: "2-digit", timeZone }).format(new Date(value)); }
function formatDate(value: string, timeZone: string) { return new Intl.DateTimeFormat("en-UG", { weekday: "short", day: "numeric", month: "short", timeZone }).format(new Date(value)); }

export function ClassroomContinuityWorkspace({ data }: { data: ClassroomContinuityData }) {
  const isLeader = data.scope !== "MY";
  const isOperationalException = (lesson: ContinuityRow) => (lesson.lesson_state !== "SCHEDULED" && lesson.lesson_state !== "CLEAR") || Boolean(lesson.carry_forward_state);
  const visibleLessons = isLeader ? data.lessons.filter((lesson) => lesson.teacher_membership_id === data.access.membershipId || isOperationalException(lesson)) : data.lessons;
  const today = visibleLessons.filter((lesson) => lesson.is_today);
  const attention = visibleLessons.filter(isOperationalException);
  const priorityLessons = visibleLessons.filter((lesson) => lesson.is_today || lesson.lesson_state === "UNCONFIRMED");
  const remainingLessons = visibleLessons.filter((lesson) => !priorityLessons.includes(lesson));
  return <div className="continuity-page">
    <header className="continuity-heading">
      <div><p className="eyebrow">{isLeader ? "School overview" : "Classroom"}</p><h1>{isLeader ? data.scope === "DEPARTMENT" ? "Your department" : "School lessons" : "What happened in class?"}</h1><p className="lede">{isLeader ? "See classes that may need follow-up." : "A quick record helps you pick up where your class left off."}</p></div>
      <div className="continuity-rule"><Clock3 size={17} /><span>Schedule intent stays separate from classroom reality.<small>School time · {data.lessons[0]?.school_timezone || "configured timezone"}</small></span></div>
    </header>
    {isLeader && attention.length === 0 && <section className="continuity-assurance" role="status"><Check size={17} /><div><strong>No classes need follow-up.</strong></div></section>}
    <section className="continuity-body"><div className="section-title"><div><h2>{isLeader ? "Lessons to review" : "Your lessons"}</h2><p>{isLeader ? "The teacher records what happened in each class." : "Select a past lesson to record what happened."}</p></div></div>{visibleLessons.length === 0 ? <div className="operations-empty"><span className="empty-icon"><Clock3 size={15} /></span><div><strong>No lessons here yet.</strong><p>Scheduled lessons will appear when the timetable is active.</p></div></div> : <><div className="continuity-list">{priorityLessons.map((lesson) => <LessonCard key={lesson.lesson_id} lesson={lesson} />)}</div>{remainingLessons.length > 0 && <details className="continuity-more"><summary>Other scheduled and recorded lessons ({remainingLessons.length})</summary><div className="continuity-list">{remainingLessons.map((lesson) => <LessonCard key={lesson.lesson_id} lesson={lesson} />)}</div></details>}</>}</section>
  </div>;
}

function LessonCard({ lesson }: { lesson: ContinuityRow }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [formOutcome, setFormOutcome] = useState<ContinuityRow["outcome"]>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [correcting, setCorrecting] = useState(false);
  const [effectiveEventId, setEffectiveEventId] = useState(lesson.event_id);
  const [effectiveOutcome, setEffectiveOutcome] = useState(lesson.outcome);
  const confirmed = effectiveEventId !== null;
  const canConfirm = lesson.can_confirm && effectiveEventId === null;
  const locallyConfirmedByAuthorizedTeacher = lesson.can_confirm && effectiveEventId !== null;
  const canCorrect = lesson.can_correct || locallyConfirmedByAuthorizedTeacher;
  const canAct = canConfirm || canCorrect;
  const visibleState = effectiveOutcome === "DELIVERED" ? "CLEAR" : effectiveOutcome === "PARTIALLY_DELIVERED" ? "PARTIAL_CARRY_FORWARD" : effectiveOutcome === "NOT_DELIVERED" ? "NOT_DELIVERED_CARRY_FORWARD" : effectiveOutcome === "CHANGED" ? "CHANGED_REVIEW" : lesson.lesson_state;
  const confirm = (outcome: NonNullable<ContinuityRow["outcome"]>, form?: HTMLFormElement) => {
    const values = form ? new FormData(form) : null;
    startTransition(async () => {
      const result = canCorrect ? await correctRecordedOutcome({ scheduledLessonId: lesson.lesson_id, priorEventId: effectiveEventId!, outcome, reason: String(values?.get("reason") || ""), note: String(values?.get("note") || "") }) : await recordClassroomOutcome({ scheduledLessonId: lesson.lesson_id, outcome, reason: String(values?.get("reason") || ""), note: String(values?.get("note") || "") });
      setMessage(result.ok ? `${canCorrect ? "Corrected" : "Confirmed"}: ${outcomeLabels[outcome]}.` : result.error);
      if (result.ok) { setEffectiveEventId(result.eventId); setEffectiveOutcome(outcome); setFormOutcome(null); setCorrecting(false); router.refresh(); }
    });
  };
  return <article className={`lesson-card${lesson.lesson_state !== "CLEAR" && lesson.lesson_state !== "SCHEDULED" ? " needs-attention" : ""}`}>
    <div className="lesson-meta"><span>{formatTime(lesson.starts_at, lesson.school_timezone)}–{formatTime(lesson.ends_at, lesson.school_timezone)}</span><span>{lesson.class_level_name} · {lesson.stream_name}</span><span>{formatDate(lesson.starts_at, lesson.school_timezone)}</span></div>
    <div className="lesson-main"><div><h3>{lesson.subject_name}</h3></div><StateLabel state={visibleState} /></div>
    {visibleState !== "CLEAR" && visibleState !== "SCHEDULED" && <p className="source-state-copy">{ownStateLabels[visibleState as keyof typeof ownStateLabels]}</p>}
    {lesson.carry_forward_state && <div className="carry-forward-box"><strong>Continuity from previous lesson</strong><span>{carryLabels[lesson.carry_forward_state]}</span></div>}
    {effectiveOutcome && <div className="confirmed-line"><Check size={15} /><span><strong>{outcomeLabels[effectiveOutcome]}</strong>{lesson.confirmed_at ? ` · Recorded ${formatTime(lesson.confirmed_at, lesson.school_timezone)}` : ""}</span></div>}
    {message && <div className={`continuity-message${message.startsWith("Confirmed") || message.startsWith("Corrected") ? " success" : " error"}`} role="status"><span>{message.startsWith("Confirmed") || message.startsWith("Corrected") ? <Check size={15} /> : <AlertCircle size={15} />}</span>{message}</div>}
    {canAct && <div className="outcome-area">{(canConfirm || correcting) && <><h4 className="outcome-question">What happened in this class?</h4>{!formOutcome && <div className="outcome-actions"><button className="button button-primary" disabled={pending} onClick={() => confirm("DELIVERED")}>Completed as planned</button><button className="button" disabled={pending} onClick={() => setFormOutcome("PARTIALLY_DELIVERED")}>Covered part of the topic</button><button className="button" disabled={pending} onClick={() => setFormOutcome("NOT_DELIVERED")}>Class did not happen</button><button className="button" disabled={pending} onClick={() => setFormOutcome("CHANGED")}>Something changed</button></div>}{formOutcome && <form className="outcome-form" onSubmit={(event) => { event.preventDefault(); confirm(formOutcome, event.currentTarget); }}><strong>{outcomeLabels[formOutcome]}</strong>{formOutcome === "NOT_DELIVERED" && <label>Reason <input name="reason" required placeholder="Why did the class not happen?" /></label>}{formOutcome === "CHANGED" && <label>What changed?<textarea name="note" rows={2} required placeholder="Add a short note" /></label>}{(formOutcome === "PARTIALLY_DELIVERED" || formOutcome === "NOT_DELIVERED") && <label>Note <span>(optional)</span><textarea name="note" rows={2} placeholder="What should you remember next time?" /></label>}<div className="action-row"><button className="button button-primary" disabled={pending}>{pending ? "Recording..." : canCorrect ? "Save correction" : "Save record"}</button><button type="button" className="button button-quiet" onClick={() => setFormOutcome(null)}>Cancel</button></div></form>}</>}{canCorrect && !correcting && <button className="text-button correction-button" onClick={() => setCorrecting(true)}><RotateCcw size={13} />Correct this record</button>}{canCorrect && correcting && <span className="correction-note">Correction preserves the original classroom record.</span>}</div>}
    {confirmed && !canAct && <p className="muted-note">Read-only classroom evidence.</p>}
  </article>;
}

function StateLabel({ state }: { state: ContinuityRow["lesson_state"] }) { const label = state === "SCHEDULED" ? "Scheduled" : state === "UNCONFIRMED" ? "Awaiting confirmation" : state === "CLEAR" ? "Confirmed" : "Continuity attention"; return <span className={`status ${state === "CLEAR" ? "status-positive" : state === "SCHEDULED" ? "status-neutral" : "status-attention"}`}>{label}</span>; }
