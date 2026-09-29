"use client";

import { Check, CircleAlert, RotateCcw, ShieldAlert, X } from "lucide-react";
import type { AIProposal } from "@/teacher/application/ai-artifact-actions";
import { parseLessonPayload } from "@/artifacts/lesson";
import { ArtifactDocument } from "./ArtifactDocument";
import { lessonArtifactRenderModel } from "@/artifacts/lesson-render";
import type { CanonicalArtifactVersion } from "@/artifacts/types";

function previewModel(proposal: Extract<AIProposal, { ok: true }>) {
  const payload = parseLessonPayload(proposal.artifactType, proposal.content);
  return lessonArtifactRenderModel({ artifactType: proposal.artifactType, artifactId: proposal.artifactId || "proposal", versionId: proposal.runId, status: "DRAFT", ownerScope: proposal.scheduledLessonId, curriculumAnchorIds: [], provenance: [], payload } as unknown as Exclude<CanonicalArtifactVersion, { artifactType: "ASSESSMENT" }>);
}

export function AIProposalPanel({ proposal, pending, onAccept, onReject }: { proposal: Extract<AIProposal, { ok: true }>; pending: boolean; onAccept: () => void; onReject: () => void }) {
  const model = previewModel(proposal);
  return <section className="ai-proposal-panel" aria-labelledby="ai-proposal-title">
    <div className="ai-proposal-heading"><div><span className="section-kicker">Teacher review required</span><h3 id="ai-proposal-title">Your draft is ready</h3><p>Read through the document. Save it when it feels right for your class.</p></div><span className="status status-info"><ShieldAlert size={13} />Not saved yet</span></div>
    <ArtifactDocument model={model} />
    <div className="action-row"><button className="button button-primary" type="button" onClick={onAccept} disabled={pending}><Check size={15} />{pending ? "Saving accepted version…" : "Accept and save new version"}</button><button className="button button-quiet" type="button" onClick={onReject} disabled={pending}><X size={15} />Reject</button></div>
  </section>;
}

export function AIProposalError({ message }: { message: string }) {
  return <div className="teacher-message error" role="alert"><CircleAlert size={16} />{message}</div>;
}

export function AIProposalHint() {
  return <span className="provenance"><RotateCcw size={13} />Nothing is saved until you accept the proposal.</span>;
}
