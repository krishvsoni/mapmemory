export interface EvalTurn {
  speaker: string;
  text: string;
}

export interface EvalSession {
  id: string;
  occurredAt: Date | null;
  turns: EvalTurn[];
}

export interface EvalQuestion {
  id: string;
  question: string;
  answer: string;
  category: string;
  evidenceSessionIds: string[];
  askedAt: Date | null;
}

export interface EvalConversation {
  id: string;
  sessions: EvalSession[];
  questions: EvalQuestion[];
}

export interface EvalDataset {
  name: string;
  conversations: EvalConversation[];
}

export type RetrievalMode = 'hybrid' | 'vector';

export interface QuestionOutcome {
  questionId: string;
  category: string;
  mode: RetrievalMode;
  question: string;
  gold: string;
  predicted: string;
  correct: boolean;
  evidenceHit: boolean | null;
  retrievalMs: number;
  factCount: number;
  episodeCount: number;
}
