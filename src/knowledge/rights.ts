import type { KnowledgeSource, RetrievalUse } from "./types";

export function sourcePermitsUse(source: Pick<KnowledgeSource, "rightsStatus" | "productionUseStatus" | "externalAiAllowed">, use: RetrievalUse): boolean {
  if (use === "DEVELOPMENT_VIEW") return source.rightsStatus !== "RESTRICTED";
  if (source.rightsStatus !== "CLEARED" || source.productionUseStatus !== "PERMITTED") return false;
  return use !== "EXTERNAL_AI" || source.externalAiAllowed;
}

export function sourcePermitsProductionImport(source: Pick<KnowledgeSource, "rightsStatus" | "productionUseStatus">): boolean {
  return source.rightsStatus === "CLEARED" && source.productionUseStatus === "PERMITTED";
}
