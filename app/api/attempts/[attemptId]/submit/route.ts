import { NextResponse } from 'next/server';
import { getDb } from '@/db';
import { ensureDatabaseInitialized } from '@/lib/db-init';
import { submitAttempt } from '@/lib/attempt-service';
import { SubmitAttemptSchema } from '@/lib/validation';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ attemptId: string }> }
) {
  try {
    await ensureDatabaseInitialized();
    const db = getDb();
    const { attemptId } = await params;

    let body = {};
    try {
      body = await request.json();
    } catch {
      // Body may be empty
    }

    const parsed = SubmitAttemptSchema.safeParse(body);
    const answers = parsed.success ? parsed.data.answers : undefined;

    const result = await submitAttempt(attemptId, answers, db);
    return NextResponse.json(result);
  } catch (err: any) {
    const isNotFound = err.message?.includes('not found');
    return NextResponse.json(
      { detail: err.message },
      { status: isNotFound ? 404 : 500 }
    );
  }
}
