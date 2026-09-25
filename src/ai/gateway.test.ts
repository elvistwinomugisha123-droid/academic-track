import { describe, expect, it } from "vitest";
import { AIGatewayError, configuredAIGateway } from "./gateway";

describe("ATE AI gateway configuration", () => {
  it("uses the supported provider and explicit default model", () => {
    expect(configuredAIGateway({ AI_DEFAULT_PROVIDER: "anthropic", AI_DEFAULT_MODEL: "configured-model" })).toEqual({
      provider: "anthropic",
      model: "configured-model",
    });
  });

  it("keeps the legacy Anthropic model override as a compatibility fallback", () => {
    expect(configuredAIGateway({ ANTHROPIC_MODEL: "legacy-model" }).model).toBe("legacy-model");
  });

  it("fails closed for unsupported providers", () => {
    expect(() => configuredAIGateway({ AI_DEFAULT_PROVIDER: "unknown" })).toThrow(AIGatewayError);
  });
});
