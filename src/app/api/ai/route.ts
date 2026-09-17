import { NextResponse } from "next/server";
import { z } from "zod";
import { askAnthropicATE, generateAnthropicAssessment, generateAnthropicLessonReadiness } from "@/ai/anthropic-provider";
import { type AskATERequest, type AssessmentDraftRequest, type LessonReadinessRequest } from "@/ai/contracts";

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
    return NextResponse.json({ provider: "anthropic", fallbackUsed: false, apiError: "The AI provider is unavailable. No academic state was changed." }, { status: 503 });
  }
}
