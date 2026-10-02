import type { GraphService } from './graph.service.js';
import type { SemanticEdge } from './graph.types.js';
import { PATHFINDING_DEFAULTS } from '../../config/constants.js';

export class PathfindingService {
  constructor(private readonly graph: GraphService) {}

  async shortestPath(
    spaceId: string,
    fromNodeId: string,
    toNodeId: string,
    maxDepth: number = PATHFINDING_DEFAULTS.maxDepth,
  ): Promise<SemanticEdge[] | null> {
    if (fromNodeId === toNodeId) return [];

    const visited = new Set<string>([fromNodeId]);
    const cameFromNode = new Map<string, string>();
    const cameFromEdge = new Map<string, SemanticEdge>();
    let frontier = [fromNodeId];

    for (let depth = 0; depth < maxDepth && frontier.length > 0; depth += 1) {
      const frontierSet = new Set(frontier);
      const edges = await this.graph.activeFactsAbout(spaceId, frontier);
      const nextFrontier: string[] = [];

      for (const edge of edges) {
        const steps: Array<[string, string]> = [
          [edge.sourceNodeId, edge.targetNodeId],
          [edge.targetNodeId, edge.sourceNodeId],
        ];

        for (const [from, to] of steps) {
          if (!frontierSet.has(from) || visited.has(to)) continue;
          visited.add(to);
          cameFromNode.set(to, from);
          cameFromEdge.set(to, edge);

          if (to === toNodeId) {
            return this.reconstructPath(toNodeId, cameFromNode, cameFromEdge);
          }
          nextFrontier.push(to);
        }
      }
      frontier = nextFrontier;
    }

    return null;
  }

  private reconstructPath(
    target: string,
    cameFromNode: Map<string, string>,
    cameFromEdge: Map<string, SemanticEdge>,
  ): SemanticEdge[] {
    const path: SemanticEdge[] = [];
    let current = target;
    while (cameFromEdge.has(current)) {
      path.unshift(cameFromEdge.get(current) as SemanticEdge);
      current = cameFromNode.get(current) as string;
    }
    return path;
  }
}
