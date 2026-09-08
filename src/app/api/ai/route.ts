import { NextResponse } from "next/server";
import { z } from "zod";
import { askAnthropicATE, generateAnthropicAssessment, generateAnthropicLessonReadiness } from "@/ai/anthropic-provider";
import { fixtureAIProvider, fixtureAssessmentProvider, fixtureAskATEProvider, type AskATERequest, type AssessmentDraftRequest, type LessonReadinessRequest } from "@/ai/contracts";

const EnvelopeSchema = z.discriminatedUnion("workflow", [
  z.object({ workflow: z.literal("LESSON_READINESS"), request: z.unknown() }),
  z.object({ workflow: z.literal("ASSESSMENT_DRAFT"), request: z.unknown() }),
  z.object({ workflow: z.literal("ASK_ATE"), request: z.unknown() }),
]);

export async function POST(httpRequest: Request) {
  const envelope = EnvelopeSchema.parse(await httpRequest.json());
  try {
    const result = envelope.workflow === "LESSON_READINESS"
      ? await generateAnthropicLessonReadiness(envelope.request as LessonReadinessRequest)
      : envelope.workflow === "ASSESSMENT_DRAFT"
        ? await generateAnthropicAssessment(envelope.request as AssessmentDraftRequest)
        : await askAnthropicATE(envelope.request as AskATERequest);
    return NextResponse.json({ provider: "anthropic", fallbackUsed: false, ...result });
  } catch (error) {
    const apiError = error instanceof Error ? error.message : "Unknown Anthropic error";
    if (envelope.workflow === "LESSON_READINESS") {
      const output = await fixtureAIProvider.generateLessonReadiness(envelope.request as LessonReadinessRequest);
      return NextResponse.json({ provider: "fixture", fallbackUsed: true, output, model: null, latencyMs: null, usage: null, zodValidated: true, apiError });
    }
    if (envelope.workflow === "ASSESSMENT_DRAFT") {
      const output = await fixtureAssessmentProvider.generateAssessment(envelope.request as AssessmentDraftRequest);
      return NextResponse.json({ provider: "fixture", fallbackUsed: true, output, model: null, latencyMs: null, usage: null, zodValidated: true, apiError });
    }
    const output = await fixtureAskATEProvider.ask(envelope.request as AskATERequest);
    return NextResponse.json({ provider: "fixture", fallbackUsed: true, output, model: null, latencyMs: null, usage: null, zodValidated: true, apiError });
  }
}
