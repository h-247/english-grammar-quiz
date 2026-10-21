import { NextResponse } from 'next/server';
import { getDb } from '@/db';
import {
  courses,
  quizzes,
  questions,
  blanks,
  quizAttempts,
  userResponses,
  attemptResults,
} from '@/db/schema';
import { ensureDatabaseInitialized } from '@/lib/db-init';
import { calculateCourseStats } from '@/lib/course-service';
import { DEFAULT_COURSE_BANNER } from '@/lib/course-manifest';
import { eq, asc, inArray } from 'drizzle-orm';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ courseId: string }> }
) {
  try {
    await ensureDatabaseInitialized();
    const db = getDb();
    const { courseId } = await params;

    const course = await db
      .select()
      .from(courses)
      .where(eq(courses.id, courseId))
      .get();

    if (!course) {
      return NextResponse.json(
        { detail: `Course with ID ${courseId} not found.` },
        { status: 404 }
      );
    }

    const stats = await calculateCourseStats(courseId, db);
    const courseQuizzes = await db
      .select()
      .from(quizzes)
      .where(eq(quizzes.courseId, courseId))
      .orderBy(asc(quizzes.unitNumber))
      .all();

    const quizSummaries = courseQuizzes.map((q) => ({
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
      course_title: course.title,
      drive_file_id: q.driveFileId,
      source_filename: q.sourceFilename,
      status: q.status,
      created_at: q.createdAt,
    }));

    return NextResponse.json({
      id: course.id,
      title: course.title,
      description: course.description,
      drive_folder_id: course.driveFolderId,
      drive_folder_url: course.driveFolderUrl,
      banner_url:
        course.bannerUrl && course.bannerUrl.startsWith('http')
          ? course.bannerUrl
          : DEFAULT_COURSE_BANNER,
      total_quizzes: stats.total_quizzes,
      ready_quizzes: stats.ready_quizzes,
      pending_quizzes: stats.pending_quizzes,
      completed_quizzes: stats.completed_quizzes,
      created_at: course.createdAt,
      updated_at: course.updatedAt,
      quizzes: quizSummaries,
    });
  } catch (err: any) {
    return NextResponse.json({ detail: err.message }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ courseId: string }> }
) {
  try {
    await ensureDatabaseInitialized();
    const db = getDb();
    const { courseId } = await params;

    const course = await db
      .select()
      .from(courses)
      .where(eq(courses.id, courseId))
      .get();

    if (!course) {
      return NextResponse.json(
        { detail: `Course with ID ${courseId} not found.` },
        { status: 404 }
      );
    }

    // 1. Fetch all quiz IDs belonging to this course
    const courseQuizzes = await db
      .select({ id: quizzes.id })
      .from(quizzes)
      .where(eq(quizzes.courseId, courseId))
      .all();

    const quizIds = courseQuizzes.map((q) => q.id);

    if (quizIds.length > 0) {
      // Delete attempts, responses, and results
      const attempts = await db
        .select({ id: quizAttempts.id })
        .from(quizAttempts)
        .where(inArray(quizAttempts.quizId, quizIds))
        .all();

      if (attempts.length > 0) {
        const attemptIds = attempts.map((a) => a.id);
        await db.delete(attemptResults).where(inArray(attemptResults.attemptId, attemptIds));
        await db.delete(userResponses).where(inArray(userResponses.attemptId, attemptIds));
        await db.delete(quizAttempts).where(inArray(quizAttempts.id, attemptIds));
      }

      // Delete blanks and questions
      const quizQuestions = await db
        .select({ id: questions.id })
        .from(questions)
        .where(inArray(questions.quizId, quizIds))
        .all();

      if (quizQuestions.length > 0) {
        const qIds = quizQuestions.map((q) => q.id);
        await db.delete(blanks).where(inArray(blanks.questionId, qIds));
        await db.delete(questions).where(inArray(questions.id, qIds));
      }

      // Delete quizzes
      await db.delete(quizzes).where(inArray(quizzes.id, quizIds));
    }

    // 2. Delete the course itself
    await db.delete(courses).where(eq(courses.id, courseId));

    return NextResponse.json({
      message: `Course '${course.title}' and all its quizzes were permanently deleted.`,
      course_id: courseId,
    });
  } catch (err: any) {
    return NextResponse.json({ detail: err.message }, { status: 500 });
  }
}
