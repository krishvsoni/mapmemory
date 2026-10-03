import type { ConsolidationService } from '../memory/consolidation/consolidation.service.js';
import type { EvalConversation } from './eval.types.js';
import { chunkSession } from './session-chunker.js';

export interface IngestedConversation {
  sessionByEpisodeId: Map<string, string>;
  episodeCount: number;
}

export async function ingestConversation(
  consolidation: ConsolidationService,
  spaceId: string,
  conversation: EvalConversation,
  chunkChars: number,
  onChunk?: (done: number, total: number) => void,
): Promise<IngestedConversation> {
  const chunks = conversation.sessions.flatMap((session) => chunkSession(session, chunkChars));
  const sessionByEpisodeId = new Map<string, string>();

  for (const [index, chunk] of chunks.entries()) {
    const result = await consolidation.ingest(spaceId, chunk.text, chunk.occurredAt);
    sessionByEpisodeId.set(result.episode.id, chunk.sessionId);
    onChunk?.(index + 1, chunks.length);
  }
  return { sessionByEpisodeId, episodeCount: chunks.length };
}
