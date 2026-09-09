# Knowledge Source Working Area

This directory documents the **local/private curriculum-source workflow** for ATE.

Only this README is intended to be committed.

The actual source and derived content should remain local/private unless a specific item has been reviewed and deliberately approved for Git.

## Local structure

Create these directories locally:

```text
knowledge-sources/
├── raw/
│   ├── lower-secondary/
│   │   ├── syllabi/
│   │   ├── teacher-guidance/
│   │   └── assessment/
│   ├── advanced-secondary/
│   │   ├── syllabi/
│   │   ├── assessment-framework/
│   │   └── assessment-guidelines/
│   └── supporting/
├── derived/
│   ├── manifests/
│   ├── structured/
│   └── source-spans/
└── review/
    ├── validation/
    └── human-review/
```

These subdirectories are gitignored.

## What you should do with the PDFs

Place the original PDFs in `knowledge-sources/raw/`.

Do **not** manually convert every file to Markdown.

The intended workflow is:

1. **Inventory**
   - identify authority;
   - document title;
   - level;
   - subject;
   - document type;
   - publication/effective year;
   - checksum;
   - rights notice/status.

2. **Classify**
   - Lower Secondary syllabus;
   - Advanced Secondary syllabus;
   - assessment framework;
   - subject assessment guideline;
   - teacher/textbook guidance;
   - supporting source.

3. **Extract**
   - preserve the original file unchanged;
   - produce canonical JSON/JSONL working data;
   - retain page/source-span provenance;
   - do not flatten everything into one prose file.

4. **Validate**
   - schema validation;
   - page/source traceability;
   - duplicate/relationship checks;
   - human review queue for uncertain extraction.

5. **Review**
   - Codex/ATE tooling may propose structured data;
   - a human verifies material facts before it is considered canonical.

6. **Publish to production knowledge layer**
   - only content that is legally/operationally eligible for the intended use;
   - import into PostgreSQL through the rights-aware source registry;
   - private raw originals remain in controlled object storage.

## Canonical output direction

Examples:

```text
derived/
├── manifests/
│   └── ncdc-advanced-physics-2025.json
├── structured/
│   ├── subjects.json
│   ├── topics.jsonl
│   ├── learning-outcomes.jsonl
│   ├── assessment-constructs.jsonl
│   ├── assessment-indicators.jsonl
│   └── curriculum-relationships.jsonl
└── source-spans/
    └── source-spans.jsonl
```

The exact schema is owned by `packages/knowledge` / `knowledge-tools` as the v4 migration proceeds.

## Important rights rule

A PDF being publicly downloadable does not automatically mean ATE may reproduce, store, vectorise, redistribute or send its contents to an external AI provider.

The source registry must carry rights/permission metadata and the retrieval layer must enforce it.

Do not treat extracted JSON as automatically free of the source document's rights restrictions.

## First extraction target

Do not process every source at once.

Use a small end-to-end validation set first, for example:

- one Lower Secondary syllabus;
- one Advanced Secondary syllabus;
- the Advanced Secondary assessment framework;
- the matching subject assessment guideline.

Physics is a strong engineering test case because the current product discussions already include both Lower and Advanced Secondary lesson/assessment examples. This does **not** make ATE a Physics-only or Biology-only product.

Once the schema and validation pipeline are proven, run the same process across the wider subject corpus.
