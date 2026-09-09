CREATE TABLE knowledge_sources (
  source_id text PRIMARY KEY,
  authority text NOT NULL,
  title text NOT NULL,
  document_type text NOT NULL,
  education_level text NOT NULL CHECK (education_level IN ('lower-secondary', 'advanced-secondary', 'cross-level')),
  subject text,
  publication_year integer,
  effective_year integer,
  source_version text,
  checksum_sha256 text NOT NULL,
  rights_status text NOT NULL CHECK (rights_status IN ('CLEARED', 'REVIEW_REQUIRED', 'RESTRICTED', 'UNKNOWN')),
  production_use_status text NOT NULL CHECK (production_use_status IN ('PERMITTED', 'PERMISSION_PENDING', 'BLOCKED')),
  external_ai_allowed boolean NOT NULL DEFAULT false,
  attribution_required boolean NOT NULL DEFAULT true,
  processing_status text NOT NULL,
  verification_status text NOT NULL CHECK (verification_status IN ('UNVERIFIED', 'REVIEW_REQUIRED', 'VERIFIED')),
  source_path text NOT NULL,
  imported_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX knowledge_sources_subject_level_idx ON knowledge_sources (subject, education_level);
CREATE INDEX knowledge_sources_rights_idx ON knowledge_sources (rights_status, production_use_status);

CREATE TABLE knowledge_source_spans (
  span_id text PRIMARY KEY,
  source_id text NOT NULL REFERENCES knowledge_sources(source_id),
  page_start integer NOT NULL CHECK (page_start > 0),
  page_end integer NOT NULL CHECK (page_end >= page_start),
  locator text NOT NULL,
  source_text text NOT NULL,
  extraction_confidence text NOT NULL CHECK (extraction_confidence IN ('HIGH', 'MEDIUM', 'LOW')),
  verification_status text NOT NULL CHECK (verification_status IN ('UNVERIFIED', 'REVIEW_REQUIRED', 'VERIFIED'))
);
CREATE INDEX knowledge_source_spans_source_page_idx ON knowledge_source_spans (source_id, page_start);

CREATE TABLE knowledge_records (
  canonical_id text PRIMARY KEY,
  source_id text NOT NULL REFERENCES knowledge_sources(source_id),
  span_id text NOT NULL REFERENCES knowledge_source_spans(span_id),
  record_type text NOT NULL,
  education_level text NOT NULL CHECK (education_level IN ('lower-secondary', 'advanced-secondary', 'cross-level')),
  subject text,
  source_wording text NOT NULL,
  source_language text NOT NULL DEFAULT 'en',
  normalized jsonb NOT NULL,
  extracted jsonb NOT NULL,
  verification_status text NOT NULL CHECK (verification_status IN ('UNVERIFIED', 'REVIEW_REQUIRED', 'VERIFIED')),
  imported_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX knowledge_records_exact_lookup_idx ON knowledge_records (education_level, subject, record_type);
CREATE INDEX knowledge_records_source_idx ON knowledge_records (source_id);

CREATE TABLE knowledge_relationships (
  relationship_id text PRIMARY KEY,
  relationship_type text NOT NULL,
  from_canonical_id text NOT NULL,
  to_canonical_id text NOT NULL REFERENCES knowledge_records(canonical_id),
  source_id text NOT NULL REFERENCES knowledge_sources(source_id),
  span_id text NOT NULL REFERENCES knowledge_source_spans(span_id),
  verification_status text NOT NULL CHECK (verification_status IN ('UNVERIFIED', 'REVIEW_REQUIRED', 'VERIFIED'))
);
CREATE INDEX knowledge_relationships_from_idx ON knowledge_relationships (from_canonical_id);
CREATE INDEX knowledge_relationships_to_idx ON knowledge_relationships (to_canonical_id);

CREATE TABLE knowledge_legacy_id_mappings (
  legacy_id text PRIMARY KEY,
  canonical_id text NOT NULL REFERENCES knowledge_records(canonical_id),
  mapping_reason text NOT NULL,
  verification_status text NOT NULL CHECK (verification_status IN ('UNVERIFIED', 'REVIEW_REQUIRED', 'VERIFIED')),
  source_id text REFERENCES knowledge_sources(source_id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE knowledge_import_runs (
  import_run_id text PRIMARY KEY,
  mode text NOT NULL CHECK (mode IN ('DEVELOPMENT', 'PRODUCTION_AUTHORISED')),
  dataset_checksum_sha256 text NOT NULL,
  source_count integer NOT NULL,
  imported_count integer NOT NULL,
  rejected_count integer NOT NULL,
  started_at timestamptz NOT NULL,
  completed_at timestamptz NOT NULL,
  report jsonb NOT NULL
);
