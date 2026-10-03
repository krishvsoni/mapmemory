import { z } from 'zod';
import type { GraphService } from '../graph/graph.service.js';
import type { LlmService } from '../llm/llm.service.js';
import type { ConsolidationService } from '../memory/consolidation/consolidation.service.js';
import type { RetrievalService } from '../memory/retrieval/retrieval.service.js';
import { edgeStatus } from '../graph/temporal.js';
import { ingestConversation } from './conversation-ingester.js';
import type { EvalSandbox } from './eval-sandbox.js';
import type { EvalConversation, EvalDataset, EvalQuestion, QuestionOutcome, RetrievalMode } from './eval.types.js';
import { buildAnswerPrompt, buildJudgePrompt, formatContext, type ContextFact } from './qa-prompts.js';

export interface EvalDeps {
  consolidation: ConsolidationService;
  retrieval: RetrievalService;
  graph: GraphService;
  llm: LlmService;
  sandbox: EvalSandbox;
}

export interface EvalConfig {
  modes: RetrievalMode[];
  chunkChars: number;
  limitConversations?: number;
  limitQuestions?: number;
  answerModel?: string;
  judgeModel?: string;
  log: (message: string) => void;
}

const judgeSchema = z.object({ correct: z.boolean() });

async function toContextFacts(
  graph: GraphService,
  facts: Awaited<ReturnType<RetrievalService['retrieve']>>['facts'],
): Promise<ContextFact[]> {
  const nodeIds = [...new Set(facts.flatMap((f) => [f.edge.sourceNodeId, f.edge.targetNodeId]))];
  const labelById = new Map((await graph.nodes.findByIds(nodeIds)).map((n) => [n.id, n.label]));
  return facts.map(({ edge }) => ({
    subject: labelById.get(edge.sourceNodeId) ?? edge.sourceNodeId,
    relation: edge.relation,
    object: labelById.get(edge.targetNodeId) ?? edge.targetNodeId,
    validFrom: edge.validFrom ?? edge.createdAt,
    validTo: edge.validTo,
    status: edgeStatus(edge),
  }));
}

async function evaluateQuestion(
  deps: EvalDeps,
  config: EvalConfig,
  spaceId: string,
  sessionByEpisodeId: Map<string, string>,
  question: EvalQuestion,
  mode: RetrievalMode,
): Promise<QuestionOutcome> {
  const started = performance.now();
  const result = await deps.retrieval.retrieve(spaceId, question.question, {
    hybrid: mode === 'hybrid',
    asOf: question.askedAt ?? undefined,
    reinforce: false,
  });
  const retrievalMs = performance.now() - started;

  const facts = await toContextFacts(deps.graph, result.facts);
  const context = formatContext(
    facts,
    result.episodes.map((e) => ({ text: e.episode.rawText })),
  );
  const predicted = (
    await deps.llm.chat(buildAnswerPrompt(question.question, context, question.askedAt), 0, config.answerModel)
  ).trim();
  const verdict = await deps.llm.completeJson(
    buildJudgePrompt(question.question, question.answer, predicted),
    judgeSchema,
    1,
    config.judgeModel,
  );

  const retrievedSessions = new Set(result.episodes.map((e) => sessionByEpisodeId.get(e.episode.id)));
  return {
    questionId: question.id,
    category: question.category,
    mode,
    question: question.question,
    gold: question.answer,
    predicted,
    correct: verdict.correct,
    evidenceHit:
      question.evidenceSessionIds.length === 0 ? null : question.evidenceSessionIds.some((id) => retrievedSessions.has(id)),
    retrievalMs,
    factCount: result.facts.length,
    episodeCount: result.episodes.length,
  };
}

async function evaluateConversation(
  deps: EvalDeps,
  config: EvalConfig,
  conversation: EvalConversation,
): Promise<QuestionOutcome[]> {
  const spaceId = await deps.sandbox.createSpace(conversation.id);
  const ingested = await ingestConversation(deps.consolidation, spaceId, conversation, config.chunkChars, (done, total) => {
    if (done % 10 === 0 || done === total) config.log(`  ${conversation.id}: ingested ${done}/${total} chunks`);
  });

  const questions = conversation.questions.slice(0, config.limitQuestions);
  const outcomes: QuestionOutcome[] = [];
  for (const question of questions) {
    for (const mode of config.modes) {
      outcomes.push(await evaluateQuestion(deps, config, spaceId, ingested.sessionByEpisodeId, question, mode));
    }
  }
  return outcomes;
}

export async function runEval(deps: EvalDeps, dataset: EvalDataset, config: EvalConfig): Promise<QuestionOutcome[]> {
  const conversations = dataset.conversations.slice(0, config.limitConversations);
  const outcomes: QuestionOutcome[] = [];
  for (const [index, conversation] of conversations.entries()) {
    config.log(`[${index + 1}/${conversations.length}] ${dataset.name} ${conversation.id}`);
    outcomes.push(...(await evaluateConversation(deps, config, conversation)));
  }
  return outcomes;
}
