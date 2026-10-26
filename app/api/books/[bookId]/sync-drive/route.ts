import { POST as syncCourseDrive } from '@/app/api/courses/[courseId]/sync-drive/route';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ bookId: string }> }
) {
  const { bookId } = await params;
  return syncCourseDrive(request, { params: Promise.resolve({ courseId: bookId }) });
}
