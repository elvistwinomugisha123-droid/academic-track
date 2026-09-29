"use client";

import Link from "next/link";
import { BookOpen, MessageCircle, Send, Sparkles } from "lucide-react";
import { useState, useTransition } from "react";
import { askATEAboutLesson } from "@/teacher/application/ai-artifact-actions";
import type { TeacherLesson } from "@/teacher/application/queries";

const suggestions = ["How can I introduce this topic?", "Suggest an activity for a large class.", "How can I check understanding?"];
export function AskATEWorkspace({ lesson }: { lesson: TeacherLesson | null }) {
  const [question, setQuestion] = useState("");
  const [history, setHistory] = useState<{ question: string; answer: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const ask = (text = question) => {
    if (!lesson || !text.trim() || pending) return;
    setError(null);
    startTransition(async () => {
      const result = await askATEAboutLesson({ scheduledLessonId: lesson.id, question: text });
      if (result.ok) { setHistory((items) => [...items, { question: text, answer: result.answer }]); setQuestion(""); }
      else setError(result.error);
    });
  };
  return <div className="ask-page"><header className="ask-heading"><span className="ask-icon"><Sparkles size={25} /></span><p className="eyebrow">Your teaching assistant</p><h1>Ask ATE</h1><p>Get practical ideas for the class you are preparing. You decide what to use.</p></header>
    {lesson ? <><div className="ask-context"><BookOpen size={18} /><div><strong>{lesson.section.subjectName} · {lesson.section.classLevelName} {lesson.section.streamName}</strong><span>{lesson.currentPosition?.title || "No current topic confirmed"}</span></div><Link href={`/workspace/teacher/lessons/${lesson.id}`}>Open lesson</Link></div>
    <div className="ask-conversation" aria-live="polite">{history.length === 0 && <div className="ask-welcome"><MessageCircle size={25} /><h2>What would help with this lesson?</h2><p>Ask about an activity, a classroom constraint, or a way to check learning. ATE uses this class context; it does not change your records.</p></div>}{history.map((item, index) => <div className="ask-exchange" key={index}><p className="ask-question">{item.question}</p><div className="ask-answer"><strong>ATE suggests</strong><p>{item.answer}</p></div></div>)}</div>
    {history.length === 0 && <div className="ask-suggestions">{suggestions.map((item) => <button key={item} type="button" onClick={() => ask(item)} disabled={pending}>{item}</button>)}</div>}
    {error && <p className="ask-error" role="alert">{error}</p>}
    <form className="ask-composer" onSubmit={(event) => { event.preventDefault(); ask(); }}><label htmlFor="ask-question">Your question</label><div><input id="ask-question" value={question} onChange={(event) => setQuestion(event.target.value)} maxLength={1000} placeholder="Ask about this class…" disabled={pending} /><button type="submit" aria-label="Send question" disabled={pending || question.trim().length < 3}><Send size={20} /></button></div><small>{pending ? "ATE is thinking…" : "Suggestions need your review before use."}</small></form></> : <div className="ask-welcome"><p>Ask ATE needs an upcoming lesson to provide class-specific help.</p><Link className="button button-primary" href="/workspace/teacher/sections">View your classes</Link></div>}
  </div>;
}
