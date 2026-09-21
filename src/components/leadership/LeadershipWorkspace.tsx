"use client";

import { ArrowRight, Check, CircleAlert, ClipboardCheck, Clock3, GitCompareArrows, Info, RotateCcw, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { reviewAssessmentWorkspace } from "@/assessment/application/actions";
import type { LeadershipOverviewData } from "@/leadership/application/queries";

function text(value: unknown) { return typeof value === "string" ? value : ""; }
function number(value: unknown) { return typeof value === "number" ? value : 0; }
function list(value: unknown): Array<Record<string, unknown>> { return Array.isArray(value) ? value as Array<Record<string, unknown>> : []; }
function label(value: string) { return value.replaceAll("_", " ").toLowerCase().replace(/(^|\s)\S/g, (letter) => letter.toUpperCase()); }
function date(value: unknown) { const raw = text(value); if (!raw) return "No date"; return new Intl.DateTimeFormat("en-UG", { day: "numeric", month: "short", year: "numeric" }).format(new Date(raw)); }

const scopeCopy = {
  HOD: { title: "Department Pulse", description: "Coordinate meaningful department exceptions and stream differences from teacher-confirmed facts.", eyebrow: "Department operations" },
  DOS: { title: "Academic Operations", description: "Act on school-wide timetable, continuity, curriculum setup and programme exceptions.", eyebrow: "School operations" },
  PRINCIPAL: { title: "Academic Assurance", description: "See the material academic issues that require institutional attention without routine teacher-level detail.", eyebrow: "Executive visibility" },
} as const;

function StateIcon({ category }: { category: string }) { return category === "ACTION_REQUIRED" ? <CircleAlert size={16} aria-hidden="true" /> : category === "REVIEW" ? <Clock3 size={16} aria-hidden="true" /> : <Info size={16} aria-hidden="true" />; }

function SummaryBand({ data }: { data: LeadershipOverviewData }) {
  const summary = data.overview.summary;
  const values = [
    ["Unconfirmed", summary.unconfirmed, "past lessons without an outcome"],
    ["Continuity breaks", summary.partiallyDelivered + summary.notDelivered + summary.changed, "partial, missed or changed"],
    ["Position review", summary.curriculumReviewRequired, "missing or unusable governed position"],
    ["Stream drift", summary.streamDrift, "parallel sections with a difference"],
  ];
  return <div className="leadership-summary-band" aria-label="Academic operations summary">{values.map(([title, count, detail]) => <div className="leadership-summary-item" key={String(title)}><span>{title}</span><strong>{count}</strong><small>{detail}</small></div>)}</div>;
}

function AttentionQueue({ items }: { items: Array<Record<string, unknown>> }) {
  return <section className="leadership-panel attention-panel" aria-labelledby="attention-heading"><div className="leadership-panel-heading"><div><span className="section-kicker">Deterministic queue</span><h2 id="attention-heading">Needs attention</h2><p>Every item below is derived from an authorised operational record. No urgency score is inferred.</p></div><span className="leadership-count">{items.length} {items.length === 1 ? "item" : "items"}</span></div>{items.length === 0 ? <div className="leadership-empty"><ShieldCheck size={18} /><div><strong>No academic exceptions currently require action.</strong><p>New continuity, curriculum or assessment facts will appear here when they need this scope.</p></div></div> : <div className="attention-list">{items.slice(0, 18).map((item) => <a className={`attention-row ${text(item.category).toLowerCase()}`} href={text(item.safeDestination) || "#attention-heading"} key={text(item.id)}><span className="attention-icon"><StateIcon category={text(item.category)} /></span><span className="attention-main"><strong>{text(item.reason)}</strong><small>{text(item.subject)}{text(item.classLevel) ? ` · ${text(item.classLevel)}` : ""}{text(item.stream) ? ` · ${text(item.stream)}` : ""} · {date(item.relevantDate)}</small></span><span className="attention-meta"><em>{label(text(item.category))}</em><ArrowRight size={15} /></span></a>)}</div>}</section>;
}

function SectionList({ sections }: { sections: Array<Record<string, unknown>> }) {
  return <section className="leadership-panel" aria-labelledby="sections-heading"><div className="leadership-panel-heading"><div><span className="section-kicker">Operational units</span><h2 id="sections-heading">Teaching Sections</h2><p>Each stream remains independently stateful. Current position is shown only when its governed record is usable.</p></div></div>{sections.length === 0 ? <div className="leadership-empty"><Info size={18} /><div><strong>No Teaching Sections are visible in this scope.</strong><p>Check the active role grant or school academic setup.</p></div></div> : <div className="section-operations-list">{sections.map((section) => { const states = list(section.lessonStates); return <article className="section-operation-row" id={`section-${text(section.id)}`} key={text(section.id)}><div className="section-operation-identity"><strong>{text(section.subject)} · {text(section.classLevel)}</strong><span>{text(section.stream)} · {text(section.teacher)}</span><small>{text(section.department)} · {text(section.period)}</small></div><div className="section-operation-position"><span className={`position-state ${text(section.positionStatus).toLowerCase()}`}>{text(section.positionStatusLabel)}</span><strong>{text(section.currentPosition) || "Curriculum position unavailable"}</strong>{text(section.positionConfirmedAt) && <small>Confirmed {date(section.positionConfirmedAt)}</small>}</div><div className="section-operation-lessons">{states.length === 0 ? <span className="muted-note">No recent exception</span> : states.slice(0, 3).map((state) => <span className={`mini-state ${text(state.state).toLowerCase()}`} key={text(state.lessonId)}>{label(text(state.state))} · {date(state.date)}</span>)}</div></article>; })}</div>}</section>;
}

function DriftList({ drift }: { drift: Array<Record<string, unknown>> }) {
  return <section className="leadership-panel" aria-labelledby="drift-heading"><div className="leadership-panel-heading"><div><span className="section-kicker">Coordination signal</span><h2 id="drift-heading">Parallel-stream alignment</h2><p>Position comparison uses governed ordering when available. Dates alone do not establish equivalence.</p></div></div>{drift.length === 0 ? <div className="leadership-inline-empty"><GitCompareArrows size={16} /><span>No measurable stream drift is currently recorded in this scope.</span></div> : <div className="drift-list">{drift.map((item) => <div className="drift-row" key={`${text(item.leftSectionId)}:${text(item.rightSectionId)}`}><GitCompareArrows size={16} /><span><strong>{text(item.subject)} · {text(item.classLevel)}</strong><small>{text(item.leftStream)} and {text(item.rightStream)}</small></span><em className={text(item.alignment).toLowerCase()}>{label(text(item.alignment))}</em></div>)}</div>}</section>;
}

function AssessmentReviewList({ data }: { data: LeadershipOverviewData }) {
  const [busyId, setBusyId] = useState("");
  const [message, setMessage] = useState("");
  const reviewable = data.overview.assessments.filter((assessment) => Boolean(assessment.canReview));
  async function decide(id: string, decision: "APPROVE" | "RETURN") {
    setMessage("");
    const reason = decision === "RETURN" ? window.prompt("Give the teacher a reason for returning this assessment to draft.") || "" : "";
    if (decision === "RETURN" && !reason.trim()) return;
    setBusyId(id);
    const result = await reviewAssessmentWorkspace(id, decision, reason);
    setBusyId("");
    setMessage(result.ok ? decision === "APPROVE" ? "Assessment approved and finalised." : "Assessment returned to the teacher with a recorded reason." : result.error || "Assessment review failed.");
    if (result.ok) window.location.reload();
  }
  return <section className="leadership-panel" aria-labelledby="assessment-heading"><div className="leadership-panel-heading"><div><span className="section-kicker">Assessment Studio handoff</span><h2 id="assessment-heading">Assessment review</h2><p>Only submitted versions enter this view. Ordinary teacher drafts remain private.</p></div></div>{data.overview.assessments.length === 0 ? <div className="leadership-inline-empty"><ClipboardCheck size={16} /><span>No submitted or final assessments are visible in this role scope.</span></div> : <div className="assessment-review-list">{data.overview.assessments.map((assessment) => <div className="assessment-review-row" id={`assessment-${text(assessment.id)}`} key={text(assessment.id)}><div><strong>{text(assessment.title)}</strong><span>{text(assessment.subject)} · {label(text(assessment.purpose))} · {number(assessment.totalMarks)} marks</span><small>{text(assessment.status) === "IN_REVIEW" ? `Submitted ${date(assessment.submittedAt)}` : `Finalised ${date(assessment.finalisedAt)}`}</small></div><div className="assessment-review-actions"><span className={`assessment-status ${text(assessment.status).toLowerCase()}`}>{label(text(assessment.status))}</span>{Boolean(assessment.canReview) && <><Link className="text-button" href={`/workspace/leadership/assessments/${text(assessment.id)}`}>Open review</Link><button className="text-button" disabled={busyId === text(assessment.id)} onClick={() => decide(text(assessment.id), "APPROVE")}>{busyId === text(assessment.id) ? "Saving…" : "Approve"}</button><button className="text-button danger" disabled={busyId === text(assessment.id)} onClick={() => decide(text(assessment.id), "RETURN")}>Return</button></>}</div></div>)}</div>}{message && <p className="form-success" role="status">{message}</p>}</section>;
}

function PrincipalSignals({ data }: { data: LeadershipOverviewData }) {
  return <section className="leadership-panel principal-signals" aria-labelledby="department-heading"><div className="leadership-panel-heading"><div><span className="section-kicker">Institutional view</span><h2 id="department-heading">Department exceptions</h2><p>Aggregated operational signals keep the Principal out of timetable administration and private teacher work.</p></div></div>{data.overview.departments.length === 0 ? <div className="leadership-inline-empty"><Info size={16} /><span>No active department data is available.</span></div> : <div className="department-signal-list">{data.overview.departments.map((department) => <div className="department-signal-row" key={text(department.id)}><span><strong>{text(department.name)}</strong><small>{number(department.sectionCount)} Teaching Sections in scope</small></span><strong className={number(department.exceptionCount) > 0 ? "has-exceptions" : "quiet-exceptions"}>{number(department.exceptionCount)} {number(department.exceptionCount) === 1 ? "exception" : "exceptions"}</strong></div>)}</div>}</section>;
}

function ProgrammeList({ items }: { items: Array<Record<string, unknown>> }) {
  return <section className="leadership-panel" aria-labelledby="programme-heading"><div className="leadership-panel-heading"><div><span className="section-kicker">Programme facts</span><h2 id="programme-heading">Disruptions affecting teaching</h2><p>These are scheduled programme events overlapping expected lessons. They are not classroom outcomes.</p></div></div>{items.length === 0 ? <div className="leadership-inline-empty"><Info size={16} /><span>No scheduled programme events currently overlap visible lessons.</span></div> : <div className="programme-list">{items.slice(0, 12).map((item) => <div className="programme-row" key={`${text(item.lessonId)}:${text(item.programmeEventId)}`}><span><strong>{text(item.title)}</strong><small>{label(text(item.type))} · affects a Teaching Section</small></span><time>{date(item.startsAt)}</time></div>)}</div>}</section>;
}

export function LeadershipWorkspace({ data }: { data: LeadershipOverviewData }) {
  const copy = scopeCopy[data.overview.scope];
  const principal = data.overview.scope === "PRINCIPAL";
  return <main className="leadership-page"><header className="leadership-heading"><div><p className="eyebrow">{copy.eyebrow}</p><h1>{copy.title}</h1><p className="lede">{copy.description}</p></div><div className="leadership-heading-note"><ShieldCheck size={17} /><span>Authorised operational facts<br /><small>{data.access.displayName} · {data.overview.scope}</small></span></div></header><SummaryBand data={data} /><AttentionQueue items={data.overview.attention} /><div className="leadership-two-column">{principal ? <PrincipalSignals data={data} /> : <SectionList sections={data.overview.sections} />}<DriftList drift={data.overview.drift} /></div><AssessmentReviewList data={data} /><ProgrammeList items={data.overview.programmeDisruptions} /></main>;
}
