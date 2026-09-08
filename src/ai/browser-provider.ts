import type { AIProvider, AssessmentProvider, AskATEProvider } from "@/ai/contracts";

async function call<T>(workflow: "LESSON_READINESS" | "ASSESSMENT_DRAFT" | "ASK_ATE", request: unknown): Promise<T> {
  const response = await fetch("/api/ai", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ workflow, request }) });
  const result = await response.json() as { output?: T; apiError?: string };
  if (!response.ok || !result.output) throw new Error(result.apiError || "AI request failed.");
  return result.output;
}

export const liveAIProvider: AIProvider = { generateLessonReadiness: (request) => call("LESSON_READINESS", request) };
export const liveAssessmentProvider: AssessmentProvider = { generateAssessment: (request) => call("ASSESSMENT_DRAFT", request) };
export const liveAskATEProvider: AskATEProvider = { ask: (request) => call("ASK_ATE", request) };
