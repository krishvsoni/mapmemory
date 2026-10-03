import type { SnapshotEdge, SnapshotNode } from '@/lib/types';

export const CANVAS = { width: 900, height: 600 } as const;

const RING_GROWTH = 7;
const MIN_NODE_RADIUS = 7;
const NODE_RADIUS_RANGE = 15;
const CURVE_SPACING = 28;

export interface PositionedNode extends SnapshotNode {
  x: number;
  y: number;
  radius: number;
}

function ringOf(index: number): { ring: number; slot: number; capacity: number } {
  if (index === 0) return { ring: 0, slot: 0, capacity: 1 };
  let ring = 1;
  let remaining = index - 1;
  while (remaining >= ring * RING_GROWTH) {
    remaining -= ring * RING_GROWTH;
    ring += 1;
  }
  return { ring, slot: remaining, capacity: ring * RING_GROWTH };
}

export function layoutNodes(nodes: SnapshotNode[]): PositionedNode[] {
  if (nodes.length === 0) return [];
  const ordered = [...nodes].sort((a, b) => b.centrality - a.centrality);
  const maxCentrality = ordered[0]?.centrality || 1;
  const rings = ringOf(ordered.length - 1).ring;
  const ringStep = Math.min(CANVAS.width, CANVAS.height) / 2 / (rings + 0.6);

  return ordered.map((node, index) => {
    const { ring, slot, capacity } = ringOf(index);
    const angle = (2 * Math.PI * slot) / capacity + ring * 0.5;
    return {
      ...node,
      x: CANVAS.width / 2 + Math.cos(angle) * ring * ringStep,
      y: CANVAS.height / 2 + Math.sin(angle) * ring * ringStep,
      radius: MIN_NODE_RADIUS + NODE_RADIUS_RANGE * Math.sqrt(node.centrality / maxCentrality),
    };
  });
}

export interface PositionedEdge {
  edge: SnapshotEdge;
  path: string;
  labelX: number;
  labelY: number;
}

function pairKey(edge: SnapshotEdge): string {
  return [edge.sourceId, edge.targetId].sort().join('|');
}

export function layoutEdges(edges: SnapshotEdge[], nodes: PositionedNode[]): PositionedEdge[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const siblings = new Map<string, number>();
  const totals = new Map<string, number>();
  for (const edge of edges) totals.set(pairKey(edge), (totals.get(pairKey(edge)) ?? 0) + 1);

  const positioned: PositionedEdge[] = [];
  for (const edge of edges) {
    const source = byId.get(edge.sourceId);
    const target = byId.get(edge.targetId);
    if (!source || !target) continue;

    const key = pairKey(edge);
    const index = siblings.get(key) ?? 0;
    siblings.set(key, index + 1);
    const offset = (index - ((totals.get(key) ?? 1) - 1) / 2) * CURVE_SPACING;

    const midX = (source.x + target.x) / 2;
    const midY = (source.y + target.y) / 2;
    const dx = target.x - source.x;
    const dy = target.y - source.y;
    const length = Math.hypot(dx, dy) || 1;
    const controlX = midX + (-dy / length) * offset * 2;
    const controlY = midY + (dx / length) * offset * 2;

    positioned.push({
      edge,
      path: `M ${source.x} ${source.y} Q ${controlX} ${controlY} ${target.x} ${target.y}`,
      labelX: (midX + controlX) / 2,
      labelY: (midY + controlY) / 2,
    });
  }
  return positioned;
}
