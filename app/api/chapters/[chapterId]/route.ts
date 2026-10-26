import { GET as getQuiz, PATCH as patchQuiz, DELETE as deleteQuiz } from '@/app/api/quizzes/[quizId]/route';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ chapterId: string }> }
) {
  const { chapterId } = await params;
  return getQuiz(request, { params: Promise.resolve({ quizId: chapterId }) });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ chapterId: string }> }
) {
  const { chapterId } = await params;
  return patchQuiz(request, { params: Promise.resolve({ quizId: chapterId }) });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ chapterId: string }> }
) {
  const { chapterId } = await params;
  return deleteQuiz(request, { params: Promise.resolve({ quizId: chapterId }) });
}
