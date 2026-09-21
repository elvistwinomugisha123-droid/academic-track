import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import React from "react";
import type { CanonicalArtifactVersion } from "@/artifacts/types";

const styles = StyleSheet.create({ page: { padding: 42, fontFamily: "Helvetica", fontSize: 11, color: "#122033" }, school: { fontSize: 10, color: "#607084", marginBottom: 8 }, title: { fontSize: 18, marginBottom: 6 }, meta: { fontSize: 9, color: "#607084", marginBottom: 18 }, instructions: { marginBottom: 12, padding: 10, backgroundColor: "#f3f7fa" }, instruction: { fontSize: 9, lineHeight: 1.35, marginBottom: 3 }, question: { marginTop: 14 }, questionText: { fontSize: 11, lineHeight: 1.35 }, guide: { marginTop: 5, color: "#0878c9", fontSize: 9, lineHeight: 1.3 }, footer: { marginTop: 24, paddingTop: 10, borderTop: "1pt solid #d8e1e8", fontSize: 8, color: "#607084" } });

function payloadOf(artifact: CanonicalArtifactVersion) { if (artifact.artifactType !== "ASSESSMENT") throw new Error("Unsupported artifact type for assessment renderer."); return artifact.payload; }

type AssessmentDocumentMeta = { schoolName?: string; subject?: string; classLabel?: string; date?: string };

export function QuestionPaperDocument({ artifact, meta = {} }: { artifact: CanonicalArtifactVersion; meta?: AssessmentDocumentMeta }) {
  const assessment = payloadOf(artifact);
  return <Document title={assessment.title}><Page size="A4" style={styles.page}>{meta.schoolName && <Text style={styles.school}>{meta.schoolName}</Text>}<Text style={styles.title}>{assessment.title}</Text><Text style={styles.meta}>{[meta.subject, meta.classLabel, meta.date].filter(Boolean).join(" · ")} {[meta.subject || meta.classLabel || meta.date ? "· " : ""]}{assessment.durationMinutes} minutes · {assessment.totalMarks} marks</Text>{"instructions" in assessment && assessment.instructions.length > 0 && <View style={styles.instructions}><Text style={styles.school}>Candidate instructions</Text>{assessment.instructions.map((instruction) => <Text style={styles.instruction} key={instruction}>• {instruction}</Text>)}</View>}{assessment.questions.length === 0 ? <Text>No questions have been added.</Text> : <>{assessment.questions.map((question, index) => <View style={styles.question} key={question.id}><Text style={styles.questionText}>{index + 1}. {question.text} ({question.marks} marks)</Text></View>)}</>}<Text style={styles.footer}>Prepared in ATE Assessment Studio · {artifact.status === "FINAL" ? "Final version" : "Teacher-review required"}</Text></Page></Document>;
}

export function MarkingGuideDocument({ artifact, meta = {} }: { artifact: CanonicalArtifactVersion; meta?: AssessmentDocumentMeta }) {
  const assessment = payloadOf(artifact);
  return <Document title={`${assessment.title} · Marking Guide`}><Page size="A4" style={styles.page}>{meta.schoolName && <Text style={styles.school}>{meta.schoolName}</Text>}<Text style={styles.title}>{assessment.title} · Marking Guide</Text><Text style={styles.meta}>{[meta.subject, meta.classLabel, meta.date].filter(Boolean).join(" · ")} · {assessment.totalMarks} marks · canonical version {artifact.versionId}</Text>{assessment.questions.map((question, index) => <View style={styles.question} key={question.id}><Text style={styles.questionText}>{index + 1}. {question.text} · {question.marks} marks</Text>{question.markingGuide.map((point, pointIndex) => <Text style={styles.guide} key={`${question.id}-${pointIndex}`}>• {point}</Text>)}</View>)}<Text style={styles.footer}>Teacher marking instrument · ATE does not mark learner scripts</Text></Page></Document>;
}
