CREATE INDEX IF NOT EXISTS semantic_nodes_embedding_idx
  ON semantic_nodes USING hnsw (embedding vector_cosine_ops);

CREATE INDEX IF NOT EXISTS semantic_edges_embedding_idx
  ON semantic_edges USING hnsw (embedding vector_cosine_ops);

CREATE INDEX IF NOT EXISTS episodes_embedding_idx
  ON episodes USING hnsw (embedding vector_cosine_ops);
