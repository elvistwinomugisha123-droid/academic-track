const ISOLATED_ATE_TEST_PROJECT_REF = "lwbkxhimqlfuzzxilaga";

export function allowTestSyntheticAssessmentProfiles(input: { flag: string | undefined; supabaseUrl: string | undefined }): boolean {
  if (input.flag !== "1" || !input.supabaseUrl) return false;
  try {
    const url = new URL(input.supabaseUrl);
    return url.protocol === "https:" && url.hostname === `${ISOLATED_ATE_TEST_PROJECT_REF}.supabase.co`;
  } catch {
    return false;
  }
}
