"use client";

import Link from "next/link";
import { useState } from "react";
import type { Role } from "@/domain/types";

type ReviewItem = { id: string; role: Role | "SYSTEM"; name: string; view?: string; purpose: string; form: "Mobile-first" | "Desktop-first" | "Responsive"; state: string; notes: string };

const items: ReviewItem[] = [
  { id: "teacher-home", role: "TEACHER", name: "Teacher Home", view: "home", purpose: "Next lesson, current class position and primary teacher actions.", form: "Mobile-first", state: "Shared persisted demo state", notes: "Reset demo data is available on this screen." },
  { id: "teacher-lesson", role: "TEACHER", name: "Lesson Readiness", view: "lesson", purpose: "Generate a structured readiness artifact from the current Teaching Section and Astra context.", form: "Mobile-first", state: "Current due lesson", notes: "Why this? reveals curriculum, teacher and provenance context." },
  { id: "teacher-outcome", role: "TEACHER", name: "Record Outcome", view: "outcome", purpose: "Record delivered, partial, missed/cancelled or changed-from-plan classroom reality.", form: "Mobile-first", state: "Current due lesson", notes: "Partial delivery reveals unfinished-work controls." },
  { id: "teacher-assessment", role: "TEACHER", name: "Assessment Builder", view: "assessment", purpose: "Choose assessment mode, calculate eligible scope, generate and review a structured draft.", form: "Responsive", state: "Current shared state; scope depends on confirmed outcomes", notes: "Assessment mode and selected streams are internal controls." },
  { id: "teacher-assessment-edit", role: "TEACHER", name: "Assessment Editing / Preview", view: "assessment", purpose: "Edit, add, reorder, delete, adjust marks/difficulty, finalize and export PDFs.", form: "Responsive", state: "Requires generated assessment draft", notes: "Open from Assessment Builder after generating a draft." },
  { id: "teacher-resources", role: "TEACHER", name: "Resources", view: "resources", purpose: "Review configured curriculum, school and ATE resource records with provenance.", form: "Mobile-first", state: "Configured resource fixtures", notes: "Request resources and Save controls are present but not fully wired." },
  { id: "teacher-ask-ate", role: "TEACHER", name: "Ask ATE", view: "lesson", purpose: "Contextual assistant entry point from the current lesson context.", form: "Mobile-first", state: "Lesson context", notes: "Currently represented by the Ask ATE action; no separate chat surface exists." },
  { id: "teacher-assignments", role: "TEACHER", name: "Teacher Assignment Confirmation", view: "timetable", purpose: "Show timetable-derived Teaching Sections and assignment confirmation copy.", form: "Responsive", state: "Configured timetable fixture", notes: "Embedded in Timetable Setup; no separate teacher route exists." },
  { id: "hod-department", role: "HOD", name: "Department Overview", view: "hod", purpose: "Coordinate Biology Teaching Sections and meaningful stream differences.", form: "Desktop-first", state: "Shared academic state", notes: "Derived from the same state as teacher outcome recording." },
  { id: "hod-drift", role: "HOD", name: "Stream Drift", view: "hod", purpose: "Show Senior 2 stream positions, status and unfinished work.", form: "Desktop-first", state: "Shared academic state", notes: "Embedded in Department Overview." },
  { id: "hod-common", role: "HOD", name: "Common Assessment Readiness", view: "hod", purpose: "Explain that common tests use intersection of confirmed-taught outcomes.", form: "Desktop-first", state: "Calculated on assessment selection", notes: "Displayed as an embedded readiness panel." },
  { id: "hod-resources", role: "HOD", name: "Department Resources", view: "resources", purpose: "Review configured resources available to department workflows.", form: "Desktop-first", state: "Configured resource fixtures", notes: "Uses the shared Resources surface; no HOD-specific resource view." },
  { id: "dos-timetable", role: "DOS", name: "Timetable Setup / Verification", view: "timetable", purpose: "Review configured timetable entries and assignment confirmation boundary.", form: "Desktop-first", state: "Configured extraction fixture", notes: "Confirm & activate is present but not wired to a transition." },
  { id: "dos-exceptions", role: "DOS", name: "Academic Exceptions", view: "dos", purpose: "Show operational exceptions after absorbability rules are applied.", form: "Desktop-first", state: "Derived from unfinished work", notes: "Empty state is represented when no cases are open." },
  { id: "dos-recovery", role: "DOS", name: "Recovery Decision", view: "dos", purpose: "Intended decision surface for recovery cases and DOS action.", form: "Desktop-first", state: "No dedicated state", notes: "No separate recovery decision workflow is currently implemented." },
  { id: "principal-health", role: "PRINCIPAL", name: "Academic Health", view: "principal", purpose: "Low-noise institutional summary of unconfirmed state and operational decisions.", form: "Desktop-first", state: "Derived shared state", notes: "No Principal drill-down route exists." },
  { id: "principal-drilldown", role: "PRINCIPAL", name: "Principal Drill-down / Summary Detail", view: "principal", purpose: "Expected detail view for institutional issues.", form: "Desktop-first", state: "No dedicated state", notes: "Only the summary surface exists." },
  { id: "system-design", role: "SYSTEM", name: "/design-system", view: "design", purpose: "Internal component and visual language reference.", form: "Responsive", state: "Static reference content", notes: "Reachable through the product sidebar despite being an internal surface." },
  { id: "system-role-switcher", role: "SYSTEM", name: "Role Switcher", purpose: "Switch between Teacher, HOD, DOS and Principal views.", form: "Responsive", state: "Local UI state", notes: "Embedded in the application shell." },
  { id: "system-reset", role: "SYSTEM", name: "Reset Demo Data", view: "home", purpose: "Reset persisted demo state to the configured baseline.", form: "Mobile-first", state: "Action on Teacher Home", notes: "Developer/demo control, not a product workflow." },
];

const roleNames: Record<ReviewItem["role"], string> = { TEACHER: "Teacher", HOD: "HOD", DOS: "DOS", PRINCIPAL: "Principal", SYSTEM: "System / internal" };

function openHref(item: ReviewItem, role: Role, state: string) {
  if (!item.view) return "#";
  const params = new URLSearchParams({ view: item.view, role });
  if (state === "fresh") params.set("reset", "1");
  return `/?${params.toString()}`;
}

export default function UIReviewPage() {
  const [role, setRole] = useState<Role>("TEACHER");
  const [state, setState] = useState("shared");
  const groups = (["TEACHER", "HOD", "DOS", "PRINCIPAL", "SYSTEM"] as const).map((group) => ({ group, items: items.filter((item) => item.role === group) }));
  return <main className="content" style={{ maxWidth: 1280 }}><div className="page-heading"><div><div className="eyebrow">Developer-only review index</div><h1>ATE UI inventory</h1><p className="lede">Every implemented surface and known gap, linked into the current application. This route is intentionally excluded from product navigation.</p></div><div className="button-row"><label>Open as<select value={role} onChange={(event) => setRole(event.target.value as Role)}><option value="TEACHER">Teacher</option><option value="HOD">HOD</option><option value="DOS">DOS</option><option value="PRINCIPAL">DOS / Principal context</option></select></label><label>State<select value={state} onChange={(event) => setState(event.target.value)}><option value="shared">Current shared state</option><option value="fresh">Fresh demo state</option></select></label></div></div><div className="callout" style={{ marginBottom: 24 }}><strong>Review mode</strong>Links open the current app at the selected surface. Fresh demo state resets browser-persisted demo data before opening. No screenshots are fabricated here.</div>{groups.map(({ group, items: groupItems }) => <section key={group} style={{ marginBottom: 28 }}><div className="panel-header"><div><div className="eyebrow">{roleNames[group]}</div><h2>{groupItems.length} inventory entries</h2></div></div><div className="grid grid-2">{groupItems.map((item) => <article className="panel" key={item.id}><div className="panel-header"><div><h3>{item.name}</h3><p>{item.form}</p></div><span className={`status ${item.view ? "status-green" : "status-amber"}`}>{item.view ? "Open" : "Missing"}</span></div><p className="lede">{item.purpose}</p><div className="list" style={{ marginTop: 12 }}><div className="list-row"><div><strong>State</strong><span>{item.state}</span></div></div><div className="list-row"><div><strong>Notes</strong><span>{item.notes}</span></div></div></div>{item.view ? <Link className="button button-secondary" style={{ marginTop: 14, textDecoration: "none" }} href={openHref(item, role, state)}>Open current screen</Link> : <span className="status status-amber" style={{ marginTop: 14 }}>Not implemented</span>}</article>)}</div></section>)}</main>;
}
