import { describe, expect, it } from "vitest";
import { allowTestSyntheticAssessmentProfiles } from "./test-environment";

describe("synthetic Assessment Studio profile gate", () => {
  it("allows synthetic profiles only with the explicit flag on the isolated TEST project", () => {
    expect(allowTestSyntheticAssessmentProfiles({ flag: "1", supabaseUrl: "https://lwbkxhimqlfuzzxilaga.supabase.co" })).toBe(true);
  });

  it.each([
    { flag: undefined, supabaseUrl: "https://lwbkxhimqlfuzzxilaga.supabase.co" },
    { flag: "0", supabaseUrl: "https://lwbkxhimqlfuzzxilaga.supabase.co" },
    { flag: "1", supabaseUrl: "https://example.supabase.co" },
    { flag: "1", supabaseUrl: "https://lwbkxhimqlfuzzxilaga.supabase.co.evil.example" },
    { flag: "1", supabaseUrl: "http://lwbkxhimqlfuzzxilaga.supabase.co" },
    { flag: "1", supabaseUrl: "not-a-url" },
  ])("fails closed for non-TEST or malformed configuration %#", (input) => {
    expect(allowTestSyntheticAssessmentProfiles(input)).toBe(false);
  });
});
