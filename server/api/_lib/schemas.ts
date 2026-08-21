export const MEMORY_TYPES = [
  'upcoming_event',
  'recent_event',
  'person',
  'current_project',
  'interest',
  'concern',
  'goal',
  'preference',
  'experience',
  'follow_up',
] as const;

export const CORRECTION_CATEGORIES = [
  'grammar',
  'tense',
  'article',
  'preposition',
  'word_choice',
  'word_order',
  'plural',
  'subject_verb_agreement',
  'naturalness',
  'other',
] as const;

export const IMPORTANCE_LEVELS = ['high', 'medium', 'low'] as const;

export const LEVELS = [
  'beginner',
  'lower_intermediate',
  'intermediate',
  'upper_intermediate',
  'advanced',
] as const;

/**
 * Strict json_schema requires: every property listed in `required`,
 * and additionalProperties: false on every object.
 * Optional values are therefore modelled as empty strings.
 */
export const TEACHER_REPORT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'overallScore',
    'grammarScore',
    'fluencyScore',
    'vocabularyScore',
    'naturalnessScore',
    'communicationScore',
    'levelEstimate',
    'summary',
    'strengths',
    'weaknesses',
    'corrections',
    'recommendedExpressions',
  ],
  properties: {
    overallScore: { type: 'integer', minimum: 0, maximum: 100 },
    grammarScore: { type: 'integer', minimum: 0, maximum: 100 },
    fluencyScore: { type: 'integer', minimum: 0, maximum: 100 },
    vocabularyScore: { type: 'integer', minimum: 0, maximum: 100 },
    naturalnessScore: { type: 'integer', minimum: 0, maximum: 100 },
    communicationScore: { type: 'integer', minimum: 0, maximum: 100 },
    levelEstimate: { type: 'string', enum: LEVELS },
    summary: {
      type: 'string',
      description: 'Two or three warm, plain-English sentences about how the call went.',
    },
    strengths: {
      type: 'array',
      maxItems: 4,
      items: { type: 'string' },
      description: 'Good expressions or habits the learner actually used in this call.',
    },
    weaknesses: {
      type: 'array',
      maxItems: 4,
      items: { type: 'string' },
    },
    corrections: {
      type: 'array',
      maxItems: 6,
      description:
        'Only mistakes with real learning value. Skip typos, filler words and transcription noise.',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['original', 'corrected', 'natural', 'reason', 'category'],
        properties: {
          original: { type: 'string', description: 'Exactly what the learner said.' },
          corrected: { type: 'string', description: 'Minimal grammatical fix.' },
          natural: {
            type: 'string',
            description: 'How a native speaker would actually phrase it.',
          },
          reason: { type: 'string', description: 'One short sentence, learner-friendly.' },
          category: { type: 'string', enum: CORRECTION_CATEGORIES },
        },
      },
    },
    recommendedExpressions: {
      type: 'array',
      maxItems: 5,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['expression', 'meaning', 'example'],
        properties: {
          expression: { type: 'string' },
          meaning: { type: 'string' },
          example: { type: 'string' },
        },
      },
    },
  },
} as const;

export const MEMORY_EXTRACTION_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['memories'],
  properties: {
    memories: {
      type: 'array',
      maxItems: 12,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['content', 'type', 'importance', 'relevantDate', 'followUpAfter'],
        properties: {
          content: {
            type: 'string',
            description:
              'One self-contained fact written in third person, e.g. "User has a presentation on Friday."',
          },
          type: { type: 'string', enum: MEMORY_TYPES },
          importance: { type: 'string', enum: IMPORTANCE_LEVELS },
          relevantDate: {
            type: 'string',
            description: 'ISO date YYYY-MM-DD the memory refers to, or "" if not time-bound.',
          },
          followUpAfter: {
            type: 'string',
            description:
              'ISO date YYYY-MM-DD after which it is worth asking about this, or "" if never.',
          },
        },
      },
    },
  },
} as const;

export const HINT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['hints'],
  properties: {
    hints: {
      type: 'array',
      minItems: 2,
      maxItems: 3,
      items: { type: 'string' },
      description: 'Short natural sentences the learner could say next, in first person.',
    },
  },
} as const;

export const TRANSLATE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['translation'],
  properties: {
    translation: {
      type: 'string',
      description:
        'Natural Korean translation of the sentence, in friendly 해요체. Preserve the tone (casual friend, warm).',
    },
  },
} as const;
