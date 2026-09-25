import { describe, expect, it } from "vitest";
import { readEnvironment, readPublicEnvironment } from "./env";

const base: NodeJS.ProcessEnv = { NODE_ENV: "test", NEXT_PUBLIC_APP_URL: "http://localhost:3000", NEXT_PUBLIC_SUPABASE_URL: "https://test.supabase.co", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "test-key" };
describe("environment boundaries", () => {
  it("accepts browser-safe configuration without server secrets", () => expect(readPublicEnvironment(base).NEXT_PUBLIC_SUPABASE_URL).toBe(base.NEXT_PUBLIC_SUPABASE_URL));
  it("requires a public Supabase key", () => expect(() => readPublicEnvironment({ ...base, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: undefined })).toThrow());
  it("does not include server secrets in the public schema", () => expect(readPublicEnvironment({ ...base, SUPABASE_SERVICE_ROLE_KEY: "must-not-be-read" })).not.toHaveProperty("SUPABASE_SERVICE_ROLE_KEY"));
  it("defaults the server-side AI gateway to Anthropic", () => expect(readEnvironment(base).AI_DEFAULT_PROVIDER).toBe("anthropic"));
  it("rejects an unsupported AI gateway provider", () => expect(() => readEnvironment({ ...base, AI_DEFAULT_PROVIDER: "unsupported" })).toThrow());
});
