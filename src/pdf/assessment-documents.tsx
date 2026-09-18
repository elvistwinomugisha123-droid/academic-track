import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import React from "react";
import type { CanonicalArtifactVersion } from "@/artifacts/types";

const styles = StyleSheet.create({ page: { padding: 42, fontFamily: "Helvetica", fontSize: 11, color: "#122033" }, title: { fontSize: 18, marginBottom: 6 }, meta: { fontSize: 9, color: "#607084", marginBottom: 18 }, question: { marginTop: 14 }, questionText: { fontSize: 11, lineHeight: 1.35 }, guide: { marginTop: 5, color: "#0878c9", fontSize: 9, lineHeight: 1.3 } });

function payloadOf(artifact: CanonicalArtifactVersion) { if (artifact.artifactType !== "ASSESSMENT") throw new Error("Unsupported artifact type for assessment renderer."); return artifact.payload; }

export function QuestionPaperDocument({ artifact }: { artifact: CanonicalArtifactVersion }) {
  const assessment = payloadOf(artifact);
  return <Document title={assessment.title}><Page size="A4" style={styles.page}><Text style={styles.title}>{assessment.title}</Text><Text style={styles.meta}>{assessment.durationMinutes} minutes · {assessment.totalMarks} marks · {artifact.status === "FINAL" ? "Final" : "Teacher-review required"}</Text>{assessment.questions.length === 0 ? <Text>No questions have been added.</Text> : <>{assessment.questions.map((question, index) => <View style={styles.question} key={question.id}><Text style={styles.questionText}>{index + 1}. {question.text} ({question.marks} marks)</Text></View>)}</>}</Page></Document>;
}

export function MarkingGuideDocument({ artifact }: { artifact: CanonicalArtifactVersion }) {
  const assessment = payloadOf(artifact);
  return <Document title={`${assessment.title} · Marking Guide`}><Page size="A4" style={styles.page}><Text style={styles.title}>{assessment.title} · Marking Guide</Text><Text style={styles.meta}>Canonical artifact version {artifact.versionId} · review before use</Text>{assessment.questions.map((question, index) => <View style={styles.question} key={question.id}><Text style={styles.questionText}>{index + 1}. {question.text} · {question.marks} marks</Text>{question.markingGuide.map((point, pointIndex) => <Text style={styles.guide} key={`${question.id}-${pointIndex}`}>• {point}</Text>)}</View>)}</Page></Document>;
}
