import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { ReactNode } from "react";
import type { CanonicalArtifactVersion } from "@/artifacts/types";

const styles = StyleSheet.create({ page: { padding: 40, fontFamily: "Helvetica", fontSize: 10, color: "#122033" }, title: { fontSize: 18, marginBottom: 5 }, meta: { fontSize: 9, color: "#607084", marginBottom: 16 }, section: { marginTop: 12 }, heading: { fontSize: 12, color: "#0a4f86", marginBottom: 5 }, body: { lineHeight: 1.35, marginBottom: 4 }, item: { marginBottom: 3, lineHeight: 1.3 } });
function lines(values: string[]) { return values.filter(Boolean).map((value, index) => <Text style={styles.item} key={`${index}-${value}`}>• {value}</Text>); }
function section(title: string, content: ReactNode) { return <View style={styles.section}><Text style={styles.heading}>{title}</Text>{content}</View>; }

function renderPayload(artifact: Exclude<CanonicalArtifactVersion, { artifactType: "ASSESSMENT" }>) {
  switch (artifact.artifactType) {
    case "FORMAL_LESSON_PLAN": { const p = artifact.payload; return <>{section("Learning intention", <Text style={styles.body}>{p.learningIntention}</Text>)}{section("Expected outcome", <Text style={styles.body}>{p.expectedOutcome}</Text>)}{section("Curriculum anchor", <Text style={styles.body}>{p.curriculumAnchor?.title || "Teacher-authored planning context"}</Text>)}{section("Lesson focus", <Text style={styles.body}>{p.lessonFocus}</Text>)}{section("Prior learning and continuity", <Text style={styles.body}>{p.priorLearning} {p.continuityContext}</Text>)}{section("Resources", lines(p.resources))}{section("Teaching sequence", <>{p.teachingSequence.map((step, index) => <View style={styles.section} key={step.id}><Text style={styles.body}>{index + 1}. {step.label} · {step.minutes} minutes</Text><Text style={styles.item}>Teacher: {step.teacherActivity}</Text><Text style={styles.item}>Learners: {step.learnerActivity}</Text>{lines(step.prompts)}</View>)}</>)}{section("Differentiation and follow-up", <Text style={styles.body}>{p.differentiation} {p.conclusionFollowUp}</Text>)}</>; }
    case "BOARD_NOTES": { const p = artifact.payload; return <>{section("Key points", lines(p.keyPoints))}{section("Examples", lines(p.examples))}{section("Equations", lines(p.equations))}{section("Prompts", lines(p.prompts))}</>; }
    case "LEARNER_NOTES": { const p = artifact.payload; return <>{section("Key concepts", lines(p.keyConcepts))}{section("Explanation", <Text style={styles.body}>{p.explanation}</Text>)}{section("Examples", lines(p.examples))}{section("Applications", lines(p.applications))}{section("Summary", <Text style={styles.body}>{p.summary}</Text>)}</>; }
    case "ACTIVITY_SHEET": { const p = artifact.payload; return <>{section("Instructions", <Text style={styles.body}>{p.instructions}</Text>)}{section("Materials", lines(p.materialsRequired))}{section("Tasks", lines(p.tasks))}{section("Questions", lines(p.questions))}{section("Observation / response", <Text style={styles.body}>{p.observationResponseArea}</Text>)}{section("Conclusion", lines(p.conclusionPrompts))}</>; }
    case "LESSON_SUMMARY": { const p = artifact.payload; return <>{section("Key takeaways", lines(p.keyTakeaways))}{section("Summary", <Text style={styles.body}>{p.conciseSummary}</Text>)}{section("Learner reflection", <Text style={styles.body}>{p.learnerReflection}</Text>)}</>; }
    case "HOMEWORK": { const p = artifact.payload; return <>{section("Instructions", <Text style={styles.body}>{p.instructions}</Text>)}{section("Tasks", lines(p.tasks))}{section("Follow-up", <Text style={styles.body}>{p.followUpNotes}</Text>)}</>; }
  }
}

export function LessonArtifactDocument({ artifact, schoolName, lessonMeta }: { artifact: Exclude<CanonicalArtifactVersion, { artifactType: "ASSESSMENT" }>; schoolName: string; lessonMeta: string }) {
  return <Document title={artifact.payload.title}><Page size="A4" style={styles.page}><Text style={styles.title}>{artifact.payload.title}</Text><Text style={styles.meta}>{schoolName} · {lessonMeta} · Saved version {artifact.versionId}</Text>{renderPayload(artifact)}</Page></Document>;
}
