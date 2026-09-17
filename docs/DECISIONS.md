# Product & Architecture Decisions — Academic Track Engine

> **HISTORICAL PROTOTYPE DECISIONS:** Decisions in this file require review against `AGENTS.md` and `docs/ATE_V1_PRODUCT_SPEC.md`. They do not override the September 2026 ATE v1 rebuild contract.

This file records accepted decisions.

New implementation should follow these unless a later decision explicitly supersedes them.

---

## D001 — Teacher-first product model

**Status:** Accepted

**Decision:**  
ATE must deliver direct teacher value before leadership visibility.

**Reason:**  
If teacher interaction exists primarily to feed management dashboards, adoption and data quality will degrade.

---

## D002 — Teaching Section is the primary implementation unit

**Status:** Accepted

**Decision:**  
Parallel streams are represented as separate Teaching Sections.

**Reason:**  
They can have different teachers, schedules, interruptions, positions, and unfinished work.

---

## D003 — Missing outcome means UNCONFIRMED

**Status:** Accepted

**Decision:**  
A scheduled lesson with no teacher outcome is `UNCONFIRMED`.

**Rejected:**  
Inferring missed lesson or teacher absence.

---

## D004 — AI does not establish institutional truth

**Status:** Accepted

**Decision:**  
AI may propose. Authorized humans confirm facts and consequential actions.

---

## D005 — Class Test scope is confirmed-taught content

**Status:** Accepted

**Decision:**  
Class Test mode may use only confirmed-taught eligible learning outcomes.

**Exception:**  
Diagnostic mode can intentionally include untaught content because its purpose is different.

---

## D006 — Common Stream Test uses intersection scope

**Status:** Accepted

**Decision:**  
The eligible scope for a common test is the intersection of confirmed-taught eligible outcomes across all selected Teaching Sections.

---

## D007 — No teacher speed index

**Status:** Accepted

**Decision:**  
Do not model "teaching speed" as a teacher trait.

**Reason:**  
Pace is contextual and a teacher-level score creates surveillance and poor pedagogical incentives.

---

## D008 — Leadership sees progressive aggregation

**Status:** Accepted

**Decision:**  
Information escalates only when the role has a reason to act.

Teacher → HOD → DOS → Principal is not universal visibility; it is progressive resolution.

---

## D009 — HOD does not approve every lesson

**Status:** Accepted

**Decision:**  
Routine lesson preparation remains teacher-controlled.

HOD participates by exception, department coordination, common assessment, resource approval, or teacher-requested review.

---

## D010 — Recovery begins with absorbability

**Status:** Accepted

**Decision:**  
Unfinished work does not automatically create a major recovery workflow.

First determine whether normal future teaching can reasonably absorb it.

---

## D011 — Curriculum progress is not learner mastery

**Status:** Accepted

**Decision:**  
ATE distinguishes curriculum implementation from evidence of learner understanding.

Do not label addressed curriculum as mastered.

---

## D012 — Curriculum data is structured authority

**Status:** Accepted

**Decision:**  
The application consumes structured curriculum entities with provenance.

Do not send entire source PDFs on every AI request when deterministic exact entities are known.

---

## D013 — Resources have provenance

**Status:** Accepted

**Decision:**  
Curriculum-suggested, school-provided, ATE-generated, and external resources must remain visibly distinct.

---

## D014 — Textbook references must be verified

**Status:** Accepted

**Decision:**  
ATE must not invent book titles, chapters, pages, editions, or identifiers.

Exact references require evidence.

---

## D015 — Product is not a general school ERP

**Status:** Accepted

**Decision:**  
ATE owns the academic implementation layer.

General administration should remain outside scope unless later integration is justified.

---

## D016 — Initial architecture stays simple

**Status:** Accepted

**Decision:**  
Use a Next.js-based implementation with typed local state, structured curriculum data, server AI routes, and browser persistence for the initial release.

Do not add enterprise infrastructure preemptively.

---

## D017 — Live AI is not allowed to control deterministic workflow state

**Status:** Accepted

**Decision:**  
Timetable conflicts, assessment eligibility, stream intersection, role escalation, and record state are deterministic.

AI may explain the result.

---

## D018 — Visual references are advisory only

**Status:** Accepted

**Decision:**  
Screenshots in `reference-ui/` communicate design direction, not product truth.

---

## D019 — Initial academic configuration is configurable

**Status:** Accepted

**Decision:**  
Mount of Olives, Biology, S1/S2, and East/West/North are initial configuration values.

Presentational components must not hard-code them.

---

## D020 — Assessment PDF export is a real product function

**Status:** Accepted

**Decision:**  
Assessment and marking-guide export should generate actual usable PDFs from structured assessment state.
