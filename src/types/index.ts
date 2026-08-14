export type Speaker = 'USER' | 'AI';

export type MemoryType =
  | 'upcoming_event'
  | 'recent_event'
  | 'person'
  | 'current_project'
  | 'interest'
  | 'concern'
  | 'goal'
  | 'preference'
  | 'experience'
  | 'follow_up';

export type Importance = 'high' | 'medium' | 'low';

export type MemorySource = 'conversation' | 'user_defined';

export type CorrectionCategory =
  | 'grammar'
  | 'tense'
  | 'article'
  | 'preposition'
  | 'word_choice'
  | 'word_order'
  | 'plural'
  | 'subject_verb_agreement'
  | 'naturalness'
  | 'other';

export type EnglishLevel =
  | 'beginner'
  | 'lower_intermediate'
  | 'intermediate'
  | 'upper_intermediate'
  | 'advanced';

export interface Session {
  id: string;
  startedAt: number;
  endedAt: number | null;
  duration: number;
  overallScore: number | null;
  analysisStatus: 'pending' | 'done' | 'failed';
  analysisError: string | null;
  summary: string | null;
}

export interface Utterance {
  id: string;
  sessionId: string;
  speaker: Speaker;
  text: string;
  timestamp: number;
}

export interface Correction {
  id: string;
  sessionId: string;
  original: string;
  corrected: string;
  natural: string;
  reason: string;
  category: CorrectionCategory;
}

export interface Expression {
  id: string;
  sessionId: string | null;
  expression: string;
  meaning: string;
  example: string;
  createdAt: number;
  reviewCount: number;
  masteryLevel: number;
}

export interface SessionScores {
  id: string;
  sessionId: string;
  grammar: number;
  fluency: number;
  vocabulary: number;
  naturalness: number;
  communication: number;
}

export interface ConversationMemory {
  id: string;
  content: string;
  type: MemoryType;
  importance: Importance;
  source: MemorySource;
  createdAt: number;
  /** ISO date (YYYY-MM-DD) the memory refers to. */
  relevantDate: string | null;
  /** ISO date (YYYY-MM-DD) after which it is worth asking about. */
  followUpAfter: string | null;
  lastReferencedAt: number | null;
  referenceCount: number;
  isActive: boolean;
  sessionId: string | null;
}

export interface LearningProfile {
  id: string;
  currentLevel: EnglishLevel;
  /** Correction category → count, serialised as JSON in SQLite. */
  commonMistakes: Record<string, number>;
  weakAreas: string[];
  recentExpressions: string[];
  overallProgress: number | null;
  updatedAt: number;
}

/** Wire shape returned by POST /api/analyze. */
export interface TeacherReport {
  overallScore: number;
  grammarScore: number;
  fluencyScore: number;
  vocabularyScore: number;
  naturalnessScore: number;
  communicationScore: number;
  levelEstimate: EnglishLevel;
  summary: string;
  strengths: string[];
  weaknesses: string[];
  corrections: Array<{
    original: string;
    corrected: string;
    natural: string;
    reason: string;
    category: CorrectionCategory;
  }>;
  recommendedExpressions: Array<{
    expression: string;
    meaning: string;
    example: string;
  }>;
}

/** Wire shape returned by POST /api/memory/extract. */
export interface ExtractedMemory {
  content: string;
  type: MemoryType;
  importance: Importance;
  relevantDate: string;
  followUpAfter: string;
}

export type CallStatus =
  | 'IDLE'
  | 'CONNECTING'
  | 'LISTENING'
  | 'THINKING'
  | 'SPEAKING'
  | 'RECONNECTING'
  | 'ENDED'
  | 'ERROR';

export interface LiveTurn {
  id: string;
  speaker: Speaker;
  text: string;
  timestamp: number;
  /** True while transcript deltas are still arriving. */
  partial: boolean;
}
