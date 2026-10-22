import { NextResponse } from 'next/server';
import { getDb } from '@/db';
import { courses, quizzes } from '@/db/schema';
import { ensureDatabaseInitialized } from '@/lib/db-init';
import { syncCourseDriveQuizzes, calculateCourseStats } from '@/lib/course-service';
import { eq, asc } from 'drizzle-orm';
import { getAuthenticatedUserOrLocal } from '@/app/chatgpt-auth';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ courseId: string }> }
) {
  try {
    await ensureDatabaseInitialized();
    const db = getDb();
    const user = await getAuthenticatedUserOrLocal();
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

    if (
      user.userId !== 'local-user' &&
      course.userId &&
      course.userId !== user.userId
    ) {
      return NextResponse.json(
        { detail: 'You do not have permission to sync this course.' },
        { status: 403 }
      );
    }

    // Parse optional batching parameters
    const url = new URL(request.url);
    let body: any = {};
    try {
      body = await request.json();
    } catch {}

    const offsetParam = url.searchParams.get('offset') || body.offset;
    const batchSizeParam = url.searchParams.get('batchSize') || body.batchSize;
    const forceParam = url.searchParams.get('force') || body.forceRefresh;

    const offset = offsetParam != null ? parseInt(String(offsetParam), 10) : undefined;
    const batchSize = batchSizeParam != null ? parseInt(String(batchSizeParam), 10) : undefined;
    const forceRefresh = forceParam === 'true' || forceParam === true;

    const syncResult = await syncCourseDriveQuizzes(courseId, db, {
      offset,
      batchSize,
      forceRefresh,
    });

    const stats = await calculateCourseStats(courseId, db, user.userId);
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
      total_quizzes: stats.total_quizzes,
      ready_quizzes: stats.ready_quizzes,
      pending_quizzes: stats.pending_quizzes,
      completed_quizzes: stats.completed_quizzes,
      created_at: course.createdAt,
      updated_at: course.updatedAt,
      quizzes: quizSummaries,
      sync_result: syncResult,
    });
  } catch (err: any) {
    return NextResponse.json({ detail: err.message }, { status: 500 });
  }
}
