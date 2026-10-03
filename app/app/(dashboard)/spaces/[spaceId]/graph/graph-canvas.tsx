'use client';

import { useMemo, type KeyboardEvent } from 'react';
import { CANVAS, layoutEdges, layoutNodes } from './graph-layout';
import type { GraphSnapshot } from '@/lib/types';

const TYPE_COLORS: Record<string, string> = {
  person: '#f472b6',
  location: '#34d399',
  item: '#fbbf24',
  organization: '#60a5fa',
  event: '#c084fc',
  concept: '#22d3ee',
};
const DEFAULT_NODE_COLOR = '#94a3b8';

interface GraphCanvasProps {
  snapshot: GraphSnapshot;
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  onSelectNode: (nodeId: string | null) => void;
  onSelectEdge: (edgeId: string | null) => void;
}

function activateOnKey(handler: () => void) {
  return (event: KeyboardEvent): void => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handler();
    }
  };
}

export function GraphCanvas({ snapshot, selectedNodeId, selectedEdgeId, onSelectNode, onSelectEdge }: GraphCanvasProps) {
  const nodes = useMemo(() => layoutNodes(snapshot.nodes), [snapshot.nodes]);
  const edges = useMemo(() => layoutEdges(snapshot.edges, nodes), [snapshot.edges, nodes]);

  const touchesSelection = (sourceId: string, targetId: string): boolean =>
    selectedNodeId === null || sourceId === selectedNodeId || targetId === selectedNodeId;

  return (
    <svg
      viewBox={`0 0 ${CANVAS.width} ${CANVAS.height}`}
      className="w-full h-auto bg-slate-950 rounded-md border border-slate-800"
      role="group"
      aria-label="Knowledge graph"
      onClick={() => onSelectNode(null)}
    >
      {edges.map(({ edge, path, labelX, labelY }) => {
        const isSelected = edge.id === selectedEdgeId;
        const isDimmed = !touchesSelection(edge.sourceId, edge.targetId);
        const showLabel = isSelected || (selectedNodeId !== null && !isDimmed);
        return (
          <g key={edge.id} opacity={isDimmed ? 0.12 : 1}>
            <path
              d={path}
              fill="none"
              stroke={edge.status === 'superseded' ? '#64748b' : '#818cf8'}
              strokeWidth={isSelected ? 3 : 1 + edge.confidence * 1.5}
              strokeDasharray={edge.status === 'superseded' ? '5 4' : undefined}
            />
            <path
              d={path}
              fill="none"
              stroke="transparent"
              strokeWidth={14}
              className="cursor-pointer"
              role="button"
              tabIndex={0}
              aria-label={`${edge.relation}, ${edge.status}`}
              onClick={(event) => {
                event.stopPropagation();
                onSelectEdge(edge.id);
              }}
              onKeyDown={activateOnKey(() => onSelectEdge(edge.id))}
            />
            {showLabel && (
              <text x={labelX} y={labelY} textAnchor="middle" className="fill-slate-300 text-[11px] pointer-events-none">
                {edge.relation}
              </text>
            )}
          </g>
        );
      })}

      {nodes.map((node) => {
        const isSelected = node.id === selectedNodeId;
        return (
          <g
            key={node.id}
            className="cursor-pointer"
            role="button"
            tabIndex={0}
            aria-label={`Entity ${node.label}`}
            onClick={(event) => {
              event.stopPropagation();
              onSelectNode(node.id);
            }}
            onKeyDown={activateOnKey(() => onSelectNode(node.id))}
          >
            <circle
              cx={node.x}
              cy={node.y}
              r={node.radius}
              fill={TYPE_COLORS[node.entityType ?? ''] ?? DEFAULT_NODE_COLOR}
              stroke={isSelected ? '#ffffff' : '#0f172a'}
              strokeWidth={isSelected ? 3 : 2}
            />
            <text
              x={node.x}
              y={node.y + node.radius + 13}
              textAnchor="middle"
              className="fill-slate-200 text-[12px] pointer-events-none"
            >
              {node.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
