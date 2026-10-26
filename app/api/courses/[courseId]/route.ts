import { NextResponse } from 'next/server';
import { getDb } from '@/db';
import {
  courses,
  quizzes,
  questions,
  blanks,
  quizAttempts,
  userResponses,
  attemptResults,
} from '@/db/schema';
import { ensureDatabaseInitialized } from '@/lib/db-init';
import { calculateCourseStats } from '@/lib/course-service';
import { DEFAULT_COURSE_BANNER } from '@/lib/course-manifest';
import { eq, asc, inArray } from 'drizzle-orm';
import { getAuthenticatedUserOrLocal } from '@/app/chatgpt-auth';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ courseId: string }> }
) {
  try {
    await ensureDatabaseInitialized();
    const db = getDb();
    const user = await getAuthenticatedUserOrLocal();
    const { courseId } = await params;

    const course = await db
      .select()
      .from(courses)
      .where(eq(courses.id, courseId))
      .get();

    if (!course) {
      return NextResponse.json(
        { detail: `Book with ID ${courseId} not found.` },
        { status: 404 }
      );
    }

    if (
      user.userId !== 'local-user' &&
      course.userId &&
      course.userId !== user.userId
    ) {
      return NextResponse.json(
        { detail: `Book with ID ${courseId} not found.` },
        { status: 404 }
      );
    }

    const stats = await calculateCourseStats(courseId, db, user.userId);
    const courseQuizzes = await db
      .select()
      .from(quizzes)
      .where(eq(quizzes.courseId, courseId))
      .orderBy(asc(quizzes.unitNumber))
      .all();

    const quizSummaries = courseQuizzes.map((q) => {
      // Normalize status to 'To do' | 'Doing' | 'Done' if needed
      let displayStatus = q.status;
      if (displayStatus === 'ready' || displayStatus === 'pending_import' || !displayStatus) {
        displayStatus = 'To do';
      }

      return {
        id: q.id,
        title: q.title,
        unit_number: q.unitNumber,
        unit_title: q.unitTitle,
        instructions: q.instructions,
        placeholder_syntax: q.placeholderSyntax,
        question_count: q.questionCount,
        blank_count: q.blankCount,
        topics: (q.topics as any) || [],
        course_id: q.courseId,
        course_title: course.title,
        book_id: q.courseId,
        book_title: course.title,
        drive_file_id: q.driveFileId,
        source_filename: q.sourceFilename,
        chatgpt_url: q.chatgptUrl || null,
        status: displayStatus,
        reading_status: q.readingStatus || displayStatus,
        start_page: q.startPage,
        end_page: q.endPage,
        created_at: q.createdAt,
      };
    });

    return NextResponse.json({
      id: course.id,
      title: course.title,
      description: course.description,
      author: course.author,
      goodreads_url: course.goodreadsUrl,
      cover_url: course.coverUrl || course.bannerUrl,
      rating: course.rating,
      rating_count: course.ratingCount,
      page_count: course.pageCount,
      isbn: course.isbn,
      published_year: course.publishedYear,
      genres: course.genres,
      drive_folder_id: course.driveFolderId,
      drive_folder_url: course.driveFolderUrl,
      banner_url:
        course.bannerUrl && course.bannerUrl.startsWith('http')
          ? course.bannerUrl
          : course.coverUrl || DEFAULT_COURSE_BANNER,
      total_chapters: stats.total_chapters,
      todo_chapters: stats.todo_chapters,
      doing_chapters: stats.doing_chapters,
      done_chapters: stats.done_chapters,
      status:
        stats.total_chapters > 0 && stats.done_chapters >= stats.total_chapters
          ? 'Done'
          : stats.done_chapters > 0 || stats.doing_chapters > 0
          ? 'Doing'
          : 'To do',
      total_quizzes: stats.total_quizzes,
      ready_quizzes: stats.ready_quizzes,
      pending_quizzes: stats.pending_quizzes,
      completed_quizzes: stats.completed_quizzes,
      created_at: course.createdAt,
      updated_at: course.updatedAt,
      quizzes: quizSummaries,
      chapters: quizSummaries,
    });
  } catch (err: any) {
    return NextResponse.json({ detail: err.message }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ courseId: string }> }
) {
  try {
    await ensureDatabaseInitialized();
    const db = getDb();
    const user = await getAuthenticatedUserOrLocal();
    const { courseId } = await params;

    const course = await db
      .select()
      .from(courses)
      .where(eq(courses.id, courseId))
      .get();

    if (!course) {
      return NextResponse.json(
        { detail: `Book with ID ${courseId} not found.` },
        { status: 404 }
      );
    }

    if (
      user.userId !== 'local-user' &&
      course.userId &&
      course.userId !== user.userId
    ) {
      return NextResponse.json(
        { detail: 'You do not have permission to delete this book.' },
        { status: 403 }
      );
    }

    // 1. Fetch all quiz/chapter IDs belonging to this book
    const courseQuizzes = await db
      .select({ id: quizzes.id })
      .from(quizzes)
      .where(eq(quizzes.courseId, courseId))
      .all();

    const quizIds = courseQuizzes.map((q) => q.id);

    if (quizIds.length > 0) {
      const attempts = await db
        .select({ id: quizAttempts.id })
        .from(quizAttempts)
        .where(inArray(quizAttempts.quizId, quizIds))
        .all();

      if (attempts.length > 0) {
        const attemptIds = attempts.map((a) => a.id);
        for (let i = 0; i < attemptIds.length; i += IN_ARRAY_CHUNK_SIZE) {
          const chunk = attemptIds.slice(i, i + IN_ARRAY_CHUNK_SIZE);
          await db.delete(attemptResults).where(inArray(attemptResults.attemptId, chunk));
          await db.delete(userResponses).where(inArray(userResponses.attemptId, chunk));
          await db.delete(quizAttempts).where(inArray(quizAttempts.id, chunk));
        }
      }

      const quizQuestions = await db
        .select({ id: questions.id })
        .from(questions)
        .where(inArray(questions.quizId, quizIds))
        .all();

      if (quizQuestions.length > 0) {
        const qIds = quizQuestions.map((q) => q.id);
        for (let i = 0; i < qIds.length; i += IN_ARRAY_CHUNK_SIZE) {
          const chunk = qIds.slice(i, i + IN_ARRAY_CHUNK_SIZE);
          await db.delete(blanks).where(inArray(blanks.questionId, chunk));
          await db.delete(questions).where(inArray(questions.id, chunk));
        }
      }

      await db.delete(quizzes).where(inArray(quizzes.id, quizIds));
    }

    // 2. Delete the course / book itself
    await db.delete(courses).where(eq(courses.id, courseId));

    return NextResponse.json({
      message: `Book '${course.title}' and all its chapters were permanently deleted.`,
      course_id: courseId,
      book_id: courseId,
    });
  } catch (err: any) {
    return NextResponse.json({ detail: err.message }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ courseId: string }> }
) {
  try {
    await ensureDatabaseInitialized();
    const db = getDb();
    const user = await getAuthenticatedUserOrLocal();
    const { courseId } = await params;

    const course = await db
      .select()
      .from(courses)
      .where(eq(courses.id, courseId))
      .get();

    if (!course) {
      return NextResponse.json(
        { detail: `Book with ID ${courseId} not found.` },
        { status: 404 }
      );
    }

    if (
      user.userId !== 'local-user' &&
      course.userId &&
      course.userId !== user.userId
    ) {
      return NextResponse.json(
        { detail: 'You do not have permission to modify this book.' },
        { status: 403 }
      );
    }

    const body = (await request.json()) as Record<string, any>;
    const trimmedTitle =
      typeof body.title === 'string' ? body.title.trim() : undefined;

    if (trimmedTitle !== undefined && trimmedTitle.length === 0) {
      return NextResponse.json(
        { detail: 'Book title cannot be empty.' },
        { status: 422 }
      );
    }

    const nowIso = new Date().toISOString();
    const updateData: Record<string, any> = { updatedAt: nowIso };

    if (trimmedTitle !== undefined) {
      updateData.title = trimmedTitle;
    }
    if (body.description !== undefined) {
      updateData.description = body.description ? String(body.description).trim() : null;
    }
    if (body.author !== undefined) {
      updateData.author = body.author ? String(body.author).trim() : null;
    }
    if (body.goodreads_url !== undefined) {
      updateData.goodreadsUrl = body.goodreads_url ? String(body.goodreads_url).trim() : null;
    }
    if (body.cover_url !== undefined) {
      updateData.coverUrl = body.cover_url ? String(body.cover_url).trim() : null;
      updateData.bannerUrl = updateData.coverUrl;
    }
    if (body.banner_url !== undefined && body.banner_url) {
      updateData.bannerUrl = String(body.banner_url);
    }
    if (body.rating !== undefined) {
      updateData.rating = body.rating != null ? Number(body.rating) : null;
    }
    if (body.page_count !== undefined) {
      updateData.pageCount = body.page_count != null ? Number(body.page_count) : null;
    }

    await db.update(courses).set(updateData).where(eq(courses.id, courseId));

    const updated = await db
      .select()
      .from(courses)
      .where(eq(courses.id, courseId))
      .get();

    const stats = await calculateCourseStats(courseId, db, user.userId);

    return NextResponse.json({
      id: updated!.id,
      title: updated!.title,
      description: updated!.description,
      author: updated!.author,
      goodreads_url: updated!.goodreadsUrl,
      cover_url: updated!.coverUrl || updated!.bannerUrl,
      rating: updated!.rating,
      page_count: updated!.pageCount,
      drive_folder_id: updated!.driveFolderId,
      drive_folder_url: updated!.driveFolderUrl,
      banner_url:
        updated!.bannerUrl && updated!.bannerUrl.startsWith('http')
          ? updated!.bannerUrl
          : updated!.coverUrl || DEFAULT_COURSE_BANNER,
      total_chapters: stats.total_chapters,
      todo_chapters: stats.todo_chapters,
      doing_chapters: stats.doing_chapters,
      done_chapters: stats.done_chapters,
      status:
        stats.total_chapters > 0 && stats.done_chapters >= stats.total_chapters
          ? 'Done'
          : stats.done_chapters > 0 || stats.doing_chapters > 0
          ? 'Doing'
          : 'To do',
      total_quizzes: stats.total_quizzes,
      ready_quizzes: stats.ready_quizzes,
      pending_quizzes: stats.pending_quizzes,
      completed_quizzes: stats.completed_quizzes,
      created_at: updated!.createdAt,
      updated_at: updated!.updatedAt,
    });
  } catch (err: any) {
    return NextResponse.json({ detail: err.message }, { status: 500 });
  }
}
