"use client";

import { useState, useTransition } from "react";
import { AlertCircle, Check, Clock3, RotateCcw } from "lucide-react";
import type { ClassroomContinuityData, ContinuityRow } from "@/classroom-continuity/application/queries";
import { correctRecordedOutcome, recordClassroomOutcome } from "@/classroom-continuity/application/ui-actions";

const outcomeLabels = { DELIVERED: "Delivered", PARTIALLY_DELIVERED: "Partially delivered", NOT_DELIVERED: "Not delivered", CHANGED: "Changed" } as const;
const continuityLabels = { PARTIAL_CARRY_FORWARD: "Previous lesson partially delivered.", NOT_DELIVERED_CARRY_FORWARD: "Previous scheduled lesson was not delivered.", CHANGED_REVIEW: "Previous lesson changed from the timetable.", UNCONFIRMED: "This scheduled lesson is awaiting confirmation." } as const;

export function ClassroomContinuityWorkspace({ data }: { data: ClassroomContinuityData }) {
  const isLeader = data.scope !== "MY";
  const today = data.lessons.filter((lesson) => lesson.is_today);
  const attention = data.lessons.filter((lesson) => ["PARTIAL_CARRY_FORWARD", "NOT_DELIVERED_CARRY_FORWARD", "CHANGED_REVIEW", "UNCONFIRMED"].includes(lesson.continuity_state));
  const ordered = [...today, ...data.lessons.filter((lesson) => !lesson.is_today)];
  return <div className="continuity-page">
    <header className="continuity-heading">
      <div><p className="eyebrow">{isLeader ? "Operational continuity" : "My classroom"}</p><h1>{isLeader ? data.scope === "DEPARTMENT" ? "Department continuity." : "Academic continuity." : "What happened in class?"}</h1><p className="lede">{isLeader ? "Review only the interruptions that need coordination. Classroom reality remains teacher-confirmed." : "See the expected lesson, then record what actually happened in a few seconds."}</p></div>
      <div className="continuity-rule"><Clock3 size={17} /><span>Schedule intent stays separate from classroom reality.</span></div>
    </header>
    {attention.length > 0 && <section className="continuity-attention" aria-labelledby="continuity-attention-title"><div><span className="section-kicker">Continuity attention</span><h2 id="continuity-attention-title">{attention.length} item{attention.length === 1 ? "" : "s"} need a look.</h2></div><div className="attention-list">{attention.slice(0, 4).map((lesson) => <div className="attention-item" key={lesson.lesson_id}><strong>{lesson.class_level_name} · {lesson.stream_name} · {lesson.subject_name}</strong><span>{continuityLabels[lesson.continuity_state as keyof typeof continuityLabels] || lesson.continuity_state}</span></div>)}</div></section>}
    <section className="continuity-body"><div className="section-title"><div><span className="section-kicker">{today.length ? "Today" : "Scheduled lessons"}</span><h2>{isLeader ? "Operational exceptions" : "Your lessons"}</h2><p>{isLeader ? "Department and school views are read-only. The assigned teacher owns confirmation and correction." : "A scheduled lesson is expected to happen. It is not treated as taught until you confirm it."}</p></div></div>{ordered.length === 0 ? <div className="operations-empty"><span className="empty-icon"><Clock3 size={15} /></span><div><strong>No lessons in the current continuity window.</strong><p>Once an active timetable generates scheduled lessons, they will appear here.</p></div></div> : <div className="continuity-list">{ordered.map((lesson) => <LessonCard key={lesson.lesson_id} lesson={lesson} readOnly={isLeader && lesson.teacher_membership_id !== data.access.membershipId} />)}</div>}</section>
  </div>;
}

function LessonCard({ lesson, readOnly }: { lesson: ContinuityRow; readOnly: boolean }) {
  const [pending, startTransition] = useTransition();
  const [formOutcome, setFormOutcome] = useState<ContinuityRow["outcome"]>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [correcting, setCorrecting] = useState(false);
  const confirmed = lesson.event_id !== null;
  const label = new Intl.DateTimeFormat("en-UG", { hour: "numeric", minute: "2-digit" }).format(new Date(lesson.starts_at));
  const confirm = (outcome: NonNullable<ContinuityRow["outcome"]>, form?: HTMLFormElement) => {
    const values = form ? new FormData(form) : null;
    startTransition(async () => {
      const result = confirmed ? await correctRecordedOutcome({ scheduledLessonId: lesson.lesson_id, priorEventId: lesson.event_id, outcome, reason: String(values?.get("reason") || ""), note: String(values?.get("note") || "") }) : await recordClassroomOutcome({ scheduledLessonId: lesson.lesson_id, outcome, reason: String(values?.get("reason") || ""), note: String(values?.get("note") || "") });
      setMessage(result.ok ? `${confirmed ? "Corrected" : "Confirmed"}: ${outcomeLabels[outcome]}.` : result.error);
      if (result.ok) { setFormOutcome(null); setCorrecting(false); }
    });
  };
  return <article className={`lesson-card${lesson.continuity_state !== "CLEAR" && lesson.continuity_state !== "SCHEDULED" ? " needs-attention" : ""}`}>
    <div className="lesson-meta"><span>{label}</span><span>{lesson.class_level_name} · {lesson.stream_name}</span></div>
    <div className="lesson-main"><div><h3>{lesson.subject_name}</h3><p>Scheduled lesson · {lesson.scheduled_date}</p></div><StateLabel lesson={lesson} /></div>
    {lesson.continuity_state !== "CLEAR" && lesson.continuity_state !== "SCHEDULED" && <p className="continuity-copy">{continuityLabels[lesson.continuity_state as keyof typeof continuityLabels] || "Operational continuity needs attention."}</p>}
    {lesson.outcome && <div className="confirmed-line"><Check size={15} /><span><strong>{outcomeLabels[lesson.outcome]}</strong>{lesson.confirmed_at ? ` · Recorded ${new Intl.DateTimeFormat("en-UG", { hour: "numeric", minute: "2-digit" }).format(new Date(lesson.confirmed_at))}` : ""}</span></div>}
    {message && <div className={`continuity-message${message.startsWith("Confirmed") || message.startsWith("Corrected") ? " success" : " error"}`} role="status"><span>{message.startsWith("Confirmed") || message.startsWith("Corrected") ? <Check size={15} /> : <AlertCircle size={15} />}</span>{message}</div>}
    {!readOnly && lesson.is_confirmable && <div className="outcome-area">{!confirmed || correcting ? <>{!formOutcome && <div className="outcome-actions"><button className="button button-primary" disabled={pending} onClick={() => confirm("DELIVERED")}>Delivered</button><button className="button" disabled={pending} onClick={() => setFormOutcome("PARTIALLY_DELIVERED")}>Partially delivered</button><button className="button" disabled={pending} onClick={() => setFormOutcome("NOT_DELIVERED")}>Not delivered</button><button className="button" disabled={pending} onClick={() => setFormOutcome("CHANGED")}>Changed</button></div>}{formOutcome && <form className="outcome-form" onSubmit={(event) => { event.preventDefault(); confirm(formOutcome, event.currentTarget); }}><strong>{outcomeLabels[formOutcome]}</strong>{(formOutcome === "NOT_DELIVERED" || formOutcome === "CHANGED") && <label>Reason<input name="reason" required placeholder={formOutcome === "CHANGED" ? "What changed?" : "Choose a concise operational reason"} /></label>}{(formOutcome === "PARTIALLY_DELIVERED" || formOutcome === "CHANGED" || formOutcome === "NOT_DELIVERED") && <label>Note <span>(optional)</span><textarea name="note" rows={2} placeholder="Add a short note for the next action" /></label>}<div className="action-row"><button className="button button-primary" disabled={pending}>{pending ? "Recording..." : confirmed ? "Save correction" : "Record outcome"}</button><button type="button" className="button button-quiet" onClick={() => setFormOutcome(null)}>Cancel</button></div></form>}</> : confirmed && <button className="text-button correction-button" onClick={() => setCorrecting(true)}><RotateCcw size={13} />Correct this record</button>}{confirmed && correcting && <span className="correction-note">Correction preserves the original classroom record.</span>}</div>}
  </article>;
}

function StateLabel({ lesson }: { lesson: ContinuityRow }) { const label = lesson.continuity_state === "SCHEDULED" ? "Scheduled" : lesson.continuity_state === "UNCONFIRMED" ? "Awaiting confirmation" : lesson.continuity_state === "CLEAR" ? "Confirmed" : "Continuity attention"; return <span className={`status ${lesson.continuity_state === "CLEAR" ? "status-positive" : lesson.continuity_state === "SCHEDULED" ? "status-neutral" : "status-attention"}`}>{label}</span>; }
