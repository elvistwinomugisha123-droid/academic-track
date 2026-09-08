import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { Assessment } from "@/domain/types";

const styles = StyleSheet.create({ page: { padding: 42, fontFamily: "Helvetica", fontSize: 11, color: "#17231f" }, title: { fontSize: 18, marginBottom: 6 }, meta: { fontSize: 9, color: "#66736d", marginBottom: 18 }, instruction: { marginBottom: 4 }, question: { marginTop: 14 }, questionText: { fontSize: 11, lineHeight: 1.35 }, guide: { marginTop: 5, color: "#315d8c", fontSize: 9, lineHeight: 1.3 } });

export function QuestionPaperDocument({ assessment }: { assessment: Assessment }) {
  return <Document title={assessment.title}><Page size="A4" style={styles.page}><Text style={styles.title}>{assessment.title}</Text><Text style={styles.meta}>{assessment.durationMinutes} minutes · {assessment.totalMarks} marks · Teacher-review required</Text>{assessment.questions.length === 0 ? <Text>No questions have been added.</Text> : <>{assessment.questions.map((question, index) => <View style={styles.question} key={question.id}><Text style={styles.questionText}>{index + 1}. {question.text} ({question.marks} marks)</Text></View>)}</>}</Page></Document>;
}

export function MarkingGuideDocument({ assessment }: { assessment: Assessment }) {
  return <Document title={`${assessment.title} · Marking Guide`}><Page size="A4" style={styles.page}><Text style={styles.title}>{assessment.title} · Marking Guide</Text><Text style={styles.meta}>Drafted from structured assessment state · review before use</Text>{assessment.questions.map((question, index) => <View style={styles.question} key={question.id}><Text style={styles.questionText}>{index + 1}. {question.text} · {question.marks} marks</Text>{question.markingGuide.map((point, pointIndex) => <Text style={styles.guide} key={`${question.id}-${pointIndex}`}>• {point} ({Math.ceil(question.marks / Math.max(1, question.markingGuide.length))})</Text>)}</View>)}</Page></Document>;
}
