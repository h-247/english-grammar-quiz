import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { QuizImportSchema } from '../lib/validation';
import { calculateContentHash } from '../lib/hash';
import { importQuizData } from '../lib/importer';

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

  it('imports unit 01 json with chunked inserts strictly under Cloudflare D1 100 bound parameter limit', async () => {
    const insertCalls: { count: number; maxParams: number }[] = [];
    const mockDb = {
      select: () => ({
        from: () => ({
          where: () => ({
            get: async () => null,
            all: async () => [],
          }),
        }),
      }),
      delete: () => ({
        where: async () => {},
      }),
      insert: () => ({
        values: async (rows: unknown) => {
          const rowArray = Array.isArray(rows) ? rows : [rows];
          const colCount = Object.keys(rowArray[0] || {}).length;
          const paramCount = rowArray.length * colCount;
          insertCalls.push({
            count: rowArray.length,
            maxParams: paramCount,
          });
        },
      }),
    };

    const filePath = path.resolve(__dirname, '../sample-data/grammar_unit_01_grouped_english_fill_in_the_blank.json');
    const rawJson = fs.readFileSync(filePath, 'utf8');
    const res = await importQuizData(rawJson, mockDb as any);

    expect(res.question_count).toBe(22);
    expect(res.blank_count).toBeGreaterThan(0);

    // Verify all chunked inserts never exceed Cloudflare D1's 100 parameter limit
    expect(insertCalls.length).toBeGreaterThan(1);
    for (const call of insertCalls) {
      expect(call.maxParams).toBeLessThanOrEqual(100);
    }
  });

  it('imports the 20-question JSON without exceeding D1 parameter limits', async () => {
    const insertCalls: { count: number; maxParams: number }[] = [];
    const mockDb = {
      select: () => ({
        from: () => ({
          where: () => ({
            get: async () => null,
            all: async () => [],
          }),
        }),
      }),
      delete: () => ({
        where: async () => {},
      }),
      insert: () => ({
        values: async (rows: unknown) => {
          const rowArray = Array.isArray(rows) ? rows : [rows];
          const colCount = Object.keys(rowArray[0] || {}).length;
          const paramCount = rowArray.length * colCount;
          insertCalls.push({
            count: rowArray.length,
            maxParams: paramCount,
          });
        },
      }),
    };

    const filePath = path.resolve(__dirname, '../sample-data/grammar_unit_01_grouped_english_fill_in_the_blank.json');
    const rawJson = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(rawJson);
    parsed.questions = parsed.questions.slice(0, 20); // 20 questions
    const res = await importQuizData(parsed, mockDb as any);
    expect(res.question_count).toBe(20);
    expect(res.blank_count).toBeGreaterThan(0);
    for (const call of insertCalls) {
      expect(call.maxParams).toBeLessThanOrEqual(100);
    }
  });
});
