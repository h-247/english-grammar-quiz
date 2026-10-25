import { eq, and, desc, asc, inArray, sql } from 'drizzle-orm';
import {
  courses,
  quizzes,
  questions,
  blanks,
  quizAttempts,
  userResponses,
  attemptResults,
} from '@/db/schema';
import { evaluateBlank, AnswerMatchingConfig } from './grading';
import { calculateContentHash } from './hash';
import type { drizzle } from 'drizzle-orm/d1';

type DbInstance = ReturnType<typeof drizzle>;

// Cloudflare D1 has a hard limit of 100 bound parameters per query.
// Questions table has 14 columns: 5 * 14 = 70 parameters (safely < 100).
// Blanks table has 7 columns: 10 * 7 = 70 parameters (safely < 100).
// User responses table has 6 columns: 10 * 6 = 60 parameters (safely < 100).
const QUESTIONS_CHUNK_SIZE = 5;
const BLANKS_CHUNK_SIZE = 10;
const USER_RESPONSES_CHUNK_SIZE = 10;
const IN_ARRAY_CHUNK_SIZE = 50;

export interface BlankReviewItem {
  blank_identifier: string;
  user_answer: string;
  correct_answer: string;
  accepted_answers: string[];
  is_correct: boolean;
  is_unanswered: boolean;
}

export interface AttemptResultQuestion {
  question_id: string;
  external_id: string;
  order_index: number;
  title: string;
  topic: string;
  section: string | null;
  prompt: string;
  explanation: string | null;
  is_fully_correct: boolean;
  blanks: BlankReviewItem[];
}

export interface TopicMasteryItem {
  topic: string;
  totalBlanks: number;
  correctBlanks: number;
  percentage: number;
  masteryLevel: 'mastered' | 'proficient' | 'developing' | 'needs_practice';
}

export async function createAttempt(
  quizId: string,
  durationMinutes: number | undefined,
  mode: 'timed' | 'practice' = 'timed',
  db: DbInstance,
  userId: string = 'local-user'
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
    // 10 years in the future for self-paced practice
    deadlineDate = new Date(now.getTime() + 10 * 365 * 24 * 60 * 60 * 1000);
  } else {
    const mins = durationMinutes && durationMinutes > 0 ? durationMinutes : 15;
    durationSeconds = mins * 60;
    deadlineDate = new Date(now.getTime() + durationSeconds * 1000);
  }

  const attemptId = crypto.randomUUID();
  const attemptRow = {
    id: attemptId,
    quizId: quiz.id,
    userId: userId || 'local-user',
    durationSeconds,
    startedAt,
    deadlineAt: deadlineDate.toISOString(),
    status: 'in_progress',
    mode,
    createdAt: startedAt,
  };

  await db.insert(quizAttempts).values(attemptRow);

  return buildAttemptState(attemptRow as typeof quizAttempts.$inferSelect, quiz, db);
}

export async function getAttemptState(
  attemptId: string,
  db: DbInstance,
  userId?: string
) {
  const attempt = await db
    .select()
    .from(quizAttempts)
    .where(eq(quizAttempts.id, attemptId))
    .get();

  if (!attempt) {
    throw new Error(`Attempt with ID ${attemptId} not found.`);
  }

  if (userId && userId !== 'local-user' && attempt.userId && attempt.userId !== userId) {
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
  db: DbInstance,
  userId?: string
) {
  const attempt = await db
    .select()
    .from(quizAttempts)
    .where(eq(quizAttempts.id, attemptId))
    .get();

  if (!attempt) {
    throw new Error(`Attempt with ID ${attemptId} not found.`);
  }

  if (userId && userId !== 'local-user' && attempt.userId && attempt.userId !== userId) {
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
    .select({ id: questions.id })
    .from(questions)
    .where(eq(questions.quizId, attempt.quizId))
    .all();

  const questionIds = quizQuestions.map((q) => q.id);
  const quizBlanks =
    questionIds.length > 0
      ? await db
          .select({ questionId: blanks.questionId, blankIdentifier: blanks.blankIdentifier })
          .from(blanks)
          .where(inArray(blanks.questionId, questionIds))
          .all()
      : [];

  const validBlanksByQuestion = new Map<string, Set<string>>();
  for (let i = 0; i < quizBlanks.length; i++) {
    const b = quizBlanks[i];
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
  for (let i = 0; i < existingResponses.length; i++) {
    const r = existingResponses[i];
    respLookup.set(`${r.questionId}:${r.blankIdentifier}`, r);
  }

  let savedCount = 0;
  const nowIso = now.toISOString();
  const rowsToInsert: (typeof userResponses.$inferInsert)[] = [];

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
        rowsToInsert.push({
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

  // Batch insert new responses
  for (let i = 0; i < rowsToInsert.length; i += USER_RESPONSES_CHUNK_SIZE) {
    const chunk = rowsToInsert.slice(i, i + USER_RESPONSES_CHUNK_SIZE);
    await db.insert(userResponses).values(chunk);
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
  db: DbInstance,
  userId?: string
) {
  const attempt = await db
    .select()
    .from(quizAttempts)
    .where(eq(quizAttempts.id, attemptId))
    .get();

  if (!attempt) {
    throw new Error(`Attempt with ID ${attemptId} not found.`);
  }

  if (userId && userId !== 'local-user' && attempt.userId && attempt.userId !== userId) {
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
  await saveAttemptAnswers(attemptId, { [questionId]: answers }, db, userId);

  const gradingConfig = (quiz.gradingConfig as Record<string, unknown>) || {};
  const matchingConfig: AnswerMatchingConfig =
    (gradingConfig.answerMatching as AnswerMatchingConfig) || {};

  let allBlanksCorrect = true;
  const blankFeedbacks: BlankReviewItem[] = [];

  for (let i = 0; i < qBlanks.length; i++) {
    const b = qBlanks[i];
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
  db: DbInstance,
  userId?: string
) {
  const attempt = await db
    .select()
    .from(quizAttempts)
    .where(eq(quizAttempts.id, attemptId))
    .get();

  if (!attempt) {
    throw new Error(`Attempt with ID ${attemptId} not found.`);
  }

  if (userId && userId !== 'local-user' && attempt.userId && attempt.userId !== userId) {
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
    await saveAttemptAnswers(attemptId, answersSnapshot, db, userId);
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

export async function getAttemptResult(
  attemptId: string,
  db: DbInstance,
  userId?: string
) {
  const attempt = await db
    .select()
    .from(quizAttempts)
    .where(eq(quizAttempts.id, attemptId))
    .get();

  if (!attempt) {
    throw new Error(`Attempt with ID ${attemptId} not found.`);
  }

  if (userId && userId !== 'local-user' && attempt.userId && attempt.userId !== userId) {
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

export async function listAttemptHistory(
  skip = 0,
  limit = 50,
  db: DbInstance,
  userId?: string
) {
  const isFilteredUser = userId && userId !== 'local-user';
  const userCondition = isFilteredUser ? eq(quizAttempts.userId, userId) : undefined;

  // Use SQL count(*) instead of loading all attempts into memory
  const countRow = userCondition
    ? await db
        .select({ count: sql<number>`count(*)` })
        .from(quizAttempts)
        .where(userCondition)
        .get()
    : await db
        .select({ count: sql<number>`count(*)` })
        .from(quizAttempts)
        .get();

  const total = countRow?.count ?? 0;

  // Use SQL limit and offset for efficient database-level pagination
  const baseQuery = db.select().from(quizAttempts);
  const pagedAttempts = userCondition
    ? await baseQuery
        .where(userCondition)
        .orderBy(desc(quizAttempts.startedAt))
        .limit(limit)
        .offset(skip)
        .all()
    : await baseQuery
        .orderBy(desc(quizAttempts.startedAt))
        .limit(limit)
        .offset(skip)
        .all();

  const attemptIds = pagedAttempts.map((a) => a.id);
  const quizIds = Array.from(new Set(pagedAttempts.map((a) => a.quizId)));

  const quizList =
    quizIds.length > 0
      ? await db.select().from(quizzes).where(inArray(quizzes.id, quizIds)).all()
      : [];
  const quizTitleMap = new Map<string, string>();
  for (let i = 0; i < quizList.length; i++) {
    quizTitleMap.set(quizList[i].id, quizList[i].title);
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
  for (let i = 0; i < resultsList.length; i++) {
    resultMap.set(resultsList[i].attemptId, resultsList[i]);
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

// --- Internal Helpers ---

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
  for (let i = 0; i < quizBlanks.length; i++) {
    const b = quizBlanks[i];
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
  for (let i = 0; i < savedResponses.length; i++) {
    const r = savedResponses[i];
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
    remaining_seconds: remainingSeconds,
    started_at: attempt.startedAt,
    deadline_at: attempt.deadlineAt,
    status: attempt.status,
    mode: attempt.mode,
    questions: publicQuestions,
    saved_answers: savedAnswers,
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
  for (let i = 0; i < quizBlanks.length; i++) {
    const b = quizBlanks[i];
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
  for (let i = 0; i < responses.length; i++) {
    const r = responses[i];
    if (!userAnswers[r.questionId]) {
      userAnswers[r.questionId] = {};
    }
    userAnswers[r.questionId][r.blankIdentifier] = r.responseText;
  }

  const gradingConfig = (quiz.gradingConfig as Record<string, unknown>) || {};
  const matchingConfig: AnswerMatchingConfig =
    (gradingConfig.answerMatching as AnswerMatchingConfig) || {};

  let totalQuestions = quizQuestions.length;
  let totalBlanks = 0;
  let correctBlanks = 0;
  let incorrectBlanks = 0;
  let unansweredBlanks = 0;
  let fullyCorrectQuestions = 0;

  const detailedQuestions: AttemptResultQuestion[] = [];

  for (let i = 0; i < quizQuestions.length; i++) {
    const q = quizQuestions[i];
    const qBlanks = blanksByQuestion.get(q.id) || [];
    const qAnswers = userAnswers[q.id] || {};

    let allBlanksCorrect = true;
    const blankReviews: BlankReviewItem[] = [];

    for (let j = 0; j < qBlanks.length; j++) {
      const b = qBlanks[j];
      totalBlanks++;

      const submittedText = qAnswers[b.blankIdentifier] ?? '';
      const userTrimmed = submittedText.trim();
      const isUnanswered = userTrimmed === '';

      const acceptedList: string[] = Array.isArray(b.acceptedAnswers)
        ? (b.acceptedAnswers as string[])
        : [];
      const primaryCorrect = acceptedList[0] || '';

      let isCorrect = false;
      if (isUnanswered) {
        unansweredBlanks++;
        allBlanksCorrect = false;
      } else {
        isCorrect = evaluateBlank(submittedText, acceptedList, matchingConfig);
        if (isCorrect) {
          correctBlanks++;
        } else {
          incorrectBlanks++;
          allBlanksCorrect = false;
        }
      }

      blankReviews.push({
        blank_identifier: b.blankIdentifier,
        user_answer: submittedText,
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
  const detailed = (result.detailedResults as { questions?: AttemptResultQuestion[] }) || {};
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
    questions: (detailed.questions as AttemptResultQuestion[]) || [],
  };
}

/**
 * Calculates topic mastery statistics from a list of detailed questions.
 */
export function calculateAttemptTopicMastery(
  detailedQuestions: Array<{
    topic: string;
    blanks: Array<{ is_correct: boolean }>;
  }>
): TopicMasteryItem[] {
  const statsMap = new Map<string, { total: number; correct: number }>();

  for (let i = 0; i < detailedQuestions.length; i++) {
    const q = detailedQuestions[i];
    const rawTopic = (q.topic || 'General Grammar').trim();
    if (!statsMap.has(rawTopic)) {
      statsMap.set(rawTopic, { total: 0, correct: 0 });
    }
    const stat = statsMap.get(rawTopic)!;
    const qBlanks = q.blanks || [];
    for (let j = 0; j < qBlanks.length; j++) {
      stat.total++;
      if (qBlanks[j].is_correct) stat.correct++;
    }
  }

  const result: TopicMasteryItem[] = [];
  for (const [topic, stat] of statsMap.entries()) {
    const percentage =
      stat.total > 0 ? Math.round((stat.correct / stat.total) * 100) : 0;
    let masteryLevel: TopicMasteryItem['masteryLevel'] = 'needs_practice';
    if (percentage >= 90) masteryLevel = 'mastered';
    else if (percentage >= 75) masteryLevel = 'proficient';
    else if (percentage >= 50) masteryLevel = 'developing';

    result.push({
      topic,
      totalBlanks: stat.total,
      correctBlanks: stat.correct,
      percentage,
      masteryLevel,
    });
  }

  // Sort lowest percentage first to highlight weak areas
  result.sort((a, b) => a.percentage - b.percentage);
  return result;
}

/**
 * Calculates overall topic mastery for a given user across all past attempts.
 */
export async function getUserTopicMastery(
  db: DbInstance,
  userId: string = 'local-user'
): Promise<{
  topics: TopicMasteryItem[];
  overallAccuracy: number;
  totalCompletedAttempts: number;
}> {
  const isLocal = userId === 'local-user';
  const query = db
    .select({
      id: quizAttempts.id,
      detailedResults: attemptResults.detailedResults,
      accuracyPercentage: attemptResults.accuracyPercentage,
    })
    .from(quizAttempts)
    .innerJoin(attemptResults, eq(quizAttempts.id, attemptResults.attemptId));

  const rows = isLocal
    ? await query.all()
    : await query.where(eq(quizAttempts.userId, userId)).all();

  const allQuestions: Array<{
    topic: string;
    blanks: Array<{ is_correct: boolean }>;
  }> = [];

  let sumAccuracy = 0;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    sumAccuracy += row.accuracyPercentage || 0;
    const detailed = (row.detailedResults as { questions?: AttemptResultQuestion[] }) || {};
    if (Array.isArray(detailed.questions)) {
      allQuestions.push(...detailed.questions);
    }
  }

  const topics = calculateAttemptTopicMastery(allQuestions);
  const overallAccuracy =
    rows.length > 0 ? Math.round((sumAccuracy / rows.length) * 10) / 10 : 0;

  return {
    topics,
    overallAccuracy,
    totalCompletedAttempts: rows.length,
  };
}

/**
 * Reusable helper to replicate a list of questions and their blanks into a new dynamic quiz.
 * Performs batch insertions to eliminate N+1 round trips.
 */
async function replicateQuestionsToQuiz(
  db: DbInstance,
  targetQuizId: string,
  sourceQuestions: (typeof questions.$inferSelect)[],
  sourceBlanks: (typeof blanks.$inferSelect)[]
): Promise<void> {
  const blanksByQuestionId = new Map<string, (typeof blanks.$inferSelect)[]>();
  for (let i = 0; i < sourceBlanks.length; i++) {
    const b = sourceBlanks[i];
    if (!blanksByQuestionId.has(b.questionId)) {
      blanksByQuestionId.set(b.questionId, []);
    }
    blanksByQuestionId.get(b.questionId)!.push(b);
  }

  const newQuestionRows: (typeof questions.$inferInsert)[] = [];
  const newBlankRows: (typeof blanks.$inferInsert)[] = [];

  for (let i = 0; i < sourceQuestions.length; i++) {
    const origQ = sourceQuestions[i];
    const newQId = crypto.randomUUID();

    newQuestionRows.push({
      id: newQId,
      quizId: targetQuizId,
      externalId: `${origQ.externalId}_mistake`,
      orderIndex: i + 1,
      topic: origQ.topic,
      section: origQ.section,
      questionType: origQ.questionType,
      title: origQ.title,
      prompt: origQ.prompt,
      blankCount: origQ.blankCount,
      objectiveIds: origQ.objectiveIds,
      explanation: origQ.explanation,
      difficulty: origQ.difficulty,
      sourcePdfPage: origQ.sourcePdfPage,
    });

    const origBlanks = blanksByQuestionId.get(origQ.id) || [];
    for (let j = 0; j < origBlanks.length; j++) {
      const ob = origBlanks[j];
      newBlankRows.push({
        id: crypto.randomUUID(),
        questionId: newQId,
        blankIdentifier: ob.blankIdentifier,
        orderIndex: ob.orderIndex,
        acceptedAnswers: ob.acceptedAnswers,
        sourceQuestionId: ob.sourceQuestionId,
        objectiveId: ob.objectiveId,
      });
    }
  }

  // Batch insert questions in chunks to respect Cloudflare D1's 100 bound parameter limit
  for (let i = 0; i < newQuestionRows.length; i += QUESTIONS_CHUNK_SIZE) {
    const chunk = newQuestionRows.slice(i, i + QUESTIONS_CHUNK_SIZE);
    await db.insert(questions).values(chunk);
  }

  // Batch insert blanks in chunks to respect Cloudflare D1's 100 bound parameter limit
  for (let i = 0; i < newBlankRows.length; i += BLANKS_CHUNK_SIZE) {
    const chunk = newBlankRows.slice(i, i + BLANKS_CHUNK_SIZE);
    await db.insert(blanks).values(chunk);
  }
}

/**
 * Creates a dynamic "Practice Mistakes Only" attempt from a specific past attempt.
 * Batch queries questions and blanks to avoid N+1 bottlenecks.
 */
export async function createMistakesPracticeAttempt(
  sourceAttemptId: string,
  db: DbInstance,
  userId: string = 'local-user'
): Promise<{ attemptId: string; quizId: string; mistakeCount: number }> {
  const result = await getAttemptResult(sourceAttemptId, db, userId);
  const originalQuiz = await db
    .select()
    .from(quizzes)
    .where(eq(quizzes.id, result.quiz_id))
    .get();

  if (!originalQuiz) {
    throw new Error(`Original quiz ${result.quiz_id} not found.`);
  }

  const missedQuestions: AttemptResultQuestion[] = result.questions.filter(
    (q: AttemptResultQuestion) => !q.is_fully_correct
  );
  if (missedQuestions.length === 0) {
    throw new Error(
      'Awesome work! All questions in this attempt were answered correctly, so there are no mistakes to review.'
    );
  }

  const missedQIds = missedQuestions.map((q) => q.question_id);

  const origQuestions: (typeof questions.$inferSelect)[] = [];
  const origBlanks: (typeof blanks.$inferSelect)[] = [];

  for (let i = 0; i < missedQIds.length; i += IN_ARRAY_CHUNK_SIZE) {
    const chunkIds = missedQIds.slice(i, i + IN_ARRAY_CHUNK_SIZE);
    const [qChunk, bChunk] = await Promise.all([
      db.select().from(questions).where(inArray(questions.id, chunkIds)).all(),
      db
        .select()
        .from(blanks)
        .where(inArray(blanks.questionId, chunkIds))
        .orderBy(asc(blanks.orderIndex))
        .all(),
    ]);
    origQuestions.push(...qChunk);
    origBlanks.push(...bChunk);
  }

  // Create dynamic practice quiz
  const dynamicQuizId = crypto.randomUUID();
  const hash = await calculateContentHash(
    `practice_mistakes_${sourceAttemptId}_${Date.now()}`
  );

  let totalBlanks = 0;
  for (let i = 0; i < missedQuestions.length; i++) {
    totalBlanks += missedQuestions[i].blanks?.length || 0;
  }

  const nowIso = new Date().toISOString();
  await db.insert(quizzes).values({
    id: dynamicQuizId,
    courseId: originalQuiz.courseId,
    contentHash: hash,
    schemaVersion: '2.0.0',
    quizType: 'multi_blank_fill_in_the_blank',
    language: 'en',
    title: `🎯 Retest Mistakes: ${originalQuiz.title}`,
    unitNumber: originalQuiz.unitNumber,
    unitTitle: `Mistakes Retest`,
    instructions: `Practice Session: Focus exclusively on the ${missedQuestions.length} question(s) answered incorrectly previously. Take your time to understand each blank.`,
    placeholderSyntax: originalQuiz.placeholderSyntax || '{{n}}',
    gradingConfig: originalQuiz.gradingConfig,
    topics: originalQuiz.topics,
    questionCount: missedQuestions.length,
    blankCount: totalBlanks,
    status: 'ready',
    createdAt: nowIso,
  });

  // Replicate questions and blanks in bulk
  await replicateQuestionsToQuiz(db, dynamicQuizId, origQuestions, origBlanks);

  // Create an immediate self-paced practice attempt
  const attempt = await createAttempt(
    dynamicQuizId,
    0,
    'practice',
    db,
    userId
  );

  return {
    attemptId: attempt.id,
    quizId: dynamicQuizId,
    mistakeCount: missedQuestions.length,
  };
}

/**
 * Creates a dynamic "Practice Mistakes Only" attempt combining mistakes across all units of a course.
 */
export async function createCourseMistakesPracticeAttempt(
  courseId: string,
  db: DbInstance,
  userId: string = 'local-user'
): Promise<{ attemptId: string; quizId: string; mistakeCount: number }> {
  const isLocal = userId === 'local-user';
  const course = await db
    .select()
    .from(courses)
    .where(eq(courses.id, courseId))
    .get();

  if (!course) {
    throw new Error(`Course ${courseId} not found.`);
  }

  const courseQuizzes = await db
    .select({ id: quizzes.id })
    .from(quizzes)
    .where(eq(quizzes.courseId, courseId))
    .all();

  const quizIds = courseQuizzes.map((q) => q.id);
  if (quizIds.length === 0) {
    throw new Error('This course does not have any quizzes yet.');
  }

  // Get completed attempts for these quizzes
  const conditions = [inArray(quizAttempts.quizId, quizIds)];
  if (!isLocal) {
    conditions.push(eq(quizAttempts.userId, userId));
  }

  const rows = await db
    .select({
      id: quizAttempts.id,
      quizId: quizAttempts.quizId,
      detailedResults: attemptResults.detailedResults,
    })
    .from(quizAttempts)
    .innerJoin(attemptResults, eq(quizAttempts.id, attemptResults.attemptId))
    .where(and(...conditions))
    .all();

  if (rows.length === 0) {
    throw new Error('No completed quiz attempts found for this course.');
  }

  // Collect missed question IDs (deduplicated)
  const missedQuestionIds = new Set<string>();
  for (let i = 0; i < rows.length; i++) {
    const detailed = (rows[i].detailedResults as { questions?: AttemptResultQuestion[] }) || {};
    if (Array.isArray(detailed.questions)) {
      for (let j = 0; j < detailed.questions.length; j++) {
        const q = detailed.questions[j];
        if (!q.is_fully_correct && q.question_id) {
          missedQuestionIds.add(q.question_id);
        }
      }
    }
  }

  if (missedQuestionIds.size === 0) {
    throw new Error('Great job! No mistakes found across any quizzes in this course.');
  }

  const missedQIdArray = Array.from(missedQuestionIds);

  const missedQList: (typeof questions.$inferSelect)[] = [];
  const missedBlanksList: (typeof blanks.$inferSelect)[] = [];

  for (let i = 0; i < missedQIdArray.length; i += IN_ARRAY_CHUNK_SIZE) {
    const chunkIds = missedQIdArray.slice(i, i + IN_ARRAY_CHUNK_SIZE);
    const [qChunk, bChunk] = await Promise.all([
      db.select().from(questions).where(inArray(questions.id, chunkIds)).all(),
      db
        .select()
        .from(blanks)
        .where(inArray(blanks.questionId, chunkIds))
        .orderBy(asc(blanks.orderIndex))
        .all(),
    ]);
    missedQList.push(...qChunk);
    missedBlanksList.push(...bChunk);
  }

  const dynamicQuizId = crypto.randomUUID();
  const hash = await calculateContentHash(
    `course_mistakes_${courseId}_${Date.now()}`
  );

  let totalBlanks = 0;
  for (let i = 0; i < missedQList.length; i++) {
    totalBlanks += missedQList[i].blankCount || 0;
  }

  const nowIso = new Date().toISOString();
  await db.insert(quizzes).values({
    id: dynamicQuizId,
    courseId,
    contentHash: hash,
    schemaVersion: '2.0.0',
    quizType: 'multi_blank_fill_in_the_blank',
    language: 'en',
    title: `🎯 Master Your Mistakes: ${course.title}`,
    unitNumber: null,
    unitTitle: `Course Mistakes Review`,
    instructions: `Comprehensive Course Mistake Review: Practice the ${missedQList.length} question(s) answered incorrectly across all units in ${course.title}.`,
    placeholderSyntax: '{{n}}',
    gradingConfig: { mode: 'per_blank', questionCompleteWhen: 'all_blanks_correct' },
    topics: null,
    questionCount: missedQList.length,
    blankCount: totalBlanks,
    status: 'ready',
    createdAt: nowIso,
  });

  // Replicate questions and blanks in bulk
  await replicateQuestionsToQuiz(db, dynamicQuizId, missedQList, missedBlanksList);

  const attempt = await createAttempt(dynamicQuizId, 0, 'practice', db, userId);

  return {
    attemptId: attempt.id,
    quizId: dynamicQuizId,
    mistakeCount: missedQList.length,
  };
}
