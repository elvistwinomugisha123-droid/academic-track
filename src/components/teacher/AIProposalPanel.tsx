"use client";

import { Check, CircleAlert, RotateCcw, ShieldAlert, X } from "lucide-react";
import type { AIProposal } from "@/teacher/application/ai-artifact-actions";

export function AIProposalPanel({ proposal, pending, onAccept, onReject }: { proposal: Extract<AIProposal, { ok: true }>; pending: boolean; onAccept: () => void; onReject: () => void }) {
  return <section className="ai-proposal-panel" aria-labelledby="ai-proposal-title">
    <div className="ai-proposal-heading"><div><span className="section-kicker">Teacher review required</span><h3 id="ai-proposal-title">ATE proposal — not saved</h3><p>Review the structured result before it becomes a new immutable version.</p></div><span className="status status-info"><ShieldAlert size={13} />{proposal.model}</span></div>
    <div className="ai-proposal-summary"><span>Proposed {proposal.artifactType.replaceAll("_", " ").toLowerCase()}</span><span>Prompt {proposal.runId.slice(0, 8)}</span><span>Current context checked</span></div>
    <pre className="ai-proposal-preview" tabIndex={0}>{JSON.stringify(proposal.content, null, 2)}</pre>
    <div className="action-row"><button className="button button-primary" type="button" onClick={onAccept} disabled={pending}><Check size={15} />{pending ? "Saving accepted version…" : "Accept and save new version"}</button><button className="button button-quiet" type="button" onClick={onReject} disabled={pending}><X size={15} />Reject</button></div>
  </section>;
}

export function AIProposalError({ message }: { message: string }) {
  return <div className="teacher-message error" role="alert"><CircleAlert size={16} />{message}</div>;
}

export function AIProposalHint() {
  return <span className="provenance"><RotateCcw size={13} />Nothing is saved until you accept the proposal.</span>;
}
