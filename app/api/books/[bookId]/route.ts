import { GET as getCourse, PATCH as patchCourse, DELETE as deleteCourse } from '@/app/api/courses/[courseId]/route';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ bookId: string }> }
) {
  const { bookId } = await params;
  return getCourse(request, { params: Promise.resolve({ courseId: bookId }) });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ bookId: string }> }
) {
  const { bookId } = await params;
  return patchCourse(request, { params: Promise.resolve({ courseId: bookId }) });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ bookId: string }> }
) {
  const { bookId } = await params;
  return deleteCourse(request, { params: Promise.resolve({ courseId: bookId }) });
}
