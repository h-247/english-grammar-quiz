import { describe, it, expect } from 'vitest';
import { QuizImportSchema } from '../lib/validation';
import { calculateContentHash } from '../lib/hash';

describe('Quiz Importer & Validation', () => {
  const validQuiz = {
    schemaVersion: '2.0.0',
    quizType: 'multi_blank_fill_in_the_blank',
    language: 'en',
    unit: {
      number: 1,
      title: 'Present simple, present continuous, stative verbs',
    },
    instructions: 'Fill in every numbered blank.',
    placeholderSyntax: '{{n}}',
    questions: [
      {
        id: 'q1',
        topic: 'present_simple',
        type: 'multi_blank_fill_in_the_blank',
        title: 'Present simple: affirmative',
        prompt: 'They {{1}} football on Saturdays.',
        blanks: [
          {
            id: '1',
            answers: ['play', 'plays'],
          },
        ],
        explanation: 'Present simple is used for regular habits.',
      },
    ],
  };

  it('validates schema 2.0.0 quiz structure successfully', () => {
    const result = QuizImportSchema.safeParse(validQuiz);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.questions.length).toBe(1);
      expect(result.data.questions[0].blanks[0].answers).toContain('play');
    }
  });

  it('rejects quiz without questions', () => {
    const invalid = { ...validQuiz, questions: [] };
    const result = QuizImportSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('rejects blanks with empty answers list', () => {
    const invalid = {
      ...validQuiz,
      questions: [
        {
          id: 'q1',
          topic: 'present_simple',
          type: 'multi_blank_fill_in_the_blank',
          title: 'Title',
          prompt: 'Prompt',
          blanks: [
            {
              id: '1',
              answers: [],
            },
          ],
        },
      ],
    };
    const result = QuizImportSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('computes deterministic canonical hash regardless of key order', async () => {
    const data1 = { b: 2, a: 1, c: { y: 20, x: 10 } };
    const data2 = { a: 1, c: { x: 10, y: 20 }, b: 2 };

    const hash1 = await calculateContentHash(data1);
    const hash2 = await calculateContentHash(data2);

    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64);
  });
});
