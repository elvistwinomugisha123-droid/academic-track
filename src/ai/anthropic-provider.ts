import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import {
  AskATEResponseSchema,
  AssessmentDraftSchema,
  LessonReadinessSchema,
  type AskATERequest,
  type AskATEResponse,
  type AssessmentDraftOutput,
  type AssessmentDraftRequest,
  type LessonReadinessOutput,
  type LessonReadinessRequest,
} from "@/ai/contracts";

export const DEFAULT_ANTHROPIC_MODEL = "claude-haiku-4-5-20251001";

export type AnthropicUsage = { inputTokens: number; outputTokens: number };
export type AnthropicResult<T> = {
  output: T;
  model: string;
  latencyMs: number;
  usage: AnthropicUsage;
  zodValidated: true;
  requestId?: string;
};

export async function generateAnthropicStructured<T>(input: { system: string; payload: unknown; maxTokens: number; validate: (value: unknown) => T }): Promise<AnthropicResult<T>> {
  return generate(input.system, input.payload, input.maxTokens, input.validate);
}

function modelName() {
  return process.env.ANTHROPIC_MODEL?.trim() || DEFAULT_ANTHROPIC_MODEL;
}

let anthropicClient: Anthropic | undefined;
function client() {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not configured.");
  anthropicClient ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 0 });
  return anthropicClient;
}

function parseJson(text: string): unknown {
  const trimmed = text.trim().replace(/^```json\s*/i, "").replace(/\s*```$/, "");
  return JSON.parse(trimmed);
}

async function generate<T>(system: string, payload: unknown, maxTokens: number, validate: (value: unknown) => T): Promise<AnthropicResult<T>> {
  const started = performance.now();
  const response = await client().messages.create({
    model: modelName(),
    max_tokens: maxTokens,
    temperature: 0.2,
    system,
    messages: [{ role: "user", content: `Return only valid JSON matching the requested shape.\n\nContext:\n${JSON.stringify(payload)}` }],
  });
  const text = response.content.filter((block) => block.type === "text").map((block) => block.text).join("\n");
  if (!text) throw new Error("Anthropic returned no text content.");
  return {
    output: validate(parseJson(text)),
    model: response.model,
    latencyMs: Math.round(performance.now() - started),
    usage: { inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens },
    zodValidated: true,
    requestId: response._request_id ?? undefined,
  };
}

function compactCurriculumContext(context: LessonReadinessRequest["curriculumContext"]) {
  const topic = context.topic;
  const textEntities = (items: readonly { id: string; text: string }[]) => items.map(({ id, text }) => ({ id, text }));
  return {
    topic: {
      id: topic.id,
      title: topic.title,
      topicCode: topic.topicCode,
      level: topic.level,
      term: topic.term,
      allocatedPeriods: topic.allocatedPeriods,
      learningOutcomes: textEntities(topic.learningOutcomes),
      suggestedLearningActivities: textEntities(topic.suggestedLearningActivities),
      sampleAssessmentStrategies: textEntities(topic.sampleAssessmentStrategies),
      restrictionsAndNotes: textEntities(topic.notes),
      reviewReasons: topic.review.reasons,
    },
    frameworkGuidance: context.frameworkGuidance.map(({ id, text, category }) => ({ id, text, category })),
    teacherConfirmedOutcomeIds: context.teacherConfirmedOutcomeIds,
    currentOutcomeStatus: context.currentOutcomeStatus,
    schoolConstraints: context.schoolConstraints,
  };
}

export function generateAnthropicLessonReadiness(request: LessonReadinessRequest) {
  const section = request.state.sections.find((item) => item.id === request.sectionId);
  const lesson = request.state.lessons.find((item) => item.sectionId === request.sectionId && item.status === "DUE");
  return generate(
    "You create concise teacher-editable lesson readiness drafts. Curriculum context is authority; never invent curriculum facts. School constraints and teacher-confirmed state are facts. UNCONFIRMED never means missed. The segment minutes must total 50. JSON shape: {learningIntention:string,priorLearning:string,segments:[{title:string,durationMinutes:number,activity:string,rationale:string,sourceCategory:'CURRICULUM'|'ATE'}],formativeCheck:{method:string,evidenceExpected:string},resourceNeeds:string[],teacherWatchouts:string[]}.",
    { workflow: "LESSON_READINESS", section, lesson, curriculumContext: compactCurriculumContext(request.curriculumContext), teacherPrompt: request.prompt },
    1800,
    (value) => LessonReadinessSchema.parse(value),
  );
}

export function generateAnthropicAssessment(request: AssessmentDraftRequest) {
  return generate<AssessmentDraftOutput>(
    "Create a teacher-review-required assessment draft. Use only allowedLearningOutcomeIds and never invent curriculum IDs. Marks and marking guide must be coherent. JSON shape: {title:string,instructions:string[],questions:[{text:string,marks:number,questionType:string,difficulty:'LOW'|'MEDIUM'|'HIGH',learningOutcomeIds:string[],markingGuide:[{point:string,marks:number}]}]}.",
    { workflow: "ASSESSMENT_DRAFT", mode: request.mode, topicTitle: request.topicTitle, totalMarks: request.totalMarks, allowedLearningOutcomeIds: request.allowedLearningOutcomeIds, curriculumContext: request.curriculumContext ? compactCurriculumContext(request.curriculumContext) : undefined },
    2400,
    (value) => AssessmentDraftSchema.parse(value),
  );
}

export function askAnthropicATE(request: AskATERequest) {
  return generate<AskATEResponse>(
    "You are ATE, an advisory academic operations assistant. Curriculum authority, school facts and teacher-confirmed classroom reality must remain distinct. Never silently change state or claim an action occurred. Answer concisely. JSON shape: {answer:string,suggestedFollowUps:string[]} with at most 3 follow-ups.",
    { workflow: "ASK_ATE", question: request.question, role: request.role, sectionId: request.sectionId, curriculumContext: request.curriculumContext ? compactCurriculumContext(request.curriculumContext) : undefined },
    700,
    (value) => AskATEResponseSchema.parse(value),
  );
}
