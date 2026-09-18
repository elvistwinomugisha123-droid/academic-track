"use client";

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
  const visibleLessons = isLeader ? data.lessons.filter((lesson) => (lesson.lesson_state !== "SCHEDULED" && lesson.lesson_state !== "CLEAR") || lesson.carry_forward_state) : data.lessons;
  const today = visibleLessons.filter((lesson) => lesson.is_today);
  const attention = visibleLessons.filter((lesson) => (lesson.lesson_state !== "SCHEDULED" && lesson.lesson_state !== "CLEAR") || lesson.carry_forward_state);
  return <div className="continuity-page">
    <header className="continuity-heading">
      <div><p className="eyebrow">{isLeader ? "Operational continuity" : "My classroom"}</p><h1>{isLeader ? data.scope === "DEPARTMENT" ? "Department continuity." : "Academic continuity." : "What happened in class?"}</h1><p className="lede">{isLeader ? "Review only the interruptions that need coordination. Classroom reality remains teacher-confirmed." : "See the expected lesson, then record what actually happened in a few seconds."}</p></div>
      <div className="continuity-rule"><Clock3 size={17} /><span>Schedule intent stays separate from classroom reality.<small>School time · {data.lessons[0]?.school_timezone || "configured timezone"}</small></span></div>
    </header>
    {isLeader && attention.length === 0 ? <section className="continuity-assurance" role="status"><Check size={17} /><div><strong>No unresolved continuity exceptions.</strong><span>Only lessons needing operational attention appear in this view.</span></div></section> : attention.length > 0 && <section className="continuity-attention" aria-labelledby="continuity-attention-title"><div><span className="section-kicker">Continuity attention</span><h2 id="continuity-attention-title">{attention.length} item{attention.length === 1 ? "" : "s"} need a look.</h2></div><div className="attention-list">{attention.slice(0, 4).map((lesson) => <div className="attention-item" key={lesson.lesson_id}><strong>{lesson.class_level_name} · {lesson.stream_name} · {lesson.subject_name}</strong><span>{lesson.carry_forward_state ? carryLabels[lesson.carry_forward_state] : ownStateLabels[lesson.lesson_state as keyof typeof ownStateLabels]}</span></div>)}</div></section>}
    <section className="continuity-body"><div className="section-title"><div><span className="section-kicker">{today.length ? "Today" : isLeader ? "Exceptions" : "Scheduled lessons"}</span><h2>{isLeader ? "Operational exceptions" : "Your lessons"}</h2><p>{isLeader ? "Department and school views are read-only. The assigned teacher owns confirmation and correction." : "A scheduled lesson is expected to happen. It is not treated as taught until you confirm it."}</p></div></div>{visibleLessons.length === 0 ? <div className="operations-empty"><span className="empty-icon"><Clock3 size={15} /></span><div><strong>{isLeader ? "No unresolved continuity exceptions." : "No lessons in the current continuity window."}</strong><p>{isLeader ? "Routine scheduled and confirmed lessons stay out of leadership exception views." : "Once an active timetable generates scheduled lessons, they will appear here."}</p></div></div> : <div className="continuity-list">{visibleLessons.map((lesson) => <LessonCard key={lesson.lesson_id} lesson={lesson} />)}</div>}</section>
  </div>;
}

function LessonCard({ lesson }: { lesson: ContinuityRow }) {
  const [pending, startTransition] = useTransition();
  const [formOutcome, setFormOutcome] = useState<ContinuityRow["outcome"]>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [correcting, setCorrecting] = useState(false);
  const [effectiveEventId, setEffectiveEventId] = useState(lesson.event_id);
  const [effectiveOutcome, setEffectiveOutcome] = useState(lesson.outcome);
  const confirmed = effectiveEventId !== null;
  const canConfirm = lesson.can_confirm && effectiveEventId === null;
  const canCorrect = lesson.can_correct || effectiveEventId !== null;
  const canAct = canConfirm || canCorrect;
  const visibleState = effectiveOutcome === "DELIVERED" ? "CLEAR" : effectiveOutcome === "PARTIALLY_DELIVERED" ? "PARTIAL_CARRY_FORWARD" : effectiveOutcome === "NOT_DELIVERED" ? "NOT_DELIVERED_CARRY_FORWARD" : effectiveOutcome === "CHANGED" ? "CHANGED_REVIEW" : lesson.lesson_state;
  const confirm = (outcome: NonNullable<ContinuityRow["outcome"]>, form?: HTMLFormElement) => {
    const values = form ? new FormData(form) : null;
    startTransition(async () => {
      const result = canCorrect ? await correctRecordedOutcome({ scheduledLessonId: lesson.lesson_id, priorEventId: effectiveEventId!, outcome, reason: String(values?.get("reason") || ""), note: String(values?.get("note") || "") }) : await recordClassroomOutcome({ scheduledLessonId: lesson.lesson_id, outcome, reason: String(values?.get("reason") || ""), note: String(values?.get("note") || "") });
      setMessage(result.ok ? `${canCorrect ? "Corrected" : "Confirmed"}: ${outcomeLabels[outcome]}.` : result.error);
      if (result.ok) { setEffectiveEventId(result.eventId); setEffectiveOutcome(outcome); setFormOutcome(null); setCorrecting(false); }
    });
  };
  return <article className={`lesson-card${lesson.lesson_state !== "CLEAR" && lesson.lesson_state !== "SCHEDULED" ? " needs-attention" : ""}`}>
    <div className="lesson-meta"><span>{formatTime(lesson.starts_at, lesson.school_timezone)}–{formatTime(lesson.ends_at, lesson.school_timezone)}</span><span>{lesson.class_level_name} · {lesson.stream_name}</span><span>{formatDate(lesson.starts_at, lesson.school_timezone)}</span></div>
    <div className="lesson-main"><div><h3>{lesson.subject_name}</h3><p>Scheduled lesson · expected timetable occurrence</p></div><StateLabel state={visibleState} /></div>
    {lesson.lesson_state !== "CLEAR" && lesson.lesson_state !== "SCHEDULED" && <p className="source-state-copy">{ownStateLabels[lesson.lesson_state as keyof typeof ownStateLabels]}</p>}
    {lesson.carry_forward_state && <div className="carry-forward-box"><strong>Continuity from previous lesson</strong><span>{carryLabels[lesson.carry_forward_state]}</span></div>}
    {effectiveOutcome && <div className="confirmed-line"><Check size={15} /><span><strong>{outcomeLabels[effectiveOutcome]}</strong>{lesson.confirmed_at ? ` · Recorded ${formatTime(lesson.confirmed_at, lesson.school_timezone)}` : ""}</span></div>}
    {message && <div className={`continuity-message${message.startsWith("Confirmed") || message.startsWith("Corrected") ? " success" : " error"}`} role="status"><span>{message.startsWith("Confirmed") || message.startsWith("Corrected") ? <Check size={15} /> : <AlertCircle size={15} />}</span>{message}</div>}
    {canAct && <div className="outcome-area">{(canConfirm || correcting) && <>{!formOutcome && <div className="outcome-actions"><button className="button button-primary" disabled={pending} onClick={() => confirm("DELIVERED")}>Delivered</button><button className="button" disabled={pending} onClick={() => setFormOutcome("PARTIALLY_DELIVERED")}>Partially delivered</button><button className="button" disabled={pending} onClick={() => setFormOutcome("NOT_DELIVERED")}>Not delivered</button><button className="button" disabled={pending} onClick={() => setFormOutcome("CHANGED")}>Changed</button></div>}{formOutcome && <form className="outcome-form" onSubmit={(event) => { event.preventDefault(); confirm(formOutcome, event.currentTarget); }}><strong>{outcomeLabels[formOutcome]}</strong>{(formOutcome === "NOT_DELIVERED" || formOutcome === "CHANGED") && <label>Reason <span>{formOutcome === "CHANGED" ? "(optional if note is supplied)" : ""}</span><input name="reason" required={formOutcome === "NOT_DELIVERED"} placeholder={formOutcome === "CHANGED" ? "What changed?" : "Choose a concise operational reason"} /></label>}{(formOutcome === "PARTIALLY_DELIVERED" || formOutcome === "CHANGED" || formOutcome === "NOT_DELIVERED") && <label>Note <span>{formOutcome === "CHANGED" ? "(required if no reason)" : "(optional)"}</span><textarea name="note" rows={2} required={formOutcome === "CHANGED"} placeholder="Add a short note for the next action" /></label>}<div className="action-row"><button className="button button-primary" disabled={pending}>{pending ? "Recording..." : canCorrect ? "Save correction" : "Record outcome"}</button><button type="button" className="button button-quiet" onClick={() => setFormOutcome(null)}>Cancel</button></div></form>}</>}{canCorrect && !correcting && <button className="text-button correction-button" onClick={() => setCorrecting(true)}><RotateCcw size={13} />Correct this record</button>}{canCorrect && correcting && <span className="correction-note">Correction preserves the original classroom record.</span>}</div>}
    {confirmed && !canAct && <p className="muted-note">Read-only classroom evidence.</p>}
  </article>;
}

function StateLabel({ state }: { state: ContinuityRow["lesson_state"] }) { const label = state === "SCHEDULED" ? "Scheduled" : state === "UNCONFIRMED" ? "Awaiting confirmation" : state === "CLEAR" ? "Confirmed" : "Continuity attention"; return <span className={`status ${state === "CLEAR" ? "status-positive" : state === "SCHEDULED" ? "status-neutral" : "status-attention"}`}>{label}</span>; }
