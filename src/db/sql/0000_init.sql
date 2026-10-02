CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  plan text NOT NULL DEFAULT 'free',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  key_hash text NOT NULL,
  key_prefix text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);
CREATE INDEX IF NOT EXISTS api_keys_prefix_idx ON api_keys (key_prefix);

CREATE TABLE IF NOT EXISTS memory_spaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS memory_spaces_tenant_idx ON memory_spaces (tenant_id);

CREATE TABLE IF NOT EXISTS semantic_nodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id uuid NOT NULL REFERENCES memory_spaces(id) ON DELETE CASCADE,
  label text NOT NULL,
  normalized_label text NOT NULL,
  embedding vector(1536),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS semantic_nodes_space_idx ON semantic_nodes (space_id);
CREATE INDEX IF NOT EXISTS semantic_nodes_normalized_idx ON semantic_nodes (space_id, normalized_label);

CREATE TABLE IF NOT EXISTS semantic_edges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id uuid NOT NULL REFERENCES memory_spaces(id) ON DELETE CASCADE,
  source_node_id uuid NOT NULL REFERENCES semantic_nodes(id) ON DELETE CASCADE,
  relation text NOT NULL,
  target_node_id uuid NOT NULL REFERENCES semantic_nodes(id) ON DELETE CASCADE,
  embedding vector(1536),
  superseded_by_edge_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS semantic_edges_space_idx ON semantic_edges (space_id);
CREATE INDEX IF NOT EXISTS semantic_edges_source_idx ON semantic_edges (source_node_id);
CREATE INDEX IF NOT EXISTS semantic_edges_target_idx ON semantic_edges (target_node_id);
CREATE INDEX IF NOT EXISTS semantic_edges_active_idx ON semantic_edges (space_id, superseded_by_edge_id);

CREATE TABLE IF NOT EXISTS episodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id uuid NOT NULL REFERENCES memory_spaces(id) ON DELETE CASCADE,
  sequence_no integer NOT NULL,
  raw_text text NOT NULL,
  embedding vector(1536),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS episodes_space_idx ON episodes (space_id);
CREATE INDEX IF NOT EXISTS episodes_sequence_idx ON episodes (space_id, sequence_no);

CREATE TABLE IF NOT EXISTS episode_edge_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  episode_id uuid NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
  semantic_edge_id uuid NOT NULL REFERENCES semantic_edges(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS episode_edge_links_episode_idx ON episode_edge_links (episode_id);
CREATE INDEX IF NOT EXISTS episode_edge_links_edge_idx ON episode_edge_links (semantic_edge_id);
