# Academic Track Engine

Academic Track Engine (ATE) is a teacher-first academic operations system for secondary schools.

This repository contains the initial product implementation, product specifications, design system guidance, curriculum authority data, and AI-assisted academic workflows for ATE.

## Start Here

Before implementing or modifying the product, read:

1. `AGENTS.md` — repository operating rules for Codex and other coding agents.
2. `PRODUCT.md` — authoritative product definition and scope.
3. `DESIGN.md` — authoritative visual and interaction direction.
4. `docs/DOMAIN_MODEL.md` — domain entities, states, and invariants.
5. `docs/ARCHITECTURE.md` — current technical architecture and boundaries.
6. `docs/PRODUCT_FLOWS.md` — user journeys and state transitions.
7. `docs/CURRICULUM_DATA.md` — curriculum authority and provenance model.
8. `docs/AI_SYSTEM.md` — AI responsibilities, constraints, and structured-output contracts.
9. `docs/DECISIONS.md` — accepted product and engineering decisions.
10. `docs/ACCEPTANCE_CRITERIA.md` — quality gates for the initial release.
11. `docs/IMPLEMENTATION_PLAN.md` — recommended implementation sequence.

Visual references live in `reference-ui/`. They are advisory art direction only. Read `reference-ui/README.md` before using them.

Structured curriculum files live in `curriculum-data/` when supplied. Those files are authoritative inputs for curriculum context; screenshots and generated UI copy are not.

## Initial Product Scope

The initial supported configuration focuses on:

- one school workspace;
- Biology;
- Senior 1 and Senior 2;
- multiple parallel streams;
- Teacher, Head of Department, Director of Studies, and Principal roles;
- curriculum-grounded lesson preparation;
- teacher-confirmed lesson outcomes;
- multi-stream continuity;
- curriculum-aware assessment generation;
- academic exception and recovery workflows;
- supporting resource discovery;
- school-level academic visibility.

The implementation must treat these values as configuration and domain data, not as hard-coded UI assumptions.

## Core Product Principle

ATE separates four categories of information:

1. **Curriculum authority** — what the official curriculum source states.
2. **School operational truth** — timetable, assignments, school structure, resources, and approved academic configuration.
3. **Classroom reality** — teacher-confirmed facts about what actually happened.
4. **AI recommendations** — generated drafts, adaptations, explanations, and resource recommendations.

These categories must never be conflated.

## Engineering Direction

The current implementation favors a deliberately simple architecture:

- Next.js
- TypeScript
- Tailwind CSS
- Radix UI / customized shadcn primitives
- Zustand
- Zod
- React Hook Form
- TanStack Table where appropriate
- Motion for restrained interaction transitions
- browser-side persistence for the initial release
- server-side API routes for AI and external resource calls
- structured curriculum data as deterministic input

Do not introduce infrastructure for hypothetical future scale before a current requirement justifies it.
