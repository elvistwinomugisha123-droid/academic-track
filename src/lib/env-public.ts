import { z } from "zod";

export const PublicEnvironmentBaseSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1).optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1).optional(),
});
export const PublicEnvironmentSchema = PublicEnvironmentBaseSchema.superRefine((value, context) => {
  if (!value.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY && !value.NEXT_PUBLIC_SUPABASE_ANON_KEY) context.addIssue({ code: z.ZodIssueCode.custom, path: ["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"], message: "A Supabase publishable or anon key is required." });
});
export type PublicEnvironment = z.infer<typeof PublicEnvironmentSchema>;
export const supabasePublicKey = (input: NodeJS.ProcessEnv = process.env) => { const environment = PublicEnvironmentSchema.parse(input); return environment.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? environment.NEXT_PUBLIC_SUPABASE_ANON_KEY!; };
export const hasSupabasePublicEnvironment = (input: NodeJS.ProcessEnv = process.env) => Boolean(input.NEXT_PUBLIC_SUPABASE_URL && (input.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || input.NEXT_PUBLIC_SUPABASE_ANON_KEY));
