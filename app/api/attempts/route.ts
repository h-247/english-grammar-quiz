import { NextResponse } from 'next/server';
import { getDb } from '@/db';
import { ensureDatabaseInitialized } from '@/lib/db-init';
import { listAttemptHistory } from '@/lib/attempt-service';

export async function GET(request: Request) {
  try {
    await ensureDatabaseInitialized();
    const db = getDb();
    const url = new URL(request.url);

    const skip = Math.max(0, parseInt(url.searchParams.get('skip') || '0', 10) || 0);
    const limit = Math.min(
      100,
      Math.max(1, parseInt(url.searchParams.get('limit') || '50', 10) || 50)
    );

    const history = await listAttemptHistory(skip, limit, db);
    return NextResponse.json(history);
  } catch (err: any) {
    return NextResponse.json({ detail: err.message }, { status: 500 });
  }
}
