import { NextResponse } from 'next/server';
import { getDb } from '@/db';
import { quizzes, courses, quizAttempts, attemptResults } from '@/db/schema';
import { ensureDatabaseInitialized } from '@/lib/db-init';
import { eq, and, asc, desc, or, isNull, inArray } from 'drizzle-orm';
import { getAuthenticatedUserOrLocal } from '@/app/chatgpt-auth';

export async function GET(request: Request) {
  try {
    await ensureDatabaseInitialized();
    const db = getDb();
    const user = await getAuthenticatedUserOrLocal();
    const url = new URL(request.url);

    const courseId = url.searchParams.get('course_id');
    const status = url.searchParams.get('status');

    let conditions = [];
    if (courseId) {
      if (user.userId !== 'local-user') {
        const c = await db.select().from(courses).where(eq(courses.id, courseId)).get();
        if (c && c.userId && c.userId !== user.userId) {
          return NextResponse.json(
            { detail: `Course with ID ${courseId} not found.` },
            { status: 404 }
          );
        }
      }
      conditions.push(eq(quizzes.courseId, courseId));
    } else if (user.userId !== 'local-user') {
      conditions.push(
        or(
          eq(courses.userId, user.userId),
          isNull(courses.userId),
          isNull(quizzes.courseId)
        )
      );
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

    const highestScoreMap = new Map<string, number>();
    const completedAttemptsCountMap = new Map<string, number>();

    if (rows.length > 0) {
      const quizIds = rows.map((r) => r.quiz.id);
      const isLocal = !user.userId || user.userId === 'local-user';
      const CHUNK_SIZE = 50;

      for (let i = 0; i < quizIds.length; i += CHUNK_SIZE) {
        const chunk = quizIds.slice(i, i + CHUNK_SIZE);
        const whereConditions = [inArray(quizAttempts.quizId, chunk)];
        if (!isLocal) {
          whereConditions.push(eq(quizAttempts.userId, user.userId));
        }

        const scoreRows = await db
          .select({
            quizId: quizAttempts.quizId,
            accuracyPercentage: attemptResults.accuracyPercentage,
          })
          .from(quizAttempts)
          .innerJoin(attemptResults, eq(attemptResults.attemptId, quizAttempts.id))
          .where(and(...whereConditions))
          .all();

        for (const row of scoreRows) {
          if (row.accuracyPercentage != null) {
            const current = highestScoreMap.get(row.quizId);
            const score = Math.round(row.accuracyPercentage);
            if (current === undefined || score > current) {
              highestScoreMap.set(row.quizId, score);
            }
            completedAttemptsCountMap.set(
              row.quizId,
              (completedAttemptsCountMap.get(row.quizId) || 0) + 1
            );
          }
        }
      }
    }

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
      chatgpt_url: q.chatgptUrl || null,
      status: q.status,
      learning_status: (q as any).learningStatus || 'to_do',
      highest_score: highestScoreMap.has(q.id) ? highestScoreMap.get(q.id)! : null,
      completed_attempts: completedAttemptsCountMap.get(q.id) || 0,
      created_at: q.createdAt,
    }));

    return NextResponse.json(response);
  } catch (err: any) {
    return NextResponse.json({ detail: err.message }, { status: 500 });
  }
}
