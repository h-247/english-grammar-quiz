import { NextResponse } from 'next/server';
import { getDb } from '@/db';
import { ensureDatabaseInitialized } from '@/lib/db-init';
import { createCourseMistakesPracticeAttempt } from '@/lib/attempt-service';
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

    const session = await createCourseMistakesPracticeAttempt(
      courseId,
      db,
      user.userId
    );

    return NextResponse.json({
      success: true,
      attempt_id: session.attemptId,
      quiz_id: session.quizId,
      mistake_count: session.mistakeCount,
      message: `Started course-wide practice session with ${session.mistakeCount} missed question(s).`,
    });
  } catch (err: any) {
    return NextResponse.json(
      { detail: err.message || 'Failed to create course mistakes practice session.' },
      { status: 400 }
    );
  }
}
