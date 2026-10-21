import { NextResponse } from 'next/server';
import { getDb } from '@/db';
import { ensureDatabaseInitialized } from '@/lib/db-init';
import { saveAttemptAnswers } from '@/lib/attempt-service';
import { SaveAnswersSchema } from '@/lib/validation';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ attemptId: string }> }
) {
  try {
    await ensureDatabaseInitialized();
    const db = getDb();
    const { attemptId } = await params;

    const body = await request.json();
    const parsed = SaveAnswersSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { detail: parsed.error.issues.map((i) => i.message).join('; ') },
        { status: 422 }
      );
    }

    const res = await saveAttemptAnswers(attemptId, parsed.data.answers, db);
    return NextResponse.json(res);
  } catch (err: any) {
    const isNotFound = err.message?.includes('not found');
    return NextResponse.json(
      { detail: err.message },
      { status: isNotFound ? 404 : 500 }
    );
  }
}
