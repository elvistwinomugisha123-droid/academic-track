export const teacherOutcomes = ["DELIVERED", "PARTIALLY_DELIVERED", "NOT_DELIVERED", "CHANGED"] as const;
export type TeacherOutcome = (typeof teacherOutcomes)[number];

export type TeacherPositionKind = "TOPIC" | "LEARNING_OUTCOME";

export type PositionOption = {
  canonicalId: string;
  recordType: "topic" | "learning_outcome";
  positionKind: TeacherPositionKind;
  title: string;
  sourceWording: string;
  orderingKey: string | null;
  topicCode: string | null;
  level: string | null;
  term: string | null;
};

export type CurrentPosition = PositionOption & {
  eventId: string;
  confirmedAt: string;
  sourceId?: string;
  sourceTitle: string;
  sourceAuthority: string;
  sourceLocator: string;
  sourcePageStart: number;
  sourcePageEnd: number;
  sourceChecksum: string;
  rightsStatus?: "CLEARED" | "REVIEW_REQUIRED" | "RESTRICTED" | "UNKNOWN";
  productionUseStatus?: "PERMITTED" | "PERMISSION_PENDING" | "BLOCKED";
  formalArtifactAllowed?: boolean;
  externalAiAllowed?: boolean;
  exportAllowed?: boolean;
  attributionRequired?: boolean;
};

export const safeCurriculumPositionLabel = "Current confirmed curriculum position";

export function safeCurrentPositionTitle(current: Pick<CurrentPosition, "title" | "rightsStatus" | "productionUseStatus" | "formalArtifactAllowed">): string {
  const sourceWordedArtifactUseAllowed = current.formalArtifactAllowed !== false
    && (current.rightsStatus === undefined || current.rightsStatus === "CLEARED")
    && (current.productionUseStatus === undefined || current.productionUseStatus === "PERMITTED");
  return sourceWordedArtifactUseAllowed ? current.title : safeCurriculumPositionLabel;
}

export function formalArtifactRightsState(current: Pick<CurrentPosition, "rightsStatus" | "productionUseStatus" | "formalArtifactAllowed">): "CLEARED" | "REVIEW_REQUIRED" | "RESTRICTED" | "UNKNOWN" {
  if (current.rightsStatus === "RESTRICTED") return "RESTRICTED";
  if (current.rightsStatus === "CLEARED" && current.productionUseStatus === "PERMITTED" && current.formalArtifactAllowed) return "CLEARED";
  if (current.rightsStatus === "REVIEW_REQUIRED" || current.rightsStatus === "CLEARED") return "REVIEW_REQUIRED";
  return current.rightsStatus ?? "UNKNOWN";
}

export type NextPositionProposal = {
  position: PositionOption | null;
  reason: "CONTINUE_UNFINISHED" | "ADVANCE_TO_NEXT_VALID_POSITION" | "NO_DETERMINISTIC_SUCCESSOR";
  label: string;
};

export function positionKindForRecordType(recordType: string): TeacherPositionKind | null {
  if (recordType === "topic") return "TOPIC";
  if (recordType === "learning_outcome") return "LEARNING_OUTCOME";
  return null;
}

export function deriveNextPosition(input: { outcome: TeacherOutcome; current: CurrentPosition | null; options: PositionOption[] }): NextPositionProposal {
  if (input.outcome !== "DELIVERED") {
    return input.current
      ? { position: input.current, reason: "CONTINUE_UNFINISHED", label: "Continue from the confirmed position" }
      : { position: null, reason: "NO_DETERMINISTIC_SUCCESSOR", label: "Confirm a curriculum position before the next lesson" };
  }

  if (!input.options.length) {
    return { position: null, reason: "NO_DETERMINISTIC_SUCCESSOR", label: "No next governed position is available" };
  }

  if (!input.current) {
    return { position: input.options[0], reason: "ADVANCE_TO_NEXT_VALID_POSITION", label: "Start at the first valid governed position" };
  }

  const currentIndex = input.options.findIndex((option) => option.canonicalId === input.current?.canonicalId);
  const next = currentIndex >= 0 ? input.options[currentIndex + 1] ?? null : null;
  return next
    ? { position: next, reason: "ADVANCE_TO_NEXT_VALID_POSITION", label: "Advance to the next valid governed position" }
    : { position: null, reason: "NO_DETERMINISTIC_SUCCESSOR", label: "The current position is the last available governed position" };
}

export function recommendedFocus(input: { current: CurrentPosition | null; previousOutcome: TeacherOutcome | null; unfinishedWork: string | null; scheduledSubject: string }): string {
  if (input.unfinishedWork?.trim()) return `Complete the unfinished work: ${input.unfinishedWork.trim()}`;
  if (input.previousOutcome === "NOT_DELIVERED") return "Re-establish the planned lesson context before introducing new work.";
  if (input.previousOutcome === "CHANGED") return "Reconnect the changed lesson with the confirmed curriculum position.";
  if (input.previousOutcome === "PARTIALLY_DELIVERED") return "Continue from the stopping point recorded in the previous lesson.";
  if (input.current) return `Continue ${input.scheduledSubject} from ${safeCurrentPositionTitle(input.current)}.`;
  return `Set the starting point for this ${input.scheduledSubject} lesson.`;
}

export function proposalIsConfirmed(proposal: NextPositionProposal, confirmedEventId: string | null): boolean {
  return Boolean(confirmedEventId) && proposal.position === null;
}
