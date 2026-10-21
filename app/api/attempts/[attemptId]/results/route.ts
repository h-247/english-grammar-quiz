import { NextResponse } from 'next/server';
import { getDb } from '@/db';
import { ensureDatabaseInitialized } from '@/lib/db-init';
import { getAttemptResult } from '@/lib/attempt-service';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ attemptId: string }> }
) {
  try {
    await ensureDatabaseInitialized();
    const db = getDb();
    const { attemptId } = await params;

    const result = await getAttemptResult(attemptId, db);
    return NextResponse.json(result);
  } catch (err: any) {
    const isNotFound = err.message?.includes('not found');
    const isProgress = err.message?.includes('in progress');
    return NextResponse.json(
      { detail: err.message },
      { status: isNotFound ? 404 : isProgress ? 400 : 500 }
    );
  }
}
