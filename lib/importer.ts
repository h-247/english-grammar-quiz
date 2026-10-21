import { eq, and, inArray } from 'drizzle-orm';
import { QuizImportSchema, QuizImportData } from './validation';
import { calculateContentHash } from './hash';
import { quizzes, questions, blanks } from '@/db/schema';
import type { drizzle } from 'drizzle-orm/d1';

type DbInstance = ReturnType<typeof drizzle>;

export interface QuizImportResult {
  message: string;
  quiz_id: string;
  title: string;
  question_count: number;
  blank_count: number;
  is_duplicate: boolean;
}

export async function importQuizData(
  rawContent: string | Record<string, any>,
  db: DbInstance,
  options?: { overwrite?: boolean; courseId?: string | null }
): Promise<QuizImportResult> {
  const { overwrite = false, courseId = null } = options || {};

  // 1. Parse JSON
  let data: any;
  if (typeof rawContent === 'string') {
    try {
      data = JSON.parse(rawContent);
    } catch (err: any) {
      throw new Error(`Invalid JSON syntax: ${err.message}`);
    }
  } else {
    data = rawContent;
  }

  // 2. Validate with Zod
  const parseResult = QuizImportSchema.safeParse(data);
  if (!parseResult.success) {
    const errorDetails = parseResult.error.issues
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join('; ');
    throw new Error(`Quiz validation error: ${errorDetails}`);
  }

  const validatedQuiz: QuizImportData = parseResult.data;

  // 3. Calculate content hash (scoped to courseId so different courses never collide on UNIQUE content_hash)
  const rawHash = await calculateContentHash(data);
  const contentHash = courseId ? `${courseId}_${rawHash}` : rawHash;

  // 4. Check for existing quiz
  const unitNumber = validatedQuiz.unit?.number ?? null;
  const unitTitle = validatedQuiz.unit?.title ?? null;
  const quizTitle =
    unitTitle || (unitNumber ? `Unit ${unitNumber}` : 'English Grammar Quiz');

  let targetQuiz: any = null;

  if (courseId) {
    // Only look within the designated course
    const existingInCourse = await db
      .select()
      .from(quizzes)
      .where(eq(quizzes.courseId, courseId))
      .all();

    targetQuiz =
      existingInCourse.find(
        (q) =>
          q.contentHash === contentHash ||
          q.contentHash === rawHash ||
          (unitNumber !== null && q.unitNumber === unitNumber)
      ) || null;
  } else {
    targetQuiz = await db
      .select()
      .from(quizzes)
      .where(eq(quizzes.contentHash, contentHash))
      .get();

    if (!targetQuiz && unitNumber !== null) {
      targetQuiz = await db
        .select()
        .from(quizzes)
        .where(eq(quizzes.unitNumber, unitNumber))
        .get();
    }
  }

  let preservedCourseId = courseId;
  let preservedDriveFileId: string | null = null;
  let preservedSourceFilename: string | null = null;
  let targetQuizId = crypto.randomUUID();

  if (targetQuiz) {
    if (targetQuiz.status === 'pending_import') {
      // Replacing a pending placeholder with actual questions
      preservedCourseId = targetQuiz.courseId || courseId;
      preservedDriveFileId = targetQuiz.driveFileId;
      preservedSourceFilename = targetQuiz.sourceFilename;
      targetQuizId = targetQuiz.id;

      // Clean up previous placeholder
      await db.delete(quizzes).where(eq(quizzes.id, targetQuiz.id));
    } else if (!overwrite) {
      return {
        message: 'Quiz file has already been imported.',
        quiz_id: targetQuiz.id,
        title: targetQuiz.title,
        question_count: targetQuiz.questionCount,
        blank_count: targetQuiz.blankCount,
        is_duplicate: true,
      };
    } else {
      // Overwrite existing quiz: delete previous questions, blanks, and quiz record
      targetQuizId = targetQuiz.id;
      preservedCourseId = targetQuiz.courseId || courseId;
      preservedDriveFileId = targetQuiz.driveFileId;
      preservedSourceFilename = targetQuiz.sourceFilename;

      const prevQuestions = await db
        .select({ id: questions.id })
        .from(questions)
        .where(eq(questions.quizId, targetQuiz.id))
        .all();

      if (prevQuestions.length > 0) {
        const prevQIds = prevQuestions.map((q) => q.id);
        await db.delete(blanks).where(inArray(blanks.questionId, prevQIds));
        await db.delete(questions).where(inArray(questions.id, prevQIds));
      }

      await db.delete(quizzes).where(eq(quizzes.id, targetQuiz.id));
    }
  }

  // 5. Calculate blank counts
  let totalBlanks = 0;
  for (const q of validatedQuiz.questions) {
    totalBlanks += q.blanks.length;
  }

  const nowIso = new Date().toISOString();

  // 6. Insert Quiz record
  await db.insert(quizzes).values({
    id: targetQuizId,
    contentHash,
    schemaVersion: validatedQuiz.schemaVersion,
    quizType: validatedQuiz.quizType,
    language: validatedQuiz.language,
    title: quizTitle,
    unitNumber: unitNumber,
    unitTitle: unitTitle,
    instructions: validatedQuiz.instructions || null,
    placeholderSyntax: validatedQuiz.placeholderSyntax,
    gradingConfig: validatedQuiz.grading || null,
    topics: validatedQuiz.topics || null,
    learningObjectives: validatedQuiz.learningObjectives || null,
    coverageAudit: validatedQuiz.coverageAudit || null,
    questionCount: validatedQuiz.questions.length,
    blankCount: totalBlanks,
    courseId: preservedCourseId,
    driveFileId: preservedDriveFileId,
    sourceFilename: validatedQuiz.unit?.sourceFilename || preservedSourceFilename,
    status: 'ready',
    createdAt: nowIso,
  });

  // 7. Insert Question & Blank records
  for (let qIndex = 0; qIndex < validatedQuiz.questions.length; qIndex++) {
    const q = validatedQuiz.questions[qIndex];
    const questionId = crypto.randomUUID();

    await db.insert(questions).values({
      id: questionId,
      quizId: targetQuizId,
      externalId: q.id,
      orderIndex: qIndex,
      topic: q.topic,
      section: q.section || null,
      questionType: q.type,
      title: q.title,
      prompt: q.prompt,
      blankCount: q.blanks.length,
      objectiveIds: q.objectiveIds || null,
      explanation: q.explanation || null,
      difficulty: q.difficulty || null,
      sourcePdfPage: q.sourcePdfPage || null,
    });

    for (let bIndex = 0; bIndex < q.blanks.length; bIndex++) {
      const b = q.blanks[bIndex];
      const blankId = crypto.randomUUID();

      await db.insert(blanks).values({
        id: blankId,
        questionId,
        blankIdentifier: b.id,
        orderIndex: bIndex,
        acceptedAnswers: b.answers,
        sourceQuestionId: b.sourceQuestionId || null,
        objectiveId: b.objectiveId || null,
      });
    }
  }

  return {
    message: targetQuiz
      ? `Successfully updated quiz: ${quizTitle}`
      : `Successfully imported quiz: ${quizTitle}`,
    quiz_id: targetQuizId,
    title: quizTitle,
    question_count: validatedQuiz.questions.length,
    blank_count: totalBlanks,
    is_duplicate: false,
  };
}
