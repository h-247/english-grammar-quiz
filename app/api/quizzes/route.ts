import { NextResponse } from 'next/server';
import { getDb } from '@/db';
import { quizzes, courses } from '@/db/schema';
import { ensureDatabaseInitialized } from '@/lib/db-init';
import { eq, and, asc, desc } from 'drizzle-orm';

export async function GET(request: Request) {
  try {
    await ensureDatabaseInitialized();
    const db = getDb();
    const url = new URL(request.url);

    const courseId = url.searchParams.get('course_id');
    const status = url.searchParams.get('status');

    let conditions = [];
    if (courseId) {
      conditions.push(eq(quizzes.courseId, courseId));
    }
    if (status) {
      conditions.push(eq(quizzes.status, status));
    }

    const query = db
      .select({
        quiz: quizzes,
        courseTitle: courses.title,
      })
      .from(quizzes)
      .leftJoin(courses, eq(quizzes.courseId, courses.id));

    const rows =
      conditions.length > 0
        ? await query
            .where(and(...conditions))
            .orderBy(asc(quizzes.unitNumber), desc(quizzes.createdAt))
            .all()
        : await query
            .orderBy(asc(quizzes.unitNumber), desc(quizzes.createdAt))
            .all();

    const response = rows.map(({ quiz: q, courseTitle }) => ({
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
      created_at: q.createdAt,
    }));

    return NextResponse.json(response);
  } catch (err: any) {
    return NextResponse.json({ detail: err.message }, { status: 500 });
  }
}
