import { NextResponse } from 'next/server';
import { getDb } from '@/db';
import { ensureDatabaseInitialized } from '@/lib/db-init';
import { checkQuestionAnswers } from '@/lib/attempt-service';
import { CheckQuestionSchema } from '@/lib/validation';
import { getAuthenticatedUserOrLocal } from '@/app/chatgpt-auth';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ attemptId: string }> }
) {
  try {
    await ensureDatabaseInitialized();
    const db = getDb();
    const user = await getAuthenticatedUserOrLocal();
    const { attemptId } = await params;

    const body = await request.json();
    const parsed = CheckQuestionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { detail: parsed.error.issues.map((i) => i.message).join('; ') },
        { status: 422 }
      );
    }

    const { question_id, answers } = parsed.data;
    const feedback = await checkQuestionAnswers(
      attemptId,
      question_id,
      answers,
      db,
      user.userId
    );

    return NextResponse.json(feedback);
  } catch (err: any) {
    const isNotFound = err.message?.includes('not found');
    return NextResponse.json(
      { detail: err.message },
      { status: isNotFound ? 404 : 500 }
    );
  }
}
