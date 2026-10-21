import { eq, and, desc, asc, inArray } from 'drizzle-orm';
import {
  quizzes,
  questions,
  blanks,
  quizAttempts,
  userResponses,
  attemptResults,
} from '@/db/schema';
import { evaluateBlank, AnswerMatchingConfig } from './grading';
import type { drizzle } from 'drizzle-orm/d1';

type DbInstance = ReturnType<typeof drizzle>;

export async function createAttempt(
  quizId: string,
  durationMinutes: number | undefined,
  mode: 'timed' | 'practice' = 'timed',
  db: DbInstance
) {
  const quiz = await db.select().from(quizzes).where(eq(quizzes.id, quizId)).get();
  if (!quiz) {
    throw new Error(`Quiz with ID ${quizId} not found.`);
  }

  const now = new Date();
  const startedAt = now.toISOString();
  let durationSeconds = 0;
  let deadlineDate: Date;

  if (mode === 'practice') {
    durationSeconds = 0;
    // 10 years in the future
    deadlineDate = new Date(now.getTime() + 10 * 365 * 24 * 60 * 60 * 1000);
  } else {
    const mins = durationMinutes && durationMinutes > 0 ? durationMinutes : 15;
    durationSeconds = mins * 60;
    deadlineDate = new Date(now.getTime() + durationSeconds * 1000);
  }

  const attemptId = crypto.randomUUID();
  await db.insert(quizAttempts).values({
    id: attemptId,
    quizId: quiz.id,
    durationSeconds,
    startedAt,
    deadlineAt: deadlineDate.toISOString(),
    status: 'in_progress',
    mode,
    createdAt: startedAt,
  });

  const attempt = (await db
    .select()
    .from(quizAttempts)
    .where(eq(quizAttempts.id, attemptId))
    .get())!;

  return buildAttemptState(attempt, quiz, db);
}

export async function getAttemptState(attemptId: string, db: DbInstance) {
  const attempt = await db
    .select()
    .from(quizAttempts)
    .where(eq(quizAttempts.id, attemptId))
    .get();

  if (!attempt) {
    throw new Error(`Attempt with ID ${attemptId} not found.`);
  }

  const quiz = await db.select().from(quizzes).where(eq(quizzes.id, attempt.quizId)).get();
  if (!quiz) {
    throw new Error(`Quiz for attempt ${attemptId} not found.`);
  }

  const now = new Date();
  const deadline = new Date(attempt.deadlineAt);

  // Auto-finalize if expired in timed mode
  if (attempt.mode === 'timed' && attempt.status === 'in_progress' && now >= deadline) {
    await finalizeTimeout(attempt, quiz, db);
    const updatedAttempt = (await db
      .select()
      .from(quizAttempts)
      .where(eq(quizAttempts.id, attemptId))
      .get())!;
    return buildAttemptState(updatedAttempt, quiz, db);
  }

  return buildAttemptState(attempt, quiz, db);
}

export async function saveAttemptAnswers(
  attemptId: string,
  answersData: Record<string, Record<string, string>>,
  db: DbInstance
) {
  const attempt = await db
    .select()
    .from(quizAttempts)
    .where(eq(quizAttempts.id, attemptId))
    .get();

  if (!attempt) {
    throw new Error(`Attempt with ID ${attemptId} not found.`);
  }

  const now = new Date();
  const deadline = new Date(attempt.deadlineAt);
  const isTimed = attempt.mode === 'timed';

  if (attempt.status !== 'in_progress' || (isTimed && now >= deadline)) {
    if (isTimed && attempt.status === 'in_progress') {
      const quiz = (await db
        .select()
        .from(quizzes)
        .where(eq(quizzes.id, attempt.quizId))
        .get())!;
      await finalizeTimeout(attempt, quiz, db);
    }
    return {
      saved: false,
      saved_count: 0,
      server_now: now.toISOString(),
      remaining_seconds: 0,
      is_expired: true,
    };
  }

  // Load question and blank mapping for validation
  const quizQuestions = await db
    .select()
    .from(questions)
    .where(eq(questions.quizId, attempt.quizId))
    .all();

  const questionIds = quizQuestions.map((q) => q.id);
  const quizBlanks =
    questionIds.length > 0
      ? await db
          .select()
          .from(blanks)
          .where(inArray(blanks.questionId, questionIds))
          .all()
      : [];

  const validBlanksByQuestion = new Map<string, Set<string>>();
  for (const b of quizBlanks) {
    if (!validBlanksByQuestion.has(b.questionId)) {
      validBlanksByQuestion.set(b.questionId, new Set());
    }
    validBlanksByQuestion.get(b.questionId)!.add(b.blankIdentifier);
  }

  // Fetch existing responses
  const existingResponses = await db
    .select()
    .from(userResponses)
    .where(eq(userResponses.attemptId, attemptId))
    .all();

  const respLookup = new Map<string, (typeof existingResponses)[0]>();
  for (const r of existingResponses) {
    respLookup.set(`${r.questionId}:${r.blankIdentifier}`, r);
  }

  let savedCount = 0;
  const nowIso = now.toISOString();

  for (const [qId, blankAnswers] of Object.entries(answersData)) {
    const allowedBlanks = validBlanksByQuestion.get(qId);
    if (!allowedBlanks) continue;

    for (const [blankId, responseText] of Object.entries(blankAnswers)) {
      if (!allowedBlanks.has(blankId)) continue;

      const key = `${qId}:${blankId}`;
      const cleaned = String(responseText ?? '');

      if (respLookup.has(key)) {
        const existing = respLookup.get(key)!;
        if (existing.responseText !== cleaned) {
          await db
            .update(userResponses)
            .set({ responseText: cleaned, updatedAt: nowIso })
            .where(eq(userResponses.id, existing.id));
          savedCount++;
        }
      } else {
        await db.insert(userResponses).values({
          id: crypto.randomUUID(),
          attemptId,
          questionId: qId,
          blankIdentifier: blankId,
          responseText: cleaned,
          updatedAt: nowIso,
        });
        savedCount++;
      }
    }
  }

  const remainingSeconds = Math.max(
    0,
    Math.floor((deadline.getTime() - now.getTime()) / 1000)
  );

  return {
    saved: true,
    saved_count: savedCount,
    server_now: nowIso,
    remaining_seconds: remainingSeconds,
    is_expired: false,
  };
}

export async function checkQuestionAnswers(
  attemptId: string,
  questionId: string,
  answers: Record<string, string>,
  db: DbInstance
) {
  const attempt = await db
    .select()
    .from(quizAttempts)
    .where(eq(quizAttempts.id, attemptId))
    .get();

  if (!attempt) {
    throw new Error(`Attempt with ID ${attemptId} not found.`);
  }

  const quiz = await db.select().from(quizzes).where(eq(quizzes.id, attempt.quizId)).get();
  if (!quiz) {
    throw new Error(`Quiz for attempt ${attemptId} not found.`);
  }

  const question = await db
    .select()
    .from(questions)
    .where(and(eq(questions.id, questionId), eq(questions.quizId, attempt.quizId)))
    .get();

  if (!question) {
    throw new Error(`Question with ID ${questionId} not found in this quiz.`);
  }

  const qBlanks = await db
    .select()
    .from(blanks)
    .where(eq(blanks.questionId, questionId))
    .orderBy(asc(blanks.orderIndex))
    .all();

  // Autosave answers
  await saveAttemptAnswers(attemptId, { [questionId]: answers }, db);

  const gradingConfig = (quiz.gradingConfig as any) || {};
  const matchingConfig: AnswerMatchingConfig = gradingConfig.answerMatching || {};

  let allBlanksCorrect = true;
  const blankFeedbacks = [];

  for (const b of qBlanks) {
    const userText = answers[b.blankIdentifier] ?? '';
    const userTrimmed = userText.trim();
    const isUnanswered = userTrimmed === '';

    const acceptedList: string[] = Array.isArray(b.acceptedAnswers)
      ? (b.acceptedAnswers as string[])
      : [];
    const primaryCorrect = acceptedList[0] || '';

    let isCorrect = false;
    if (!isUnanswered) {
      isCorrect = evaluateBlank(userText, acceptedList, matchingConfig);
    }

    if (!isCorrect) {
      allBlanksCorrect = false;
    }

    blankFeedbacks.push({
      blank_identifier: b.blankIdentifier,
      user_answer: userText,
      correct_answer: primaryCorrect,
      accepted_answers: acceptedList,
      is_correct: isCorrect,
      is_unanswered: isUnanswered,
    });
  }

  return {
    question_id: question.id,
    is_fully_correct: allBlanksCorrect && qBlanks.length > 0,
    explanation: question.explanation || null,
    blanks: blankFeedbacks,
  };
}

export async function submitAttempt(
  attemptId: string,
  answersSnapshot: Record<string, Record<string, string>> | undefined,
  db: DbInstance
) {
  const attempt = await db
    .select()
    .from(quizAttempts)
    .where(eq(quizAttempts.id, attemptId))
    .get();

  if (!attempt) {
    throw new Error(`Attempt with ID ${attemptId} not found.`);
  }

  const quiz = await db.select().from(quizzes).where(eq(quizzes.id, attempt.quizId)).get();
  if (!quiz) {
    throw new Error(`Quiz for attempt ${attemptId} not found.`);
  }

  // Idempotent return if already finalized
  if (attempt.status === 'completed' || attempt.status === 'timed_out') {
    const existingResult = await db
      .select()
      .from(attemptResults)
      .where(eq(attemptResults.attemptId, attemptId))
      .get();
    if (existingResult) {
      return buildResultResponse(attempt, existingResult, quiz.title);
    }
  }

  const now = new Date();
  const deadline = new Date(attempt.deadlineAt);

  let submissionReason = 'manual';
  let statusValue = 'completed';

  if (attempt.mode === 'timed' && now >= deadline) {
    submissionReason = 'timeout';
    statusValue = 'timed_out';
  }

  if (answersSnapshot && submissionReason === 'manual') {
    await saveAttemptAnswers(attemptId, answersSnapshot, db);
  }

  const gradedResult = await gradeAttempt(attempt, quiz, submissionReason, now, db);

  await db
    .update(quizAttempts)
    .set({
      status: statusValue,
      submittedAt: now.toISOString(),
      submissionReason,
    })
    .where(eq(quizAttempts.id, attemptId));

  const updatedAttempt = (await db
    .select()
    .from(quizAttempts)
    .where(eq(quizAttempts.id, attemptId))
    .get())!;

  return buildResultResponse(updatedAttempt, gradedResult, quiz.title);
}

export async function getAttemptResult(attemptId: string, db: DbInstance) {
  const attempt = await db
    .select()
    .from(quizAttempts)
    .where(eq(quizAttempts.id, attemptId))
    .get();

  if (!attempt) {
    throw new Error(`Attempt with ID ${attemptId} not found.`);
  }

  const quiz = await db.select().from(quizzes).where(eq(quizzes.id, attempt.quizId)).get();
  if (!quiz) {
    throw new Error(`Quiz for attempt ${attemptId} not found.`);
  }

  if (attempt.status === 'in_progress') {
    const now = new Date();
    const deadline = new Date(attempt.deadlineAt);
    if (attempt.mode === 'timed' && now >= deadline) {
      await finalizeTimeout(attempt, quiz, db);
    } else {
      throw new Error('Quiz attempt is still in progress.');
    }
  }

  const resultRecord = await db
    .select()
    .from(attemptResults)
    .where(eq(attemptResults.attemptId, attemptId))
    .get();

  if (!resultRecord) {
    throw new Error('Result not found for this attempt.');
  }

  return buildResultResponse(attempt, resultRecord, quiz.title);
}

export async function listAttemptHistory(skip = 0, limit = 50, db: DbInstance) {
  const allAttempts = await db
    .select()
    .from(quizAttempts)
    .orderBy(desc(quizAttempts.startedAt))
    .all();

  const total = allAttempts.length;
  const pagedAttempts = allAttempts.slice(skip, skip + limit);

  const attemptIds = pagedAttempts.map((a) => a.id);
  const quizIds = Array.from(new Set(pagedAttempts.map((a) => a.quizId)));

  const quizList =
    quizIds.length > 0
      ? await db.select().from(quizzes).where(inArray(quizzes.id, quizIds)).all()
      : [];
  const quizTitleMap = new Map<string, string>();
  for (const q of quizList) {
    quizTitleMap.set(q.id, q.title);
  }

  const resultsList =
    attemptIds.length > 0
      ? await db
          .select()
          .from(attemptResults)
          .where(inArray(attemptResults.attemptId, attemptIds))
          .all()
      : [];
  const resultMap = new Map<string, (typeof resultsList)[0]>();
  for (const r of resultsList) {
    resultMap.set(r.attemptId, r);
  }

  const items = pagedAttempts.map((att) => {
    const res = resultMap.get(att.id);
    return {
      attempt_id: att.id,
      quiz_id: att.quizId,
      quiz_title: quizTitleMap.get(att.quizId) || 'Quiz',
      status: att.status,
      submission_reason: att.submissionReason,
      accuracy_percentage: res ? res.accuracyPercentage : null,
      correct_blanks: res ? res.correctBlanks : null,
      total_blanks: res ? res.totalBlanks : null,
      fully_correct_questions: res ? res.fullyCorrectQuestions : null,
      total_questions: res ? res.totalQuestions : null,
      time_spent_seconds: res ? res.timeSpentSeconds : null,
      duration_seconds: att.durationSeconds,
      started_at: att.startedAt,
      finalized_at: res ? res.finalizedAt : att.submittedAt,
    };
  });

  return { total, items };
}

// --- Helpers ---

async function buildAttemptState(
  attempt: typeof quizAttempts.$inferSelect,
  quiz: typeof quizzes.$inferSelect,
  db: DbInstance
) {
  const quizQuestions = await db
    .select()
    .from(questions)
    .where(eq(questions.quizId, quiz.id))
    .orderBy(asc(questions.orderIndex))
    .all();

  const questionIds = quizQuestions.map((q) => q.id);
  const quizBlanks =
    questionIds.length > 0
      ? await db
          .select()
          .from(blanks)
          .where(inArray(blanks.questionId, questionIds))
          .orderBy(asc(blanks.orderIndex))
          .all()
      : [];

  const blanksByQuestion = new Map<string, typeof quizBlanks>();
  for (const b of quizBlanks) {
    if (!blanksByQuestion.has(b.questionId)) {
      blanksByQuestion.set(b.questionId, []);
    }
    blanksByQuestion.get(b.questionId)!.push(b);
  }

  const savedResponses = await db
    .select()
    .from(userResponses)
    .where(eq(userResponses.attemptId, attempt.id))
    .all();

  const savedAnswers: Record<string, Record<string, string>> = {};
  for (const r of savedResponses) {
    if (!savedAnswers[r.questionId]) {
      savedAnswers[r.questionId] = {};
    }
    savedAnswers[r.questionId][r.blankIdentifier] = r.responseText;
  }

  const now = new Date();
  const deadline = new Date(attempt.deadlineAt);
  const remainingSeconds = Math.max(
    0,
    Math.floor((deadline.getTime() - now.getTime()) / 1000)
  );

  const publicQuestions = quizQuestions.map((q) => {
    const qBlanks = blanksByQuestion.get(q.id) || [];
    return {
      id: q.id,
      external_id: q.externalId,
      order_index: q.orderIndex,
      topic: q.topic,
      section: q.section,
      question_type: q.questionType,
      title: q.title,
      prompt: q.prompt,
      blank_count: q.blankCount,
      blanks: qBlanks.map((b) => ({
        id: b.id,
        blank_identifier: b.blankIdentifier,
        order_index: b.orderIndex,
      })),
    };
  });

  return {
    id: attempt.id,
    quiz_id: quiz.id,
    quiz_title: quiz.title,
    duration_seconds: attempt.durationSeconds,
    started_at: attempt.startedAt,
    deadline_at: attempt.deadlineAt,
    server_now: now.toISOString(),
    remaining_seconds: remainingSeconds,
    status: attempt.status,
    submission_reason: attempt.submissionReason,
    mode: attempt.mode,
    saved_answers: savedAnswers,
    questions: publicQuestions,
  };
}

async function finalizeTimeout(
  attempt: typeof quizAttempts.$inferSelect,
  quiz: typeof quizzes.$inferSelect,
  db: DbInstance
) {
  const now = new Date();
  await gradeAttempt(attempt, quiz, 'timeout', now, db);
  await db
    .update(quizAttempts)
    .set({
      status: 'timed_out',
      submittedAt: now.toISOString(),
      submissionReason: 'timeout',
    })
    .where(eq(quizAttempts.id, attempt.id));
}

async function gradeAttempt(
  attempt: typeof quizAttempts.$inferSelect,
  quiz: typeof quizzes.$inferSelect,
  submissionReason: string,
  finalizedAt: Date,
  db: DbInstance
) {
  const quizQuestions = await db
    .select()
    .from(questions)
    .where(eq(questions.quizId, quiz.id))
    .orderBy(asc(questions.orderIndex))
    .all();

  const questionIds = quizQuestions.map((q) => q.id);
  const quizBlanks =
    questionIds.length > 0
      ? await db
          .select()
          .from(blanks)
          .where(inArray(blanks.questionId, questionIds))
          .orderBy(asc(blanks.orderIndex))
          .all()
      : [];

  const blanksByQuestion = new Map<string, typeof quizBlanks>();
  for (const b of quizBlanks) {
    if (!blanksByQuestion.has(b.questionId)) {
      blanksByQuestion.set(b.questionId, []);
    }
    blanksByQuestion.get(b.questionId)!.push(b);
  }

  const responses = await db
    .select()
    .from(userResponses)
    .where(eq(userResponses.attemptId, attempt.id))
    .all();

  const userAnswers: Record<string, Record<string, string>> = {};
  for (const r of responses) {
    if (!userAnswers[r.questionId]) {
      userAnswers[r.questionId] = {};
    }
    userAnswers[r.questionId][r.blankIdentifier] = r.responseText;
  }

  const gradingConfig = (quiz.gradingConfig as any) || {};
  const matchingConfig: AnswerMatchingConfig = gradingConfig.answerMatching || {};

  const totalQuestions = quizQuestions.length;
  let totalBlanks = 0;
  let correctBlanks = 0;
  let incorrectBlanks = 0;
  let unansweredBlanks = 0;
  let fullyCorrectQuestions = 0;

  const detailedQuestions = [];

  for (const q of quizQuestions) {
    const qBlanks = blanksByQuestion.get(q.id) || [];
    const qResponses = userAnswers[q.id] || {};
    let allBlanksCorrect = true;
    const blankReviews = [];

    for (const b of qBlanks) {
      totalBlanks++;
      const userText = qResponses[b.blankIdentifier] ?? '';
      const userTrimmed = userText.trim();
      const isUnanswered = userTrimmed === '';

      const acceptedList: string[] = Array.isArray(b.acceptedAnswers)
        ? (b.acceptedAnswers as string[])
        : [];
      const primaryCorrect = acceptedList[0] || '';

      let isCorrect = false;
      if (!isUnanswered) {
        isCorrect = evaluateBlank(userText, acceptedList, matchingConfig);
      }

      if (isCorrect) {
        correctBlanks++;
      } else {
        incorrectBlanks++;
        if (isUnanswered) unansweredBlanks++;
        allBlanksCorrect = false;
      }

      blankReviews.push({
        blank_identifier: b.blankIdentifier,
        user_answer: userText,
        correct_answer: primaryCorrect,
        accepted_answers: acceptedList,
        is_correct: isCorrect,
        is_unanswered: isUnanswered,
      });
    }

    if (allBlanksCorrect && qBlanks.length > 0) {
      fullyCorrectQuestions++;
    }

    detailedQuestions.push({
      question_id: q.id,
      external_id: q.externalId,
      order_index: q.orderIndex,
      title: q.title,
      topic: q.topic,
      section: q.section,
      prompt: q.prompt,
      explanation: q.explanation,
      is_fully_correct: allBlanksCorrect,
      blanks: blankReviews,
    });
  }

  const accuracyPercentage =
    totalBlanks > 0
      ? Math.round((correctBlanks / totalBlanks) * 10000) / 100
      : 0.0;

  const startedAt = new Date(attempt.startedAt);
  const rawTimeSpent = Math.floor(
    (finalizedAt.getTime() - startedAt.getTime()) / 1000
  );
  const timeSpentSeconds =
    attempt.durationSeconds > 0
      ? Math.max(0, Math.min(rawTimeSpent, attempt.durationSeconds))
      : Math.max(0, rawTimeSpent);

  const resultId = crypto.randomUUID();
  const detailedResults = { questions: detailedQuestions };
  const finalizedIso = finalizedAt.toISOString();

  await db.insert(attemptResults).values({
    id: resultId,
    attemptId: attempt.id,
    totalQuestions,
    totalBlanks,
    correctBlanks,
    incorrectBlanks,
    unansweredBlanks,
    fullyCorrectQuestions,
    accuracyPercentage,
    timeSpentSeconds,
    submissionReason,
    detailedResults,
    finalizedAt: finalizedIso,
  });

  return (await db
    .select()
    .from(attemptResults)
    .where(eq(attemptResults.id, resultId))
    .get())!;
}

function buildResultResponse(
  attempt: typeof quizAttempts.$inferSelect,
  result: typeof attemptResults.$inferSelect,
  quizTitle: string
) {
  const detailed = (result.detailedResults as any) || {};
  return {
    attempt_id: attempt.id,
    quiz_id: attempt.quizId,
    quiz_title: quizTitle,
    completion_status: attempt.status,
    submission_reason: result.submissionReason,
    accuracy_percentage: result.accuracyPercentage,
    total_questions: result.totalQuestions,
    total_blanks: result.totalBlanks,
    correct_blanks: result.correctBlanks,
    incorrect_blanks: result.incorrectBlanks,
    unanswered_blanks: result.unansweredBlanks,
    fully_correct_questions: result.fullyCorrectQuestions,
    time_spent_seconds: result.timeSpentSeconds,
    duration_seconds: attempt.durationSeconds,
    started_at: attempt.startedAt,
    finalized_at: result.finalizedAt,
    questions: detailed.questions || [],
  };
}
