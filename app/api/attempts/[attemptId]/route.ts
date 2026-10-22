import { NextResponse } from 'next/server';
import { getDb } from '@/db';
import { ensureDatabaseInitialized } from '@/lib/db-init';
import { getAttemptState } from '@/lib/attempt-service';
import { getAuthenticatedUserOrLocal } from '@/app/chatgpt-auth';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ attemptId: string }> }
) {
  try {
    await ensureDatabaseInitialized();
    const db = getDb();
    const user = await getAuthenticatedUserOrLocal();
    const { attemptId } = await params;

    const state = await getAttemptState(attemptId, db, user.userId);
    return NextResponse.json(state);
  } catch (err: any) {
    const isNotFound = err.message?.includes('not found');
    return NextResponse.json(
      { detail: err.message },
      { status: isNotFound ? 404 : 500 }
    );
  }
}
