import fs from "node:fs";

const source = JSON.parse(fs.readFileSync(new URL("../curriculum-data/04_biology_topics.json", import.meta.url), "utf8"));
const raw = source.topics.find((topic) => topic.id === "bio-s2-t2-3.2");
if (!raw) throw new Error("Canonical lesson topic was not found.");

const review = { state: "VERIFIED", reviewIds: [], reasons: [] };
const provenance = {
  category: "CURRICULUM",
  authority: raw.source.authority,
  documentId: raw.source.document_id,
  documentTitle: raw.source.document_title,
  publicationYear: raw.source.publication_year,
  pagePdf: raw.source.page_pdf,
  pagePrinted: raw.source.page_printed,
  sectionHeading: raw.source.section_heading,
  sourceType: raw.source.source_type,
  rightsNoticePresent: raw.source.rights_notice_present,
};
const mapEntity = (entity) => ({ id: entity.id, text: entity.text, source: provenance, review });
const topic = {
  id: raw.id,
  subject: raw.subject,
  level: raw.level,
  levelId: "s2",
  term: raw.term,
  theme: raw.theme,
  topicCode: raw.topic_code,
  title: raw.title,
  allocatedPeriods: raw.allocated_periods,
  learningOutcomes: raw.learning_outcomes.map(mapEntity),
  suggestedLearningActivities: raw.suggested_learning_activities.map(mapEntity),
  sampleAssessmentStrategies: raw.sample_assessment_strategies.map(mapEntity),
  ictSupport: raw.ict_support.map(mapEntity),
  notes: raw.notes.map(mapEntity),
  provenance,
  review,
};
const section = { id: "test-section", teacherId: "test-user", subjectName: "Biology", levelId: "s2", streamId: "test-stream", termId: "test-term", topicId: topic.id, scheduledEntryIds: ["test-entry"], confirmedOutcomeIds: [], currentOutcomeStatus: "UNCONFIRMED", unfinishedWorkIds: [], constraints: [] };
const lesson = { id: "test-lesson", sectionId: section.id, timetableEntryId: "test-entry", date: "2026-01-01", status: "DUE", topicId: topic.id, segmentIds: ["segment-context", "segment-activity", "segment-check"] };
const request = { state: { sections: [section], lessons: [lesson] }, sectionId: section.id, curriculumContext: { topic, frameworkGuidance: [], teacherConfirmedOutcomeIds: [], currentOutcomeStatus: "UNCONFIRMED", schoolConstraints: section.constraints } };

await fetch("http://localhost:3000/api/ai", { method: "GET" }).catch(() => undefined);

async function testWorkflow(workflow, workflowRequest) {
  const started = performance.now();
  const response = await fetch("http://localhost:3000/api/ai", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ workflow, request: workflowRequest }) });
  const result = await response.json();
  if (!response.ok || !result.output) process.exitCode = 1;
  return { workflow, httpStatus: response.status, provider: result.provider, fallbackUsed: result.fallbackUsed, model: result.model, anthropicLatencyMs: result.latencyMs, roundTripLatencyMs: Math.round(performance.now() - started), usage: result.usage, zodValidated: result.zodValidated, apiError: result.apiError ?? null };
}

const curriculumContext = request.curriculumContext;
const reports = [];
reports.push(await testWorkflow("LESSON_READINESS", request));
reports.push(await testWorkflow("ASK_ATE", { question: "How can I adapt this lesson while preserving its learning intention?", role: "TEACHER", sectionId: section.id, curriculumContext }));
reports.push(await testWorkflow("ASSESSMENT_DRAFT", { mode: "DIAGNOSTIC", allowedLearningOutcomeIds: topic.learningOutcomes.slice(0, 3).map((outcome) => outcome.id), topicTitle: topic.title, totalMarks: 20, curriculumContext }));
console.log(JSON.stringify(reports, null, 2));
