import "server-only";
import { z } from "zod";

const EnvironmentSchema = z.object({ NODE_ENV: z.enum(["development", "test", "production"]).default("development"), NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"), DATABASE_URL: z.string().url().optional(), ANTHROPIC_API_KEY: z.string().min(1).optional() });
export type AppEnvironment = z.infer<typeof EnvironmentSchema>;
export function readEnvironment(input: NodeJS.ProcessEnv = process.env): AppEnvironment { return EnvironmentSchema.parse(input); }
