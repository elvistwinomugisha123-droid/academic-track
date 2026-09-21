"use client";

import { ArrowLeft, Check, ClipboardCheck, RotateCcw, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { reviewAssessmentWorkspace } from "@/assessment/application/actions";
import type { AssessmentReviewData } from "@/leadership/application/queries";

function text(value: unknown) { return typeof value === "string" ? value : ""; }
function list(value: unknown): Array<Record<string, unknown>> { return Array.isArray(value) ? value as Array<Record<string, unknown>> : []; }
function strings(value: unknown): string[] { return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []; }
function label(value: string) { return value.replaceAll("_", " ").toLowerCase().replace(/(^|\s)\S/g, (letter) => letter.toUpperCase()); }

export function AssessmentReviewWorkspace({ data }: { data: AssessmentReviewData }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const content = data.version?.content || {};
  const questions = list(content.questions);
  const inReview = data.workspace.status === "IN_REVIEW";
  async function decide(decision: "APPROVE" | "RETURN") {
    setMessage("");
    const reason = decision === "RETURN" ? window.prompt("Give the teacher a reason for returning this assessment to draft.") || "" : "";
    if (decision === "RETURN" && !reason.trim()) return;
    setBusy(true);
    const result = await reviewAssessmentWorkspace(data.workspace.id, decision, reason);
    setBusy(false);
    setMessage(result.ok ? decision === "APPROVE" ? "Assessment approved and finalised." : "Assessment returned to draft with the recorded reason." : result.error || "Assessment review failed.");
    if (result.ok) window.location.assign("/workspace/leadership/dos");
  }
  return <main className="assessment-review-page"><div className="assessment-back-row"><Link className="back-link" href="/workspace/leadership/dos"><ArrowLeft size={14} />Academic operations</Link><span className={`assessment-status ${inReview ? "in_review" : "final"}`}><ClipboardCheck size={13} />{label(data.workspace.status)} · v{data.version?.versionNumber || "submitted"}</span></div><header className="leadership-heading"><div><p className="eyebrow">Submitted assessment</p><h1>{data.workspace.title}</h1><p className="lede">Review the submitted version against its governed scope. The teacher’s private draft history remains outside this view.</p></div><div className="leadership-heading-note"><ShieldCheck size={17} /><span>Academic review<br /><small>{data.workspace.status} · {data.workspace.totalMarks} marks · {data.workspace.durationMinutes} minutes</small></span></div></header><section className="review-context-strip"><div><span>Purpose</span><strong>{label(data.workspace.purpose)}</strong></div><div><span>Assessment date</span><strong>{data.workspace.assessmentDate}</strong></div><div><span>Teaching Sections</span><strong>{data.sections.length}</strong></div><div><span>Version</span><strong>{data.version?.versionNumber || "Final"}</strong></div></section><section className="leadership-panel review-paper-panel"><div className="leadership-panel-heading"><div><span className="section-kicker">Submitted version</span><h2>{text(content.title) || data.workspace.title}</h2><p>{"Read-only submitted assessment content for authorised academic review."}</p></div></div>{data.version ? <div className="review-question-list">{questions.length === 0 ? <div className="leadership-empty"><ClipboardCheck size={18} /><div><strong>No questions are present in the submitted version.</strong><p>The deterministic submission gate should prevent this state; return it if encountered.</p></div></div> : questions.map((question, index) => <article className="review-question" key={text(question.id) || String(index)}><div className="review-question-number">{index + 1}</div><div><strong>{text(question.text)}</strong><small>{text(question.itemType)} · {text(question.difficulty)} · {question.marks ? `${question.marks} marks` : "Marks not recorded"}</small><p>Curriculum scope: {strings(question.canonicalIds).join(", ") || "Not listed"}</p><details><summary>Marking guide</summary><p>{strings(question.markingGuide).join("; ") || "No marking guide recorded"}</p></details></div></article>)}</div> : <div className="leadership-inline-empty"><ShieldCheck size={16} /><span>This final assessment is visible as metadata only; question content is not exposed in this review surface.</span></div>}</section><section className="leadership-panel review-history-panel"><div className="leadership-panel-heading"><div><span className="section-kicker">Decision history</span><h2>Review record</h2><p>Review decisions are append-only and preserve the submitted version history.</p></div></div><div className="review-history-list">{data.history.map((event, index) => <div className="review-history-row" key={`${text(event.createdAt)}:${index}`}><span>{label(text(event.eventType))}</span><strong>{text(event.actor)}</strong><small>{text(event.reason) || "No reason recorded"}</small></div>)}</div></section>{inReview && <section className="assessment-finalise-panel review-decision-panel"><div><span className="section-kicker">Authorised decision</span><h2>Record the academic review</h2><p>Approve to make this exact submitted version final, or return it so the teacher can create a new draft version.</p></div><div className="assessment-review-decision-actions"><button className="button" disabled={busy} onClick={() => decide("RETURN")}><RotateCcw size={15} />Return to draft</button><button className="button button-primary" disabled={busy} onClick={() => decide("APPROVE")}><Check size={15} />Approve and finalise</button></div></section>}{message && <p className="form-error" role="status">{message}</p>}</main>;
}
