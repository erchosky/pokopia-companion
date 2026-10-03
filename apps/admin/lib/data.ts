import 'server-only';
import { cache } from 'react';
import { gameDataAsync, type GameDataRepository } from '@pokopia/game-data';
import { createKnowledgeGraph, type KnowledgeGraph } from '@pokopia/knowledge';

export const repository = cache(() => gameDataAsync());

// React `cache` only memoizes within a single request, so the graph was rebuilt on every request.
// The repository is an immutable snapshot, so one graph per repository instance is safe and is
// rebuilt only when the repository itself is reloaded.
const graphs = new WeakMap<GameDataRepository, KnowledgeGraph>();

export const knowledgeGraph = cache(async (): Promise<KnowledgeGraph> => {
  const data = await repository();
  let graph = graphs.get(data);
  if (!graph) {
    graph = createKnowledgeGraph(data);
    graphs.set(data, graph);
  }
  return graph;
});
