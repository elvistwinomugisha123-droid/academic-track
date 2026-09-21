import type { AssessmentProfile, AssessmentPurpose, ProfileResolution } from "./types";

export type RuntimeAssessmentProfileInput = {
  profile: {
    id: string;
    displayTitle: string;
    purpose: AssessmentPurpose;
    regime: string;
    releaseId: string;
    subjectProfileId: string | null;
    status: string;
    allowsBroaderScope: boolean;
    allowsPartialScope: boolean;
    requiresReview: boolean;
  };
  release: {
    id: string;
    versionLabel: string;
    authority: string;
    status: string;
    effectiveFrom: string;
    effectiveTo: string | null;
  };
  subjectProfile: {
    id: string;
    releaseId: string;
    governedSubjectId: string;
    educationLevel: string;
    status: string;
    runtimeStatus: string;
  };
  subjectProfileId: string;
  subjectId: string;
  subjectBinding: { status: string; effectiveFrom: string; effectiveTo: string | null } | null;
  sectionIds: string[];
  sectionBindings: Array<{ sectionId: string; status: string; effectiveFrom: string; effectiveTo: string | null }>;
  assessmentDate: string;
  sources: Array<{
    sourceId: string;
    sourceVersion: string | null;
    rightsStatus: AssessmentProfile["rightsState"];
    productionUseStatus: NonNullable<AssessmentProfile["productionUseStatus"]>;
    externalAiAllowed: boolean;
    formalArtifactAllowed: boolean;
    exportAllowed: boolean;
  }>;
};

export type AssessmentProfileCandidate = AssessmentProfile & {
  subjectProfileId: string | null;
  subjectId: string;
  educationLevel: string;
  subject: string;
};

function isDateApplicable(assessmentDate: string, effectiveFrom: string, effectiveTo: string | null) {
  return effectiveFrom <= assessmentDate && (effectiveTo === null || effectiveTo >= assessmentDate);
}

export function resolveRuntimeAssessmentProfile(input: RuntimeAssessmentProfileInput): ProfileResolution {
  const releaseApplicable = input.release.status === "ACTIVE" && isDateApplicable(input.assessmentDate, input.release.effectiveFrom, input.release.effectiveTo);
  const profileApplicable = input.profile.status === "ACTIVE" && input.profile.releaseId === input.release.id;
  const subjectProfileApplicable = input.subjectProfile.id === input.subjectProfileId && input.subjectProfile.releaseId === input.profile.releaseId && input.subjectProfile.status === "ACTIVE" && input.subjectProfile.runtimeStatus === "PILOT_ACTIVE";
  const subjectBindingApplicable = input.subjectBinding?.status === "ACTIVE" && isDateApplicable(input.assessmentDate, input.subjectBinding.effectiveFrom, input.subjectBinding.effectiveTo);
  const sectionBindingsApplicable = input.sectionIds.length > 0 && input.sectionIds.every((sectionId) => input.sectionBindings.some((binding) => binding.sectionId === sectionId && binding.status === "ACTIVE" && isDateApplicable(input.assessmentDate, binding.effectiveFrom, binding.effectiveTo)));
  const allRightsCleared = input.sources.length > 0 && input.sources.every((source) => source.rightsStatus === "CLEARED" && source.productionUseStatus === "PERMITTED");
  const hasRestrictedRights = input.sources.some((source) => source.rightsStatus === "RESTRICTED" || source.productionUseStatus === "BLOCKED");
  const rightsState: AssessmentProfile["rightsState"] = input.sources.length === 0
    ? "UNKNOWN"
    : hasRestrictedRights
      ? "RESTRICTED"
      : allRightsCleared
        ? "CLEARED"
        : "REVIEW_REQUIRED";
  const applicable = releaseApplicable && profileApplicable && subjectProfileApplicable && subjectBindingApplicable === true && sectionBindingsApplicable;
  const profile: AssessmentProfile = {
    id: input.profile.id,
    displayTitle: input.profile.displayTitle,
    purpose: input.profile.purpose,
    regime: input.profile.regime,
    authority: input.release.authority,
    sourceId: input.sources[0]?.sourceId ?? null,
    sourceVersion: input.sources[0]?.sourceVersion ?? null,
    releaseId: input.release.id,
    releaseVersion: input.release.versionLabel,
    verificationStatus: applicable ? "VERIFIED" : "UNVERIFIED",
    rightsState,
    externalAiAllowed: allRightsCleared && input.sources.every((source) => source.externalAiAllowed),
    exportAllowed: allRightsCleared && input.sources.every((source) => source.exportAllowed),
    effectiveFrom: input.release.effectiveFrom,
    effectiveTo: input.release.effectiveTo,
    allowsBroaderScope: input.profile.allowsBroaderScope,
    allowsPartialScope: input.profile.allowsPartialScope,
    requiresReview: input.profile.requiresReview,
    productionUseStatus: allRightsCleared ? "PERMITTED" : hasRestrictedRights ? "BLOCKED" : "PERMISSION_PENDING",
    formalArtifactAllowed: allRightsCleared && input.sources.every((source) => source.formalArtifactAllowed),
    releaseStatus: input.release.status as AssessmentProfile["releaseStatus"],
    subjectProfileStatus: input.subjectProfile.status as AssessmentProfile["subjectProfileStatus"],
    subjectProfileRuntimeStatus: input.subjectProfile.runtimeStatus as AssessmentProfile["subjectProfileRuntimeStatus"],
    applicable,
    assessmentDate: input.assessmentDate,
    subjectProfileId: input.subjectProfileId,
    subjectId: input.subjectId,
    educationLevel: input.subjectProfile.educationLevel,
  };
  if (!applicable) return { state: "UNAVAILABLE", profile: null, explanation: "The assessment profile, governed release, subject profile, or school bindings are not active and date-applicable." };
  return { state: "RESOLVED", profile, explanation: `Using ${profile.displayTitle} (${profile.releaseVersion}); this is governed assessment guidance, not an inferred national rule.` };
}

export function resolveAssessmentProfile(input: {
  candidates: AssessmentProfileCandidate[];
  subjectProfileId: string;
  subjectId: string;
  educationLevel: string;
  subject: string;
  purpose: AssessmentPurpose;
  effectiveOn: string;
}): ProfileResolution {
  const matching = input.candidates.filter((candidate) =>
    candidate.purpose === input.purpose &&
    (candidate.subjectProfileId === input.subjectProfileId || candidate.subjectProfileId === null) &&
    candidate.subjectId === input.subjectId &&
    candidate.educationLevel === input.educationLevel &&
    candidate.subject === input.subject &&
    candidate.verificationStatus === "VERIFIED" &&
    candidate.effectiveFrom <= input.effectiveOn &&
    (candidate.effectiveTo === null || candidate.effectiveTo >= input.effectiveOn) &&
    candidate.rightsState !== "RESTRICTED"
  );
  const candidate = matching.sort((left, right) => Number(right.subjectProfileId === input.subjectProfileId) - Number(left.subjectProfileId === input.subjectProfileId))[0];
  if (!candidate) return { state: "UNAVAILABLE", profile: null, explanation: "No verified assessment profile is currently activated for this subject and purpose." };
  return { state: "RESOLVED", profile: candidate, explanation: `Using ${candidate.displayTitle} (${candidate.releaseVersion}); this is governed assessment guidance, not an inferred national rule.` };
}
