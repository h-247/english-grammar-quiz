import { NextResponse } from 'next/server';
import { getDb } from '@/db';
import { ensureDatabaseInitialized } from '@/lib/db-init';
import { getUserTopicMastery } from '@/lib/attempt-service';
import { getAuthenticatedUserOrLocal } from '@/app/chatgpt-auth';

export async function GET() {
  try {
    await ensureDatabaseInitialized();
    const db = getDb();
    const user = await getAuthenticatedUserOrLocal();

    const mastery = await getUserTopicMastery(db, user.userId);
    return NextResponse.json(mastery);
  } catch (err: any) {
    return NextResponse.json(
      { detail: err.message || 'Failed to fetch topic mastery.' },
      { status: 500 }
    );
  }
}
