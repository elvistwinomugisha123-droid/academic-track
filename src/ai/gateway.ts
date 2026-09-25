import "server-only";

import {
  DEFAULT_ANTHROPIC_MODEL,
  generateAnthropicStructured,
} from "@/ai/anthropic-provider";

export const supportedAIProviders = ["anthropic"] as const;
export type AIProvider = (typeof supportedAIProviders)[number];

export type AIGatewayUsage = {
  inputTokens: number;
  outputTokens: number;
};

export type AIGatewayResult<T> = {
  output: T;
  provider: AIProvider;
  model: string;
  latencyMs: number;
  usage: AIGatewayUsage;
  zodValidated: true;
  requestId?: string;
};

export class AIGatewayError extends Error {
  constructor(
    public readonly code: "CONFIGURATION" | "PROVIDER" | "INVALID_OUTPUT",
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "AIGatewayError";
  }
}

type AIEnvironment = Record<string, string | undefined>;

export function configuredAIProvider(input: AIEnvironment = process.env): AIProvider {
  const provider = input.AI_DEFAULT_PROVIDER?.trim().toLowerCase() || "anthropic";
  if (provider !== "anthropic") {
    throw new AIGatewayError("CONFIGURATION", `Unsupported AI provider: ${provider}.`);
  }
  return provider;
}

export function configuredAIModel(input: AIEnvironment = process.env): string {
  return input.AI_DEFAULT_MODEL?.trim() || input.ANTHROPIC_MODEL?.trim() || DEFAULT_ANTHROPIC_MODEL;
}

export function configuredAIGateway(input: AIEnvironment = process.env) {
  return {
    provider: configuredAIProvider(input),
    model: configuredAIModel(input),
  } as const;
}

export async function generateStructured<T>(input: {
  system: string;
  payload: unknown;
  maxTokens: number;
  validate: (value: unknown) => T;
}): Promise<AIGatewayResult<T>> {
  const configuration = configuredAIGateway();

  try {
    const result = await generateAnthropicStructured({
      ...input,
      model: configuration.model,
    });
    return { ...result, provider: configuration.provider };
  } catch (error) {
    if (error instanceof AIGatewayError) throw error;
    const message = error instanceof Error ? error.message : "The AI provider request failed.";
    const code = /json|parse|validation|zod/i.test(message) ? "INVALID_OUTPUT" : "PROVIDER";
    throw new AIGatewayError(code, message, { cause: error });
  }
}
