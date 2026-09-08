# Curriculum extraction validation

Status: extracted with human review required. No internet sources, lesson plans, or test questions were used/generated.

## Counts

| Record | Count |
|---|---:|
| Levels | 4 |
| Terms per level | 3 |
| Level–term combinations | 12 |
| Planner rows | 31 |
| Detailed topics | 32 |
| competency | 32 |
| learning_outcome | 167 |
| activity | 197 |
| assessment_strategy | 115 |
| ict_support | 28 |
| note | 12 |
| Framework records | 130 |
| Relationships | 1103 |
| Human review items | 26 |

## Annual reconciliation

| Level | Detailed topics | Outcomes | Periods: planner and detail |
|---|---:|---:|---:|
| Senior 1 | 7 | 27 | 108 |
| Senior 2 | 7 | 45 | 108 |
| Senior 3 | 9 | 52 | 144 |
| Senior 4 | 9 | 43 | 134 |

## Checks completed

- All 31 programme-planner rows mapped to all 32 detailed topics; no omitted or extra topic. Each planner allocation equals the sum of its mapped detail allocations.
- Outcome letters checked from a onward for every topic. Wrapped classification codes are not treated as separate outcomes.
- Independent token-count comparison against PDF word extraction found no missing or added alphanumeric tokens in any of the 96 topic-column payloads.
- Table columns extracted using actual vertical PDF rules. Activities and assessments remain distinct; no semantic LO-to-activity links were invented.
- Three continuation pages retained: PDF 29 for Nutrition in Mammals, PDF 41 for Development, PDF 45 for Human Reproduction. Two topics on PDF 47 remain separate.
- Senior 1 and Senior 2 topic headings, terms, allocations, outcome sequences, column placement, and restrictions checked against source text, with selected full-page visual checks.
- Every canonical authority record has document/page provenance. Detailed child entities additionally carry geometric spans.
- All graph endpoints and runtime references resolve to canonical IDs. JSON and JSONL serialization is checked after writing.
- ICT support and standalone notes remain separate. Inline restrictions remain in their full original records and are referenced by a derived restriction index.
- Full activities retain nested lists and multi-page continuation. Activity counts refer to these units, not every sub-bullet.

## Interpretation and missing fields

- Source topic codes retain original spaces and punctuation; readable IDs use explicitly derived normalization. The malformed Transport in Animals code is preserved.
- No theme heading is present on the Viruses detail page: canonical detail theme is null. Its planner-context relationship is explicitly derived.
- Planner topic codes are null because the planner does not print codes. Planner and detail titles are independently retained.
- Empty ICT or notes arrays mean no item stated in that section, not a prohibition. Missing classification notation and undefined gs are queued.
- Document version is null: no explicit edition/version label was established. Publication year is 2019 from publication pages.
- Source passages are whitespace-normalized, not scientifically corrected. Repeated Mg, unusual terminology, and contradictory statements remain visible.
- Framework guidance applies at subject-context level; it is not copied into or rewritten as Biology-specific outcomes.

## Extraction limitations and source issues

- Framework PDF 19: diagram-only labels/relationships are not completely represented by native text; narrative retained and diagram interpretation queued.
- Framework PDF 20: some active-learning diagram labels appear incomplete/irregular; retained verbatim for review.
- Framework PDF 14: merged subject-menu table retained as source text with review required; do not interpret linearized text as a normalized options matrix.
- Framework PDF 23: rotated graduate-profile panel has apparent source errors in its SDG and curriculum-menu lists. Graduate-profile outcomes extracted separately; source panel preserved for review.
- Biology PDF 56: final glossary rows overlap/are incomplete; no missing definition invented.
- Image-only or decorative pages were inspected; they do not contain missing detailed syllabus tables. Covers were not OCR-normalized into curriculum entities.
- Visual verification was targeted, not a claim of manual line-by-line proofreading of every page. Human review is still required for the queued issues.

## Open review queue

- **review-001** — `bio-s1-t2-1.3.3`; ncdc-biology-2019, PDF 21: Viruses has no theme heading on its detailed page. Planner term context is retained separately; no authoritative detail theme is invented.
- **review-002** — `bio-s2-t3-4.2`; ncdc-biology-2019, PDF 31: Topic number contains a doubled separator in the source; canonical source code preserved, ID uses normalized 4.2.
- **review-003** — `bio-s1-t2-1.3.2-lo-07`; ncdc-biology-2019, PDF 20: Learning-outcome classification is missing or syntactically incomplete in the source. Do not fill from model knowledge.
- **review-004** — `bio-s2-t3-4.1-lo-02`; ncdc-biology-2019, PDF 30: Learning-outcome classification is missing or syntactically incomplete in the source. Do not fill from model knowledge.
- **review-005** — `bio-s4-t1-10.2-lo-05`; ncdc-biology-2019, PDF 43: Learning-outcome classification is missing or syntactically incomplete in the source. Do not fill from model knowledge.
- **review-006** — `bio-s1-t2-planner-classification`; ncdc-biology-2019, PDF 14, 20, 21: Planner umbrella title differs from detailed topics. The 30+6 mapping is a derived reconciliation, not an explicit source cross-reference.
- **review-007** — `bio-s2-t2-3.1-lo-08`; ncdc-biology-2019, PDF 26: Mg occurs twice; preserve the duplicate as printed and obtain authoritative clarification.
- **review-008** — `bio-s2-t2-3.1-note-01`; ncdc-biology-2019, PDF 26: Scope of this mineral restriction is not qualified in the note; plant-nutrient outcome separately lists N, P, K, Mg, Ca, S, Mg. Retain both without resolving scope.
- **review-009** — `biology-classification-gs`; ncdc-biology-2019, PDF 27, 28, 33, 36: gs appears in outcomes but is not explicitly defined in the supplied classification legend. No expansion supplied.
- **review-010** — `bio-s2-t3-4.1-lo-02`; ncdc-biology-2019, PDF 30: Source uses "raw unshelled eggs" in activity, "adopted" in outcome c and "though" in outcome b. Preserve wording; verify intended terminology.
- **review-011** — `bio-s2-t3-4.2`; ncdc-biology-2019, PDF 31: No further activity text follows the transfusion activity before Senior 3 starts. Do not invent immune/lymphatic-system activities.
- **review-012** — `bio-s1-t2-1.3.2`; ncdc-biology-2019, PDF 20: Outcomes restrict drawings for some groups while suggested activities offer drawings. Keep restrictions and activities intact; do not infer precedence.
- **review-013** — `bio-s1-t3-1.4`; ncdc-biology-2019, PDF 22: Outcome limits mouth-part detail while the activity lists mouth parts among observed features. Do not infer extra content requirements.
- **review-014** — `bio-s2-t1-2.2-act-01`; ncdc-biology-2019, PDF 25: Unqualified topic reference cannot be resolved to a unique canonical topic without interpretation. No prerequisite edge created.
- **review-015** — `framework-cross-cutting-life-skills`; ncdc-framework-2019, PDF 12, 19: Framework list names six cross-cutting issues; overall-model narrative and diagram present five. Preserve both counts.
- **review-016** — `framework-subject-options`; ncdc-framework-2019, PDF 13, 14, 23: Framework describes a 20-subject menu; graduate-profile panel enumerates 21 including General Science. Keep alternative status explicit; do not silently revise counts.
- **review-017** — `framework-subject-options`; ncdc-framework-2019, PDF 14: Menu prose allows minimum 8 and maximum 9 subjects, while table heading says 7 compulsory plus 2 electives. Table layout includes merged General Science cells; retain source section and consult original for option combinations.
- **review-018** — `framework-active-learning-strategies`; ncdc-framework-2019, PDF 20: Diagram labels contain truncated or irregular text (e.g. "Analysis of hand d ata", "Whole group extended", "Excursions, ﬁeld"). Native text preserved; manual image verification required before interpreting these labels.
- **review-019** — `framework-overall-model`; ncdc-framework-2019, PDF 19: Diagram relationship labels are not fully represented in the native text layer. Narrative is retained; diagram-only labels/edges are not asserted.
- **review-020** — `framework-graduate-profile-context`; ncdc-framework-2019, PDF 23: Source graduate-profile panel enumerates 16 SDG lines with apparent merged/incorrect labels. Retain printed wording; no replacement from external SDG knowledge.
- **review-021** — `biology-assessment_principle-21-01`; ncdc-biology-2019, PDF 52, 55: Biology guidance has differing statements about annual testing and topic-level records. Both source passages retained; no runtime testing rule resolves them.
- **review-022** — `biology-glossary-0-01`; ncdc-biology-2019, PDF 56: Final glossary rows overlap or appear incomplete. Raw source blocks preserved without guessing definitions.
- **review-023** — `bio-s2-t2-3.2-lo-03`; ncdc-biology-2019, PDF 27: gs not explicitly defined by supplied legend; preserve raw notation and leave normalized expansion unresolved.
- **review-024** — `bio-s2-t2-3.3-lo-02`; ncdc-biology-2019, PDF 28: gs not explicitly defined by supplied legend; preserve raw notation and leave normalized expansion unresolved.
- **review-025** — `bio-s3-t1-5.2-lo-03`; ncdc-biology-2019, PDF 33: gs not explicitly defined by supplied legend; preserve raw notation and leave normalized expansion unresolved.
- **review-026** — `bio-s3-t2-7.2-lo-07`; ncdc-biology-2019, PDF 36: gs not explicitly defined by supplied legend; preserve raw notation and leave normalized expansion unresolved.

## File contract

- `04_biology_topics.json` is the full nested canonical topic view. `05_biology_entities.jsonl` is its flat entity projection, including shared preambles.
- Resolve graph/runtime IDs from the union of framework records, subject/hierarchy/planner/definition/guidance records, and flat Biology entities.
- `06_curriculum_relationships.jsonl` contains normalized source-supported relationships; graph edge labels are ATE metadata.
- `07_ate_runtime_context.json` is a secondary ID-only context view. Load authoritative wording through canonical IDs; consult review items before generation.
- Do not infer present-day policy, NCDC endorsement, permission or licensing from these supplied files.
