ALTER TABLE semantic_nodes ADD COLUMN IF NOT EXISTS entity_type text;

ALTER TABLE semantic_edges ADD COLUMN IF NOT EXISTS canonical_relation text;
ALTER TABLE semantic_edges ADD COLUMN IF NOT EXISTS corroboration_count integer NOT NULL DEFAULT 1;

ALTER TABLE episodes ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'raw';
ALTER TABLE episodes ADD COLUMN IF NOT EXISTS importance integer NOT NULL DEFAULT 5;
ALTER TABLE episodes ADD COLUMN IF NOT EXISTS access_count integer NOT NULL DEFAULT 0;
ALTER TABLE episodes ADD COLUMN IF NOT EXISTS last_accessed_sequence integer;

CREATE TABLE IF NOT EXISTS relation_vocabulary (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id uuid NOT NULL REFERENCES memory_spaces(id) ON DELETE CASCADE,
  canonical_label text NOT NULL,
  normalized_label text NOT NULL,
  embedding vector(1536),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS relation_vocabulary_space_idx ON relation_vocabulary (space_id);
CREATE INDEX IF NOT EXISTS relation_vocabulary_normalized_idx ON relation_vocabulary (space_id, normalized_label);
CREATE INDEX IF NOT EXISTS relation_vocabulary_embedding_idx ON relation_vocabulary USING hnsw (embedding vector_cosine_ops);

CREATE TABLE IF NOT EXISTS episode_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reflection_episode_id uuid NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
  source_episode_id uuid NOT NULL REFERENCES episodes(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS episode_sources_reflection_idx ON episode_sources (reflection_episode_id);
CREATE INDEX IF NOT EXISTS episode_sources_source_idx ON episode_sources (source_episode_id);
