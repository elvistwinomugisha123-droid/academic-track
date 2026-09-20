import { containsProtectedWording } from "@/ai/lesson-artifact-contracts";

export type TrustedExportSourceDecision = {
  rightsStatus: string;
  productionUseStatus: string;
  formalArtifactAllowed: boolean;
  exportAllowed: boolean;
  sourceWording: string | null;
};

export function canExportLessonArtifact(input: { artifactRightsState: string; governedAnchor: boolean; sourceDecision: TrustedExportSourceDecision | null; content: unknown }): { allowed: true } | { allowed: false; reason: string } {
  if (input.artifactRightsState === "RESTRICTED") return { allowed: false, reason: "This saved artifact is rights-restricted and cannot be exported." };
  if (!input.governedAnchor) return { allowed: true };
  if (!input.sourceDecision) return { allowed: false, reason: "The governed source decision could not be verified for export." };
  const protectedWording = containsProtectedWording(input.content, input.sourceDecision.sourceWording);
  if (protectedWording && (input.sourceDecision.rightsStatus === "RESTRICTED" || input.sourceDecision.productionUseStatus !== "PERMITTED" || !input.sourceDecision.formalArtifactAllowed || !input.sourceDecision.exportAllowed)) {
    return { allowed: false, reason: "This artifact contains source wording that is not cleared for export." };
  }
  if (input.sourceDecision.rightsStatus === "RESTRICTED" && protectedWording) return { allowed: false, reason: "This artifact contains restricted source wording." };
  return { allowed: true };
}
