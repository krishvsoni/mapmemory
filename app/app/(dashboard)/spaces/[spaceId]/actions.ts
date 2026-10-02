'use server';

import { getJobStatus, ingestEpisode, retrieve, triggerReflection } from '@/lib/endpoints';
import type { Episode, IngestJobResult, JobStatus, RetrievalResult } from '@/lib/types';

export async function ingestAction(spaceId: string, text: string): Promise<IngestJobResult> {
  return ingestEpisode(spaceId, text);
}

export async function retrieveAction(spaceId: string, query: string): Promise<RetrievalResult> {
  return retrieve(spaceId, query);
}

export async function reflectAction(spaceId: string): Promise<{ reflection: Episode | null }> {
  return triggerReflection(spaceId);
}

export async function pollJobAction(jobId: string): Promise<JobStatus> {
  return getJobStatus(jobId);
}
