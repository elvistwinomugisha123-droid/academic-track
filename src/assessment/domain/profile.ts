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
  return /^\d{4}-\d{2}-\d{2}$/.test(assessmentDate) && /^\d{4}-\d{2}-\d{2}$/.test(effectiveFrom) && effectiveFrom <= assessmentDate && (effectiveTo === null || /^\d{4}-\d{2}-\d{2}$/.test(effectiveTo) && effectiveTo >= assessmentDate);
}

export function resolveRuntimeAssessmentProfile(input: RuntimeAssessmentProfileInput): ProfileResolution {
  const releaseApplicable = input.release.status === "ACTIVE" && isDateApplicable(input.assessmentDate, input.release.effectiveFrom, input.release.effectiveTo);
  const profileApplicable = input.profile.status === "ACTIVE" && input.profile.releaseId === input.release.id;
  const subjectProfileApplicable = input.subjectProfile.id === input.subjectProfileId && input.profile.subjectProfileId === input.subjectProfileId && input.subjectProfile.status === "ACTIVE" && input.subjectProfile.runtimeStatus === "PILOT_ACTIVE";
  const subjectBindingApplicable = input.subjectBinding?.status === "ACTIVE" && isDateApplicable(input.assessmentDate, input.subjectBinding.effectiveFrom, input.subjectBinding.effectiveTo);
  const sectionBindingsApplicable = input.sectionIds.length > 0 && input.sectionIds.every((sectionId) => input.sectionBindings.some((binding) => binding.sectionId === sectionId && binding.status === "ACTIVE" && isDateApplicable(input.assessmentDate, binding.effectiveFrom, binding.effectiveTo)));
  const allRightsCleared = input.sources.length > 0 && input.sources.every((source) => source.rightsStatus === "CLEARED" && source.productionUseStatus === "PERMITTED");
  const allPilotAuthorised = input.sources.length > 0 && input.sources.every((source) => ["CLEARED", "OPERATOR_AUTHORIZED_FOR_PILOT"].includes(source.rightsStatus) && source.productionUseStatus === "PERMITTED");
  const hasRestrictedRights = input.sources.some((source) => source.rightsStatus === "RESTRICTED" || source.productionUseStatus === "BLOCKED");
  const rightsState: AssessmentProfile["rightsState"] = input.sources.length === 0
    ? "UNKNOWN"
    : hasRestrictedRights
      ? "RESTRICTED"
      : allPilotAuthorised
        ? allRightsCleared ? "CLEARED" : "OPERATOR_AUTHORIZED_FOR_PILOT"
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
    curriculumReleaseId: input.subjectProfile.releaseId,
    releaseVersion: input.release.versionLabel,
    verificationStatus: applicable ? "VERIFIED" : "UNVERIFIED",
    rightsState,
    externalAiAllowed: allPilotAuthorised && input.sources.every((source) => source.externalAiAllowed),
    exportAllowed: allPilotAuthorised && input.sources.every((source) => source.exportAllowed),
    effectiveFrom: input.release.effectiveFrom,
    effectiveTo: input.release.effectiveTo,
    allowsBroaderScope: input.profile.allowsBroaderScope,
    allowsPartialScope: input.profile.allowsPartialScope,
    requiresReview: input.profile.requiresReview,
    productionUseStatus: allPilotAuthorised ? "PERMITTED" : hasRestrictedRights ? "BLOCKED" : "PERMISSION_PENDING",
    formalArtifactAllowed: allPilotAuthorised && input.sources.every((source) => source.formalArtifactAllowed),
    releaseStatus: input.release.status as AssessmentProfile["releaseStatus"],
    subjectProfileStatus: input.subjectProfile.status as AssessmentProfile["subjectProfileStatus"],
    subjectProfileRuntimeStatus: input.subjectProfile.runtimeStatus as AssessmentProfile["subjectProfileRuntimeStatus"],
    applicable,
    assessmentDate: input.assessmentDate,
    subjectProfileId: input.subjectProfileId,
    subjectId: input.subjectId,
    educationLevel: input.subjectProfile.educationLevel,
  };
  if (!releaseApplicable) return { state: "UNAVAILABLE", profile: null, explanation: input.release.status !== "ACTIVE" ? "The assessment release has not been activated by an academic reviewer." : !input.release.effectiveFrom ? "The assessment release has no approved effective date. An academic reviewer must set one before use." : "The assessment release is outside its approved effective dates. Choose an applicable date or ask an academic reviewer to check the release." };
  if (!profileApplicable) return { state: "UNAVAILABLE", profile: null, explanation: "This assessment profile is not active in the approved release. An academic reviewer must verify and activate it." };
  if (!subjectProfileApplicable) return { state: "UNAVAILABLE", profile: null, explanation: "The subject curriculum profile is not active for this pilot or does not match this assessment release. Ask an administrator to check the governed subject and level." };
  if (!subjectBindingApplicable) return { state: "UNAVAILABLE", profile: null, explanation: "This subject is not bound to the curriculum profile for the assessment date. Ask the school administrator to verify the subject binding." };
  if (!sectionBindingsApplicable) return { state: "UNAVAILABLE", profile: null, explanation: "One or more selected Teaching Sections lack an active curriculum binding for the assessment date. Ask the school administrator to verify each section." };
  if (!allPilotAuthorised) return { state: "UNAVAILABLE", profile: null, explanation: input.sources.length === 0 ? "No approved assessment source is attached to this profile. Academic review and source rights are required." : "Assessment source rights or production use have not been approved for this pilot. A reviewer must resolve the source decision." };
  if (!profile.formalArtifactAllowed) return { state: "UNAVAILABLE", profile: null, explanation: "The source decision does not permit a formal assessment artifact. A reviewer must confirm that purpose before activation." };
  return { state: "RESOLVED", profile, explanation: `Using ${profile.displayTitle} (${profile.releaseVersion}); this is verified assessment guidance, not an inferred national rule.` };
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
    ["CLEARED", "OPERATOR_AUTHORIZED_FOR_PILOT"].includes(candidate.rightsState) && candidate.productionUseStatus === "PERMITTED"
  );
  const candidate = matching.sort((left, right) => Number(right.subjectProfileId === input.subjectProfileId) - Number(left.subjectProfileId === input.subjectProfileId))[0];
  if (!candidate) return { state: "UNAVAILABLE", profile: null, explanation: "No verified assessment profile is currently activated for this subject and purpose." };
  return { state: "RESOLVED", profile: candidate, explanation: `Using ${candidate.displayTitle} (${candidate.releaseVersion}); this is verified assessment guidance, not an inferred national rule.` };
}
