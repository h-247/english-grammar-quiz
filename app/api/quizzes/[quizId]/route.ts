import { NextResponse } from 'next/server';
import { getDb } from '@/db';
import {
  quizzes,
  courses,
  questions,
  blanks,
  quizAttempts,
  userResponses,
  attemptResults,
} from '@/db/schema';
import { ensureDatabaseInitialized } from '@/lib/db-init';
import { eq, asc, inArray } from 'drizzle-orm';
import { getAuthenticatedUserOrLocal } from '@/app/chatgpt-auth';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ quizId: string }> }
) {
  try {
    await ensureDatabaseInitialized();
    const db = getDb();
    const user = await getAuthenticatedUserOrLocal();
    const { quizId } = await params;

    const row = await db
      .select({
        quiz: quizzes,
        courseTitle: courses.title,
        courseUserId: courses.userId,
      })
      .from(quizzes)
      .leftJoin(courses, eq(quizzes.courseId, courses.id))
      .where(eq(quizzes.id, quizId))
      .get();

    if (!row) {
      return NextResponse.json(
        { detail: `Chapter/Quiz with ID ${quizId} not found.` },
        { status: 404 }
      );
    }

    if (
      user.userId !== 'local-user' &&
      row.courseUserId &&
      row.courseUserId !== user.userId
    ) {
      return NextResponse.json(
        { detail: `Chapter/Quiz with ID ${quizId} not found.` },
        { status: 404 }
      );
    }

    const { quiz: q, courseTitle } = row;

    const quizQuestions = await db
      .select()
      .from(questions)
      .where(eq(questions.quizId, quizId))
      .orderBy(asc(questions.orderIndex))
      .all();

    const qIds = quizQuestions.map((ques) => ques.id);
    const quizBlanks =
      qIds.length > 0
        ? await db
            .select()
            .from(blanks)
            .where(inArray(blanks.questionId, qIds))
            .orderBy(asc(blanks.orderIndex))
            .all()
        : [];

    const blanksByQ = new Map<string, typeof quizBlanks>();
    for (const b of quizBlanks) {
      if (!blanksByQ.has(b.questionId)) {
        blanksByQ.set(b.questionId, []);
      }
      blanksByQ.get(b.questionId)!.push(b);
    }

    const publicQuestions = quizQuestions.map((ques) => ({
      id: ques.id,
      external_id: ques.externalId,
      order_index: ques.orderIndex,
      topic: ques.topic,
      section: ques.section,
      question_type: ques.questionType,
      title: ques.title,
      prompt: ques.prompt,
      blank_count: ques.blankCount,
      blanks: (blanksByQ.get(ques.id) || []).map((b) => ({
        id: b.id,
        blank_identifier: b.blankIdentifier,
        order_index: b.orderIndex,
      })),
    }));

    let displayStatus = q.status;
    if (displayStatus === 'ready' || displayStatus === 'pending_import' || !displayStatus) {
      displayStatus = 'To do';
    }

    return NextResponse.json({
      id: q.id,
      title: q.title,
      unit_number: q.unitNumber,
      unit_title: q.unitTitle,
      instructions: q.instructions,
      placeholder_syntax: q.placeholderSyntax,
      question_count: q.questionCount,
      blank_count: q.blankCount,
      topics: (q.topics as any) || [],
      course_id: q.courseId,
      course_title: courseTitle,
      book_id: q.courseId,
      book_title: courseTitle,
      drive_file_id: q.driveFileId,
      source_filename: q.sourceFilename,
      chatgpt_url: q.chatgptUrl || null,
      status: displayStatus,
      reading_status: q.readingStatus || displayStatus,
      start_page: q.startPage,
      end_page: q.endPage,
      questions: publicQuestions,
      created_at: q.createdAt,
    });
  } catch (err: any) {
    return NextResponse.json({ detail: err.message }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ quizId: string }> }
) {
  try {
    await ensureDatabaseInitialized();
    const db = getDb();
    const user = await getAuthenticatedUserOrLocal();
    const { quizId } = await params;

    const quiz = await db
      .select()
      .from(quizzes)
      .where(eq(quizzes.id, quizId))
      .get();

    if (!quiz) {
      return NextResponse.json(
        { detail: `Chapter with ID ${quizId} not found.` },
        { status: 404 }
      );
    }

    if (quiz.courseId && user.userId !== 'local-user') {
      const c = await db.select().from(courses).where(eq(courses.id, quiz.courseId)).get();
      if (c && c.userId && c.userId !== user.userId) {
        return NextResponse.json(
          { detail: 'You do not have permission to delete this chapter.' },
          { status: 403 }
        );
      }
    }

    // Cascade delete any attempts, responses, and questions
    const attempts = await db
      .select({ id: quizAttempts.id })
      .from(quizAttempts)
      .where(eq(quizAttempts.quizId, quizId))
      .all();

    if (attempts.length > 0) {
      const attemptIds = attempts.map((a) => a.id);
      await db.delete(attemptResults).where(inArray(attemptResults.attemptId, attemptIds));
      await db.delete(userResponses).where(inArray(userResponses.attemptId, attemptIds));
      await db.delete(quizAttempts).where(inArray(quizAttempts.id, attemptIds));
    }

    const quizQuestions = await db
      .select({ id: questions.id })
      .from(questions)
      .where(eq(questions.quizId, quizId))
      .all();

    if (quizQuestions.length > 0) {
      const qIds = quizQuestions.map((q) => q.id);
      await db.delete(blanks).where(inArray(blanks.questionId, qIds));
      await db.delete(questions).where(inArray(questions.id, qIds));
    }

    await db.delete(quizzes).where(eq(quizzes.id, quizId));

    return NextResponse.json({
      message: `Chapter '${quiz.title}' was deleted successfully.`,
      quiz_id: quizId,
      chapter_id: quizId,
      reset: false,
    });
  } catch (err: any) {
    return NextResponse.json({ detail: err.message }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ quizId: string }> }
) {
  try {
    await ensureDatabaseInitialized();
    const db = getDb();
    const user = await getAuthenticatedUserOrLocal();
    const { quizId } = await params;

    const quiz = await db
      .select()
      .from(quizzes)
      .where(eq(quizzes.id, quizId))
      .get();

    if (!quiz) {
      return NextResponse.json(
        { detail: `Chapter with ID ${quizId} not found.` },
        { status: 404 }
      );
    }

    if (quiz.courseId && user.userId !== 'local-user') {
      const c = await db.select().from(courses).where(eq(courses.id, quiz.courseId)).get();
      if (c && c.userId && c.userId !== user.userId) {
        return NextResponse.json(
          { detail: 'You do not have permission to modify this chapter.' },
          { status: 403 }
        );
      }
    }

    const body = (await request.json()) as Record<string, any>;
    const updateData: Record<string, any> = {};

    if (body.status !== undefined) {
      const validStatuses = ['To do', 'Doing', 'Done'];
      const newStatus = validStatuses.includes(body.status) ? body.status : 'To do';
      updateData.status = newStatus;
      updateData.readingStatus = newStatus;
    }

    if (body.title !== undefined && typeof body.title === 'string' && body.title.trim()) {
      updateData.title = body.title.trim();
      updateData.unitTitle = body.title.trim();
    }

    if (body.instructions !== undefined) {
      updateData.instructions = body.instructions;
    }

    if (body.chatgpt_url !== undefined) {
      const trimmed =
        typeof body.chatgpt_url === 'string' ? body.chatgpt_url.trim() : null;
      updateData.chatgptUrl = trimmed || null;
    }

    if (body.learning_status !== undefined) {
      const validStatuses = ['to_do', 'doing', 'done'];
      if (validStatuses.includes(body.learning_status)) {
        updateData.learningStatus = body.learning_status;
      }
    }

    if (Object.keys(updateData).length > 0) {
      await db.update(quizzes).set(updateData).where(eq(quizzes.id, quizId));
    }

    const updated = await db
      .select()
      .from(quizzes)
      .where(eq(quizzes.id, quizId))
      .get();

    return NextResponse.json({
      id: updated!.id,
      title: updated!.title,
      unit_number: updated!.unitNumber,
      unit_title: updated!.unitTitle,
      status: updated!.status,
      reading_status: updated!.readingStatus,
      chatgpt_url: updated!.chatgptUrl || null,
      message: 'Chapter status updated successfully.',
    });
  } catch (err: any) {
    return NextResponse.json({ detail: err.message }, { status: 500 });
  }
}
