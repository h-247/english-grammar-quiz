import { NextResponse } from 'next/server';
import { getDb } from '@/db';
import { quizzes, courses, questions, blanks } from '@/db/schema';
import { ensureDatabaseInitialized } from '@/lib/db-init';
import { eq, asc, inArray } from 'drizzle-orm';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ quizId: string }> }
) {
  try {
    await ensureDatabaseInitialized();
    const db = getDb();
    const { quizId } = await params;

    const row = await db
      .select({
        quiz: quizzes,
        courseTitle: courses.title,
      })
      .from(quizzes)
      .leftJoin(courses, eq(quizzes.courseId, courses.id))
      .where(eq(quizzes.id, quizId))
      .get();

    if (!row) {
      return NextResponse.json(
        { detail: `Quiz with ID ${quizId} not found.` },
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
      drive_file_id: q.driveFileId,
      source_filename: q.sourceFilename,
      status: q.status,
      questions: publicQuestions,
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
    const { quizId } = await params;

    const quiz = await db
      .select()
      .from(quizzes)
      .where(eq(quizzes.id, quizId))
      .get();

    if (!quiz) {
      return NextResponse.json(
        { detail: `Quiz with ID ${quizId} not found.` },
        { status: 404 }
      );
    }

    await db.delete(quizzes).where(eq(quizzes.id, quizId));

    return NextResponse.json({
      message: `Quiz '${quiz.title}' deleted successfully.`,
      quiz_id: quizId,
    });
  } catch (err: any) {
    return NextResponse.json({ detail: err.message }, { status: 500 });
  }
}
