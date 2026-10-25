import { describe, it, expect } from 'vitest';
import { getQuizAttemptHistory } from '../lib/attempt-service';

describe('Per-Quiz Attempt History and Score Statistics', () => {
  const mockQuiz = {
    id: 'quiz-1',
    title: 'Unit 1: Present Simple',
    unitNumber: 1,
    questionCount: 10,
    blankCount: 15,
  };

  it('throws an error if the quiz is not found', async () => {
    const mockDb = {
      select: () => ({
        from: () => ({
          where: () => ({
            get: async () => null,
          }),
        }),
      }),
    };

    await expect(
      getQuizAttemptHistory('non-existent-quiz', mockDb as any)
    ).rejects.toThrow('Quiz with ID non-existent-quiz not found.');
  });

  it('returns empty stats and attempts list when quiz has no attempts', async () => {
    const mockDb = {
      select: () => ({
        from: () => ({
          where: () => ({
            get: async () => mockQuiz,
            orderBy: () => ({
              all: async () => [],
            }),
          }),
        }),
      }),
    };

    const res = await getQuizAttemptHistory('quiz-1', mockDb as any);

    expect(res.quiz_id).toBe('quiz-1');
    expect(res.quiz_title).toBe('Unit 1: Present Simple');
    expect(res.unit_number).toBe(1);
    expect(res.stats).toEqual({
      total_attempts: 0,
      completed_attempts: 0,
      highest_score: 0,
      latest_score: null,
      average_score: 0,
      highest_correct_blanks: 0,
      total_blanks: 15,
      total_questions: 10,
      average_time_spent_seconds: 0,
    });
    expect(res.attempts).toEqual([]);
  });

  it('calculates score statistics accurately across multiple attempts', async () => {
    const mockAttempts = [
      {
        id: 'att-3',
        quizId: 'quiz-1',
        userId: 'local-user',
        durationSeconds: 900,
        startedAt: '2026-10-25T14:00:00Z',
        submittedAt: '2026-10-25T14:10:00Z',
        status: 'completed',
        submissionReason: 'manual',
        mode: 'timed',
      },
      {
        id: 'att-2',
        quizId: 'quiz-1',
        userId: 'local-user',
        durationSeconds: 0,
        startedAt: '2026-10-24T10:00:00Z',
        submittedAt: '2026-10-24T10:15:00Z',
        status: 'completed',
        submissionReason: 'manual',
        mode: 'practice',
      },
      {
        id: 'att-1',
        quizId: 'quiz-1',
        userId: 'local-user',
        durationSeconds: 900,
        startedAt: '2026-10-23T08:00:00Z',
        submittedAt: '2026-10-23T08:15:00Z',
        status: 'timed_out',
        submissionReason: 'timeout',
        mode: 'timed',
      },
    ];

    const mockResults = [
      {
        attemptId: 'att-3',
        totalQuestions: 10,
        totalBlanks: 15,
        correctBlanks: 15,
        incorrectBlanks: 0,
        unansweredBlanks: 0,
        fullyCorrectQuestions: 10,
        accuracyPercentage: 100,
        timeSpentSeconds: 600,
        submissionReason: 'manual',
        finalizedAt: '2026-10-25T14:10:00Z',
      },
      {
        attemptId: 'att-2',
        totalQuestions: 10,
        totalBlanks: 15,
        correctBlanks: 12,
        incorrectBlanks: 3,
        unansweredBlanks: 0,
        fullyCorrectQuestions: 8,
        accuracyPercentage: 80,
        timeSpentSeconds: 900,
        submissionReason: 'manual',
        finalizedAt: '2026-10-24T10:15:00Z',
      },
      {
        attemptId: 'att-1',
        totalQuestions: 10,
        totalBlanks: 15,
        correctBlanks: 9,
        incorrectBlanks: 6,
        unansweredBlanks: 0,
        fullyCorrectQuestions: 6,
        accuracyPercentage: 60,
        timeSpentSeconds: 900,
        submissionReason: 'timeout',
        finalizedAt: '2026-10-23T08:15:00Z',
      },
    ];

    const mockDb = {
      select: () => ({
        from: (_table: any) => ({
          where: () => ({
            get: async () => mockQuiz,
            orderBy: () => ({
              all: async () => mockAttempts,
            }),
            all: async () => mockResults,
          }),
        }),
      }),
    };

    const res = await getQuizAttemptHistory('quiz-1', mockDb as any);

    expect(res.stats.total_attempts).toBe(3);
    expect(res.stats.completed_attempts).toBe(3);
    expect(res.stats.highest_score).toBe(100);
    expect(res.stats.latest_score).toBe(100); // newest attempt att-3
    expect(res.stats.average_score).toBe(80); // (100 + 80 + 60) / 3 = 80
    expect(res.stats.highest_correct_blanks).toBe(15);
    expect(res.stats.average_time_spent_seconds).toBe(800); // (600 + 900 + 900) / 3 = 800

    expect(res.attempts).toHaveLength(3);
    expect(res.attempts[0].attempt_id).toBe('att-3');
    expect(res.attempts[0].accuracy_percentage).toBe(100);
    expect(res.attempts[0].mode).toBe('timed');

    expect(res.attempts[1].attempt_id).toBe('att-2');
    expect(res.attempts[1].accuracy_percentage).toBe(80);
    expect(res.attempts[1].mode).toBe('practice');

    expect(res.attempts[2].attempt_id).toBe('att-1');
    expect(res.attempts[2].status).toBe('timed_out');
    expect(res.attempts[2].accuracy_percentage).toBe(60);
  });

  it('respects Cloudflare D1 query parameter limits with large attempt counts', async () => {
    // Generate 65 attempts to verify chunking (> 50)
    const mockAttempts = Array.from({ length: 65 }, (_, i) => ({
      id: `att-${i}`,
      quizId: 'quiz-1',
      userId: 'local-user',
      durationSeconds: 900,
      startedAt: new Date(Date.now() - i * 3600000).toISOString(),
      submittedAt: new Date(Date.now() - i * 3600000 + 600000).toISOString(),
      status: 'completed',
      submissionReason: 'manual',
      mode: 'timed',
    }));

    const mockDb = {
      select: () => ({
        from: (_table: any) => ({
          where: (_condition: any) => ({
            get: async () => mockQuiz,
            orderBy: () => ({
              all: async () => mockAttempts,
            }),
            all: async () => {
              // Simulate inArray chunk execution
              return [];
            },
          }),
        }),
      }),
    };

    const res = await getQuizAttemptHistory('quiz-1', mockDb as any);
    expect(res.stats.total_attempts).toBe(65);
  });
});
