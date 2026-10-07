import type { KnowledgeSource, RetrievalUse } from "./types";

type RightsInput = Pick<KnowledgeSource, "rightsStatus" | "productionUseStatus" | "externalAiAllowed" | "formalArtifactAllowed" | "exportAllowed">;

export function sourcePermitsUse(source: RightsInput, use: RetrievalUse): boolean {
  if (use === "DEVELOPMENT_VIEW") return source.rightsStatus !== "RESTRICTED";
  const pilotAuthorised = source.rightsStatus === "OPERATOR_AUTHORIZED_FOR_PILOT" && source.productionUseStatus === "PERMITTED";
  const productionAuthorised = source.rightsStatus === "CLEARED" && source.productionUseStatus === "PERMITTED";
  if (use === "CONTROLLED_PILOT") return pilotAuthorised || productionAuthorised;
  if (!productionAuthorised && !(pilotAuthorised && use !== "PRODUCTION_APP")) return false;
  if (use === "EXTERNAL_AI") return source.externalAiAllowed;
  if (use === "FORMAL_ARTIFACT") return source.formalArtifactAllowed;
  return true;
}

export function sourcePermitsProductionImport(source: Pick<KnowledgeSource, "rightsStatus" | "productionUseStatus">): boolean {
  return source.rightsStatus === "CLEARED" && source.productionUseStatus === "PERMITTED";
}

export function sourcePermitsPilotImport(source: Pick<KnowledgeSource, "rightsStatus" | "productionUseStatus">): boolean {
  return sourcePermitsProductionImport(source) || (source.rightsStatus === "OPERATOR_AUTHORIZED_FOR_PILOT" && source.productionUseStatus === "PERMITTED");
}
