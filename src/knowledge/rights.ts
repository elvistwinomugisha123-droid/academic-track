import type { KnowledgeSource, RetrievalUse } from "./types";

type RightsInput = Pick<KnowledgeSource, "rightsStatus" | "productionUseStatus" | "externalAiAllowed" | "formalArtifactAllowed" | "exportAllowed">;

export function sourcePermitsUse(source: RightsInput, use: RetrievalUse): boolean {
  if (use === "DEVELOPMENT_VIEW") return source.rightsStatus !== "RESTRICTED";
  if (source.rightsStatus !== "CLEARED" || source.productionUseStatus !== "PERMITTED") return false;
  if (use === "EXTERNAL_AI") return source.externalAiAllowed;
  if (use === "FORMAL_ARTIFACT") return source.formalArtifactAllowed;
  return true;
}

export function sourcePermitsProductionImport(source: Pick<KnowledgeSource, "rightsStatus" | "productionUseStatus">): boolean {
  return source.rightsStatus === "CLEARED" && source.productionUseStatus === "PERMITTED";
}
