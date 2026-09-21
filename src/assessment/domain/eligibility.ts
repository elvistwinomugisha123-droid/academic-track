import type { AssessmentPurpose, EligibleScope, SectionEligibility } from "./types";

export function resolveEligibleScope(input: {
  purpose: AssessmentPurpose;
  sections: SectionEligibility[];
  profileAllowsBroaderScope: boolean;
  broaderCanonicalIds?: string[];
}): EligibleScope {
  const perSection = input.sections.map((section) => new Set([...section.confirmedCanonicalIds, ...section.explicitlyConfirmedPartialCanonicalIds]));
  const union = [...new Set(perSection.flatMap((items) => [...items]))].sort();
  const intersection = perSection.length === 0 ? [] : union.filter((canonicalId) => perSection.every((items) => items.has(canonicalId)));
  const isBroaderPurpose = input.purpose === "DIAGNOSTIC" || input.purpose === "REVISION_PRACTICE" || input.purpose === "INTERNAL_EXAM";
  const broader = isBroaderPurpose && input.profileAllowsBroaderScope ? [...new Set(input.broaderCanonicalIds ?? [])].sort() : [];
  const canonicalIds = input.purpose === "COMMON_STREAM_TEST" ? intersection : broader.length ? [...new Set([...union, ...broader])].sort() : union;
  const evidence = input.sections.flatMap((section) => section.evidence.filter((item) => canonicalIds.includes(item.canonicalId)));
  const allKnown = [...new Set([...union, ...broader])];
  return {
    canonicalIds,
    broaderCanonicalIds: broader,
    excludedCanonicalIds: allKnown.filter((id) => !canonicalIds.includes(id)).sort(),
    evidence,
    explanation: input.purpose === "COMMON_STREAM_TEST"
      ? "Common scope is the intersection of confirmed eligible content across the participating Teaching Sections."
      : broader.length
        ? "This profile permits a broader scope for the selected purpose; broader content is visibly separated from confirmed taught scope."
        : "Scope is limited to confirmed taught content and explicit partial-scope confirmations. Mastery is not inferred.",
  };
}
