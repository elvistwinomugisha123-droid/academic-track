import { z } from "zod";

const AssessmentQuestionSchema = z.object({ id: z.string(), text: z.string(), marks: z.number().nonnegative(), markingGuide: z.array(z.string()) });
export const AssessmentArtifactPayloadSchema = z.object({ title: z.string(), durationMinutes: z.number().nonnegative(), totalMarks: z.number().nonnegative(), questions: z.array(AssessmentQuestionSchema) });
export type AssessmentArtifactPayload = z.infer<typeof AssessmentArtifactPayloadSchema>;

export const CanonicalArtifactVersionSchema = z.object({ artifactId: z.string(), versionId: z.string(), artifactType: z.enum(["ASSESSMENT"]), status: z.enum(["DRAFT", "REVIEW", "FINAL"]), ownerScope: z.string(), curriculumAnchorIds: z.array(z.string()), provenance: z.array(z.object({ category: z.string(), label: z.string(), sourceId: z.string().optional(), sourceLocation: z.string().optional() })), payload: AssessmentArtifactPayloadSchema });
export type CanonicalArtifactVersion = z.infer<typeof CanonicalArtifactVersionSchema>;

export function assertCanonicalArtifactVersion(value: unknown): CanonicalArtifactVersion { return CanonicalArtifactVersionSchema.parse(value); }
