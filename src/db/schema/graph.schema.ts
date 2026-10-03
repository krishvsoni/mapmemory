import { pgTable, uuid, text, timestamp, index, integer } from 'drizzle-orm/pg-core';
import { vector } from '../types/vector.js';
import { memorySpaces } from './tenant.schema.js';
import { env } from '../../config/env.js';

const embeddingVector = vector(env.EMBEDDING_DIMENSIONS);

export const semanticNodes = pgTable(
  'semantic_nodes',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    spaceId: uuid('space_id')
      .notNull()
      .references(() => memorySpaces.id, { onDelete: 'cascade' }),
    label: text('label').notNull(),
    normalizedLabel: text('normalized_label').notNull(),
    entityType: text('entity_type'),
    embedding: embeddingVector('embedding'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('semantic_nodes_space_idx').on(table.spaceId),
    index('semantic_nodes_normalized_idx').on(table.spaceId, table.normalizedLabel),
  ],
);

export const semanticEdges = pgTable(
  'semantic_edges',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    spaceId: uuid('space_id')
      .notNull()
      .references(() => memorySpaces.id, { onDelete: 'cascade' }),
    sourceNodeId: uuid('source_node_id')
      .notNull()
      .references(() => semanticNodes.id, { onDelete: 'cascade' }),
    relation: text('relation').notNull(),
    canonicalRelation: text('canonical_relation'),
    targetNodeId: uuid('target_node_id')
      .notNull()
      .references(() => semanticNodes.id, { onDelete: 'cascade' }),
    embedding: embeddingVector('embedding'),
    corroborationCount: integer('corroboration_count').notNull().default(1),
    supersededByEdgeId: uuid('superseded_by_edge_id'),
    validFrom: timestamp('valid_from', { withTimezone: true }),
    validTo: timestamp('valid_to', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('semantic_edges_space_idx').on(table.spaceId),
    index('semantic_edges_source_idx').on(table.sourceNodeId),
    index('semantic_edges_target_idx').on(table.targetNodeId),
    index('semantic_edges_active_idx').on(table.spaceId, table.supersededByEdgeId),
  ],
);

export const episodes = pgTable(
  'episodes',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    spaceId: uuid('space_id')
      .notNull()
      .references(() => memorySpaces.id, { onDelete: 'cascade' }),
    sequenceNo: integer('sequence_no').notNull(),
    rawText: text('raw_text').notNull(),
    kind: text('kind').notNull().default('raw'),
    importance: integer('importance').notNull().default(5),
    accessCount: integer('access_count').notNull().default(0),
    lastAccessedSequence: integer('last_accessed_sequence'),
    embedding: embeddingVector('embedding'),
    occurredAt: timestamp('occurred_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('episodes_space_idx').on(table.spaceId),
    index('episodes_sequence_idx').on(table.spaceId, table.sequenceNo),
  ],
);

export const episodeEdgeLinks = pgTable(
  'episode_edge_links',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    episodeId: uuid('episode_id')
      .notNull()
      .references(() => episodes.id, { onDelete: 'cascade' }),
    semanticEdgeId: uuid('semantic_edge_id')
      .notNull()
      .references(() => semanticEdges.id, { onDelete: 'cascade' }),
  },
  (table) => [
    index('episode_edge_links_episode_idx').on(table.episodeId),
    index('episode_edge_links_edge_idx').on(table.semanticEdgeId),
  ],
);

export const relationVocabulary = pgTable(
  'relation_vocabulary',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    spaceId: uuid('space_id')
      .notNull()
      .references(() => memorySpaces.id, { onDelete: 'cascade' }),
    canonicalLabel: text('canonical_label').notNull(),
    normalizedLabel: text('normalized_label').notNull(),
    embedding: embeddingVector('embedding'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('relation_vocabulary_space_idx').on(table.spaceId),
    index('relation_vocabulary_normalized_idx').on(table.spaceId, table.normalizedLabel),
  ],
);

export const episodeSources = pgTable(
  'episode_sources',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    reflectionEpisodeId: uuid('reflection_episode_id')
      .notNull()
      .references(() => episodes.id, { onDelete: 'cascade' }),
    sourceEpisodeId: uuid('source_episode_id')
      .notNull()
      .references(() => episodes.id, { onDelete: 'cascade' }),
  },
  (table) => [
    index('episode_sources_reflection_idx').on(table.reflectionEpisodeId),
    index('episode_sources_source_idx').on(table.sourceEpisodeId),
  ],
);
