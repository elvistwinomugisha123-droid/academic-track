"use client";

import { Sparkles } from "lucide-react";
import { useEffect, useState } from "react";

const stages = ["Checking your lesson and class context", "Bringing your confirmed topic into view", "Shaping a practical teaching sequence", "Putting the draft into a readable document", "Still working carefully on your draft"];
export function GenerationProgress({ material = "lesson" }: { material?: string }) {
  const [stage, setStage] = useState(0);
  useEffect(() => { const timer = window.setInterval(() => setStage((current) => Math.min(current + 1, stages.length - 1)), 5000); return () => window.clearInterval(timer); }, []);
  return <div className="generation-progress" role="status" aria-live="polite"><div className="generation-progress-mark"><Sparkles size={32} /></div><span className="section-kicker">ATE is preparing your {material}</span><h2>{stages[stage]}<span className="progress-ellipsis">…</span></h2><p>You can review the draft before saving anything.</p><div className="generation-progress-track"><i key={stage} /></div></div>;
}
