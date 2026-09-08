import sourceManifestJson from "../../curriculum-data/01_source_manifest.json";
import frameworkJson from "../../curriculum-data/02_curriculum_framework.json";
import subjectJson from "../../curriculum-data/03_biology_subject.json";
import topicsJson from "../../curriculum-data/04_biology_topics.json";
import runtimeContextJson from "../../curriculum-data/07_ate_runtime_context.json";
import reviewQueueJson from "../../curriculum-data/09_human_review_queue.json";
import { frameworkSchema, reviewQueueSchema, runtimeContextSchema, sourceManifestSchema, subjectSchema, topicsFileSchema, type AstraEntity, type AstraSource, type AstraTopic, type ReviewItem } from "./schemas";
import type { CurriculumTopic, CurriculumLearningOutcome, CurriculumContext, CurriculumReviewStatus, FrameworkGuidance } from "@/domain/types";

const sourceManifest = sourceManifestSchema.parse(sourceManifestJson);
const framework = frameworkSchema.parse(frameworkJson);
const subject = subjectSchema.parse(subjectJson);
const topicsFile = topicsFileSchema.parse(topicsJson);
const runtimeContext = runtimeContextSchema.parse(runtimeContextJson);
const reviewQueue = reviewQueueSchema.parse(reviewQueueJson);
const runtimeTopicIds = new Set(runtimeContext.topics.map((entry) => (typeof entry === "object" && entry !== null && "topic_id" in entry ? entry.topic_id : undefined)).filter((id): id is string => typeof id === "string"));

const reviewsByEntity = new Map<string, ReviewItem[]>();
for (const item of reviewQueue.items) {
  if (!item.affected_entity) continue;
  reviewsByEntity.set(item.affected_entity, [...(reviewsByEntity.get(item.affected_entity) ?? []), item]);
}

function reviewIds(value: string | string[] | undefined): string[] {
  return value ? (Array.isArray(value) ? value : [value]) : [];
}

function reviewStatus(entityId: string, topicReviewIds: string[] = []): CurriculumReviewStatus {
  const items = [...(reviewsByEntity.get(entityId) ?? []), ...topicReviewIds.flatMap((id) => reviewQueue.items.filter((item) => item.id === id))];
  const open = items.filter((item) => item.status === "open");
  return open.length ? { state: "REVIEW_REQUIRED", reviewIds: open.map((item) => item.id), reasons: open.map((item) => item.reason_for_uncertainty ?? "Source requires human review.") } : { state: "VERIFIED", reviewIds: [], reasons: [] };
}

function mapSource(source: AstraSource): CurriculumTopic["provenance"] {
  return { category: "CURRICULUM", authority: source.authority, documentId: source.document_id, documentTitle: source.document_title, publicationYear: source.publication_year ?? undefined, pagePdf: source.page_pdf ?? undefined, pagePrinted: source.page_printed ?? undefined, sectionHeading: source.section_heading, sourceType: source.source_type, rightsNoticePresent: source.rights_notice_present };
}

function mapEntity(entity: AstraEntity, topicReviewIds: string[] = []): CurriculumLearningOutcome {
  const id = entity.id;
  const review = reviewStatus(id, topicReviewIds);
  return { id, text: entity.text ?? "", source: entity.source ? mapSource(entity.source) : undefined, review };
}

const topicMap = new Map<string, CurriculumTopic>();
for (const topic of topicsFile.topics) {
  if (!runtimeTopicIds.has(topic.id)) continue;
  const topicReviewIds = reviewIds(topic.human_review_ids);
  topicMap.set(topic.id, Object.freeze({
    id: topic.id,
    subject: topic.subject,
    level: topic.level,
    levelId: topic.level.toLowerCase().replace("senior ", "s"),
    term: topic.term,
    theme: topic.theme ?? "",
    topicCode: topic.topic_code,
    title: topic.title,
    allocatedPeriods: topic.allocated_periods,
    competency: topic.competency ? mapEntity(topic.competency) : undefined,
    learningOutcomes: topic.learning_outcomes.map((item) => mapEntity(item)),
    suggestedLearningActivities: topic.suggested_learning_activities.map((item) => mapEntity(item)),
    sampleAssessmentStrategies: topic.sample_assessment_strategies.map((item) => mapEntity(item)),
    ictSupport: topic.ict_support.map((item) => mapEntity(item)),
    notes: topic.notes.map((item) => mapEntity(item)),
    provenance: mapSource(topic.source),
    extractionConfidence: topic.extraction_confidence,
    review: reviewStatus(topic.id, topicReviewIds),
  }));
}

const frameworkGuidance: FrameworkGuidance[] = framework.records
  .filter((record) => record.entity_type !== "topic" && record.text)
  .filter((record) => record.entity_type === "active_learning_expectation" || record.entity_type === "assessment_principle" || record.entity_type === "generic_skill" || record.entity_type === "implementation_guidance")
  .slice(0, 12)
  .map((record) => ({ id: record.id, text: record.text ?? "", category: record.entity_type, provenance: record.source ? mapSource(record.source) : undefined }));

export const curriculumRepository = Object.freeze({
  topics: topicMap,
  frameworkGuidance: Object.freeze(frameworkGuidance),
  sourceManifest,
  subject,
  runtimeContext,
  reviewQueue,
  getTopic: (id: string) => topicMap.get(id),
  getLearningOutcome: (id: string) => [...topicMap.values()].flatMap((topic) => topic.learningOutcomes).find((outcome) => outcome.id === id),
});

export function getCurriculumTopic(id: string): CurriculumTopic { const topic = curriculumRepository.getTopic(id); if (!topic) throw new Error(`Unknown canonical curriculum topic: ${id}`); return topic; }
export function getCurriculumLearningOutcome(id: string): CurriculumLearningOutcome | undefined { return curriculumRepository.getLearningOutcome(id); }
export function getFrameworkGuidance(): readonly FrameworkGuidance[] { return curriculumRepository.frameworkGuidance; }
