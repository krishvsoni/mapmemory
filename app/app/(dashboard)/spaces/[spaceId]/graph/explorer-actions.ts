'use server';

import { getFactHistory, getGraphSnapshot } from '@/lib/endpoints';
import type { GraphSnapshot, PresentedFact } from '@/lib/types';

export async function graphSnapshotAction(
  spaceId: string,
  asOf: string | null,
  includeHistory: boolean,
): Promise<GraphSnapshot> {
  return getGraphSnapshot(spaceId, { asOf: asOf ?? undefined, includeHistory });
}

export async function factHistoryAction(spaceId: string, edgeId: string): Promise<PresentedFact[]> {
  return (await getFactHistory(spaceId, edgeId)).history;
}
