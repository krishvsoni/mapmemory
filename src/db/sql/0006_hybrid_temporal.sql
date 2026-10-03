ALTER TABLE semantic_nodes
  ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (to_tsvector('simple', label)) STORED;
CREATE INDEX IF NOT EXISTS semantic_nodes_search_idx ON semantic_nodes USING gin (search_vector);

ALTER TABLE episodes
  ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (to_tsvector('simple', raw_text)) STORED;
CREATE INDEX IF NOT EXISTS episodes_search_idx ON episodes USING gin (search_vector);

ALTER TABLE episodes ADD COLUMN IF NOT EXISTS occurred_at timestamptz;

ALTER TABLE semantic_edges ADD COLUMN IF NOT EXISTS valid_from timestamptz;
ALTER TABLE semantic_edges ADD COLUMN IF NOT EXISTS valid_to timestamptz;

UPDATE semantic_edges
  SET valid_to = updated_at
  WHERE superseded_by_edge_id IS NOT NULL AND valid_to IS NULL;

CREATE INDEX IF NOT EXISTS semantic_edges_validity_idx
  ON semantic_edges (space_id, valid_from, valid_to);
