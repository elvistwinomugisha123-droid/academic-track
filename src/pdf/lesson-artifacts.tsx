import React from "react";
import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { CanonicalArtifactVersion } from "@/artifacts/types";
import { lessonArtifactRenderModel } from "@/artifacts/lesson-render";

const styles = StyleSheet.create({ page: { padding: 40, fontFamily: "Helvetica", fontSize: 10, color: "#122033" }, title: { fontSize: 18, marginBottom: 5 }, meta: { fontSize: 9, color: "#607084", marginBottom: 16 }, section: { marginTop: 12 }, heading: { fontSize: 12, color: "#0a4f86", marginBottom: 5 }, body: { lineHeight: 1.35, marginBottom: 4 }, item: { marginBottom: 3, lineHeight: 1.3 } });
function renderPayload(artifact: Exclude<CanonicalArtifactVersion, { artifactType: "ASSESSMENT" }>) {
  const model = lessonArtifactRenderModel(artifact);
  return <>{model.sections.map((item) => <View style={styles.section} key={item.heading}><Text style={styles.heading}>{item.heading}</Text>{item.paragraphs?.map((value) => <Text style={styles.body} key={value}>{value}</Text>)}{item.items?.map((value, index) => <Text style={styles.item} key={`${index}-${value}`}>• {value}</Text>)}{item.sequence?.map((step, index) => <View style={styles.section} key={step.label + index}><Text style={styles.body}>{index + 1}. {step.label} · {step.minutes} minutes</Text><Text style={styles.item}>Teacher: {step.teacherActivity}</Text><Text style={styles.item}>Learners: {step.learnerActivity}</Text>{step.prompts.map((prompt) => <Text style={styles.item} key={prompt}>• {prompt}</Text>)}{step.formativeCheck && <Text style={styles.item}>Check: {step.formativeCheck}</Text>}</View>)}</View>)}</>;
}

export function LessonArtifactDocument({ artifact, schoolName, lessonMeta }: { artifact: Exclude<CanonicalArtifactVersion, { artifactType: "ASSESSMENT" }>; schoolName: string; lessonMeta: string }) {
  return <Document title={artifact.payload.title}><Page size="A4" style={styles.page}><Text style={styles.title}>{artifact.payload.title}</Text><Text style={styles.meta}>{schoolName} · {lessonMeta} · Saved version {artifact.versionId}</Text>{renderPayload(artifact)}</Page></Document>;
}
