import type { AssessmentProfile, AssessmentPurpose, ProfileResolution } from "./types";

export type AssessmentProfileCandidate = AssessmentProfile & {
  subjectProfileId: string | null;
  subjectId: string;
  educationLevel: string;
  subject: string;
};

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
