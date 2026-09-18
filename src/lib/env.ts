import "server-only";
import { z } from "zod";
import { PublicEnvironmentBaseSchema, PublicEnvironmentSchema, type PublicEnvironment } from "./env-public";
export type { PublicEnvironment } from "./env-public";

const ServerEnvironmentSchema = PublicEnvironmentBaseSchema.extend({
  DATABASE_URL: z.string().url().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  ANTHROPIC_API_KEY: z.string().min(1).optional(),
}).superRefine((value, context) => {
  if (!value.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY && !value.NEXT_PUBLIC_SUPABASE_ANON_KEY) context.addIssue({ code: z.ZodIssueCode.custom, path: ["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"], message: "A Supabase publishable or anon key is required." });
});
export type AppEnvironment = z.infer<typeof ServerEnvironmentSchema>;
export function readEnvironment(input: NodeJS.ProcessEnv = process.env): AppEnvironment { return ServerEnvironmentSchema.parse(input); }
export function readPublicEnvironment(input: NodeJS.ProcessEnv = process.env): PublicEnvironment { return PublicEnvironmentSchema.parse(input); }

export function hasSupabasePublicEnvironment(input: NodeJS.ProcessEnv = process.env) {
  return Boolean(input.NEXT_PUBLIC_SUPABASE_URL && (input.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || input.NEXT_PUBLIC_SUPABASE_ANON_KEY));
}

export const supabasePublicKey = (input: NodeJS.ProcessEnv = process.env) => {
  const environment = readPublicEnvironment(input);
  return environment.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? environment.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
};
