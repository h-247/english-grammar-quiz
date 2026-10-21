import { NextResponse } from 'next/server';
import { getDb } from '@/db';
import { courses, quizzes } from '@/db/schema';
import { ensureDatabaseInitialized } from '@/lib/db-init';
import { calculateCourseStats } from '@/lib/course-service';
import { eq, asc } from 'drizzle-orm';

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

    await db.delete(courses).where(eq(courses.id, courseId));

    return NextResponse.json({
      message: `Course '${course.title}' deleted successfully.`,
      course_id: courseId,
    });
  } catch (err: any) {
    return NextResponse.json({ detail: err.message }, { status: 500 });
  }
}
