import { NextResponse } from 'next/server';
import { getDb } from '@/db';
import { ensureDatabaseInitialized } from '@/lib/db-init';
import { createAttempt } from '@/lib/attempt-service';
import { StartAttemptSchema } from '@/lib/validation';
import { getAuthenticatedUserOrLocal } from '@/app/chatgpt-auth';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ quizId: string }> }
) {
  try {
    await ensureDatabaseInitialized();
    const db = getDb();
    const user = await getAuthenticatedUserOrLocal();
    const { quizId } = await params;

    let body = {};
    try {
      body = await request.json();
    } catch {
      // Body may be empty
    }

    const parsed = StartAttemptSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { detail: parsed.error.issues.map((i) => i.message).join('; ') },
        { status: 422 }
      );
    }

    const { duration_minutes, mode } = parsed.data;
    const attemptState = await createAttempt(
      quizId,
      duration_minutes,
      mode,
      db,
      user.userId
    );

    return NextResponse.json(attemptState, { status: 201 });
  } catch (err: any) {
    const isNotFound = err.message?.includes('not found');
    return NextResponse.json(
      { detail: err.message },
      { status: isNotFound ? 404 : 500 }
    );
  }
}
