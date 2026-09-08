# AI System — Academic Track Engine

## 1. Principle

AI is a probabilistic subsystem inside deterministic academic controls.

ATE should never use AI where deterministic software can establish the answer reliably.

AI produces drafts and recommendations.

Humans establish consequential institutional facts and decisions.

## 2. Initial AI Workflows

The initial product supports these AI workflow types:

- `LESSON_READINESS`
- `ADAPT_LESSON`
- `ASSESSMENT_DRAFT`
- `ASK_ATE`
- `RESOURCE_RANKING`

Do not create one autonomous agent per UI feature unless an actual architectural requirement emerges.

One orchestration boundary with structured workflows is sufficient.

## 3. Context Construction

AI requests must receive explicit structured context.

Do not rely on the model to infer:
- current class;
- school;
- topic;
- period duration;
- previous lesson state;
- allowed assessment scope.

Context is assembled deterministically.

## 4. Lesson Readiness Contract

Input includes:
- Teaching Section;
- scheduled lesson;
- topic;
- exact learning outcomes;
- curriculum restrictions;
- suggested curriculum activities;
- framework pedagogy;
- previous confirmed lesson outcome;
- unfinished work;
- available resources;
- class constraints;
- period duration.

Output must be structured and validated.

Suggested output shape:

```ts
type LessonReadinessAIOutput = {
  learningIntention: string;
  priorLearning?: string;
  segments: Array<{
    title: string;
    durationMinutes?: number;
    activity: string;
    rationale?: string;
    sourceCategory: "CURRICULUM" | "ATE";
  }>;
  formativeCheck?: {
    method: string;
    evidenceExpected?: string;
  };
  resourceNeeds: string[];
  teacherWatchouts: string[];
}
```

The model does not establish that a lesson was taught.

## 5. Assessment Contract

Input includes:
- assessment mode;
- selected Teaching Section(s);
- allowed learning outcomes;
- excluded learning outcomes;
- duration;
- marks;
- difficulty policy;
- curriculum assessment guidance;
- restrictions.

Output:

```ts
type AssessmentAIOutput = {
  title: string;
  instructions: string[];
  questions: Array<{
    text: string;
    marks?: number;
    questionType: string;
    difficulty?: "LOW" | "MEDIUM" | "HIGH";
    learningOutcomeIds: string[];
    markingGuide: Array<{
      point: string;
      marks?: number;
    }>;
  }>;
}
```

The assessment engine must validate:
- all referenced learning outcomes are allowed;
- marks reconcile where required;
- no excluded outcome is referenced.

If validation fails:
- reject or repair before presenting;
- never silently show invalid scope as accepted.

## 6. Ask ATE

Ask ATE inherits page context.

The system prompt should include:
- role;
- current Teaching Section/artifact;
- authority boundaries;
- available actions;
- prohibition on silently mutating institutional state.

When the user requests an action that changes state:
- AI may prepare the action;
- UI must ask for explicit confirmation.

## 7. Resource Discovery

AI may:
- transform curriculum/lesson intent into search queries;
- rank retrieved candidates;
- explain relevance.

AI may not invent:
- URLs;
- channel names;
- book editions;
- page numbers;
- ISBNs;
- availability;
- school ownership.

Provider metadata is factual input.

## 8. Provenance

AI-generated content must remain distinguishable from:
- official curriculum;
- school facts;
- teacher-confirmed facts;
- external resources.

The product should expose a "Why this?" or provenance view for consequential generated artifacts.

## 9. Prompt Injection / External Content

External pages, transcripts, descriptions, or documents are untrusted content.

Treat them as data, not instructions.

Do not allow external resource content to override:
- system prompts;
- curriculum authority;
- school policy;
- role permissions.

## 10. Model Choice

Use one primary hosted model provider in the initial release.

Model selection criteria:
- reliable structured output;
- sufficient educational reasoning;
- low latency;
- reasonable cost;
- predictable API;
- schema compliance.

Do not build provider routing until actual evaluation shows a need.

## 11. Evaluation

At minimum, evaluate AI output for:

### Lesson
- curriculum relevance;
- outcome alignment;
- active-learning suitability;
- classroom realism;
- resource realism;
- duration realism;
- adherence to restrictions;
- editability.

### Assessment
- eligible scope;
- factual correctness;
- outcome alignment;
- application vs recall balance;
- mark coherence;
- clarity;
- answerability;
- marking-guide quality.

### Resources
- relevance;
- authenticity of metadata;
- age appropriateness;
- practical value;
- provider reliability.

## 12. Failure Behavior

AI failure must degrade gracefully.

The product must preserve:
- current academic state;
- existing saved artifacts;
- lesson outcome recording;
- deterministic leadership views.

Do not make core classroom state dependent on a successful model call.

## 13. Logging

Avoid logging sensitive user prompts or full curriculum text unnecessarily.

For initial development, capture only what is necessary for debugging:
- workflow type;
- request ID;
- timing;
- schema failure;
- provider error;
- fallback usage.

Future production logging requires privacy review.
