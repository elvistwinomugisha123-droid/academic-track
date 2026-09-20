import { afterEach, describe, expect, it, vi } from "vitest";
import { getBrowserPublicEnvironment, supabasePublicKey } from "./env-public";

const base = {
  NODE_ENV: "test",
  NEXT_PUBLIC_APP_URL: "http://localhost:3000",
  NEXT_PUBLIC_SUPABASE_URL: "https://test.supabase.co",
};

function stubPublicEnvironment(overrides: Record<string, string | undefined> = {}) {
  const values = { ...base, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "publishable-key", NEXT_PUBLIC_SUPABASE_ANON_KEY: undefined, ...overrides };
  for (const [key, value] of Object.entries(values)) {
    vi.stubEnv(key, value ?? "");
    if (value === undefined) delete process.env[key];
  }
}

afterEach(() => vi.unstubAllEnvs());

describe("browser public environment", () => {
  it("loads the explicit public Supabase URL and prefers the publishable key", () => {
    stubPublicEnvironment();
    const environment = getBrowserPublicEnvironment();
    expect(environment.NEXT_PUBLIC_SUPABASE_URL).toBe(base.NEXT_PUBLIC_SUPABASE_URL);
    expect(supabasePublicKey(environment)).toBe("publishable-key");
  });

  it("falls back to the anon key when no publishable key exists", () => {
    stubPublicEnvironment({ NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: undefined, NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key" });
    const environment = getBrowserPublicEnvironment();
    expect(supabasePublicKey(environment)).toBe("anon-key");
  });

  it("rejects a missing public Supabase URL", () => {
    stubPublicEnvironment({ NEXT_PUBLIC_SUPABASE_URL: undefined });
    expect(() => getBrowserPublicEnvironment()).toThrow();
  });

  it("rejects missing publishable and anon keys", () => {
    stubPublicEnvironment({ NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: undefined, NEXT_PUBLIC_SUPABASE_ANON_KEY: undefined });
    expect(() => getBrowserPublicEnvironment()).toThrow();
  });
});
