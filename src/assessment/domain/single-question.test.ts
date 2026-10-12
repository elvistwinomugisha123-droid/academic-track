import { expect, it } from "vitest";
import { singleQuestionChangeError } from "./single-question";
import type { AssessmentPayload } from "./types";

const paper: AssessmentPayload = {
  title: "Chemistry class test", purpose: "CLASS_TEST", durationMinutes: 30, totalMarks: 4, instructions: ["Answer both questions."],
  blueprint: { participatingSectionIds: ["00000000-0000-0000-0000-000000000001"], scopeCanonicalIds: ["topic-a"], expectedEvidence: "Written response", itemDistribution: { SHORT_ANSWER: 2 }, difficultyDistribution: { LOW: 0, MEDIUM: 2, HIGH: 0 }, marksDistribution: { SHORT_ANSWER: 4 }, totalMarks: 4, durationMinutes: 30, practicalRequirements: [], accessibilityConstraints: [], subjectConstraints: [], teacherNotes: "" },
  questions: ["q1", "q2"].map((id) => ({ id, text: "Explain the observed change in the mixture.", marks: 2, itemType: "SHORT_ANSWER" as const, difficulty: "MEDIUM" as const, cognitiveDemand: null, canonicalIds: ["topic-a"], markingGuide: ["2 marks: identifies the relevant change"], expectedResponse: "A change is observed.", rubric: null })),
};

it("allows a teacher-reviewed replacement of only the selected question", () => {
  const proposal = structuredClone(paper);
  proposal.questions[1].text = "A measured sample changes colour after a reagent is added. State the observation and one possible reason.";
  proposal.questions[1].markingGuide = ["1 mark: states the colour change", "1 mark: explains the relevant reaction"];
  expect(singleQuestionChangeError(paper, proposal, "q2")).toBeNull();
  proposal.questions[0].text = "Another change";
  expect(singleQuestionChangeError(paper, proposal, "q2")).toContain("outside the selected question");
});

it("preserves marks, scope, order, blueprint and the saved question identity", () => {
  const proposal = structuredClone(paper);
  proposal.questions[0].marks = 3;
  expect(singleQuestionChangeError(paper, proposal, "q1")).toContain("marks");
  proposal.questions[0].marks = 2;
  proposal.questions[0].canonicalIds = ["topic-b"];
  expect(singleQuestionChangeError(paper, proposal, "q1")).toContain("curriculum scope");
  proposal.questions[0].canonicalIds = ["topic-a"];
  proposal.blueprint.teacherNotes = "changed";
  expect(singleQuestionChangeError(paper, proposal, "q1")).toContain("blueprint");
});
