import { NextResponse } from 'next/server';
import { getDb } from '@/db';
import { courses } from '@/db/schema';
import { ensureDatabaseInitialized } from '@/lib/db-init';
import {
  ensureDefaultCourseExists,
  calculateCourseStats,
  syncCourseDriveQuizzes,
} from '@/lib/course-service';
import { extractDriveFolderId, DEFAULT_COURSE_BANNER } from '@/lib/course-manifest';
import { CourseCreateSchema } from '@/lib/validation';
import { asc, eq, and, isNull, isNotNull } from 'drizzle-orm';

export async function GET() {
  try {
    await ensureDatabaseInitialized();
    const db = getDb();
    await ensureDefaultCourseExists(db);

    const allCourses = await db
      .select()
      .from(courses)
      .where(isNull(courses.deletedAt))
      .orderBy(asc(courses.createdAt))
      .all();

    const response = [];
    for (const c of allCourses) {
      const stats = await calculateCourseStats(c.id, db);
      response.push({
        id: c.id,
        title: c.title,
        description: c.description,
        drive_folder_id: c.driveFolderId,
        drive_folder_url: c.driveFolderUrl,
        banner_url:
          c.bannerUrl && c.bannerUrl.startsWith('http')
            ? c.bannerUrl
            : DEFAULT_COURSE_BANNER,
        total_quizzes: stats.total_quizzes,
        ready_quizzes: stats.ready_quizzes,
        pending_quizzes: stats.pending_quizzes,
        completed_quizzes: stats.completed_quizzes,
        created_at: c.createdAt,
        updated_at: c.updatedAt,
      });
    }

    return NextResponse.json(response);
  } catch (err: any) {
    return NextResponse.json({ detail: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await ensureDatabaseInitialized();
    const db = getDb();

    const body = await request.json();
    const parsed = CourseCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { detail: parsed.error.issues.map((i) => i.message).join('; ') },
        { status: 422 }
      );
    }

    const { title, description, drive_folder_id, drive_folder_url, banner_url } = parsed.data;
    
    // Automatically extract folder ID from URL or raw ID
    const rawDrive = drive_folder_url || drive_folder_id || '';
    const folderId = rawDrive ? extractDriveFolderId(rawDrive) : null;
    const folderUrl =
      drive_folder_url ||
      (folderId ? `https://drive.google.com/drive/folders/${folderId}` : null);
    const banner = banner_url || DEFAULT_COURSE_BANNER;

    // 1. Check if an ACTIVE course already exists by Google Drive Folder ID
    if (folderId) {
      const activeByFolder = await db
        .select()
        .from(courses)
        .where(and(eq(courses.driveFolderId, folderId), isNull(courses.deletedAt)))
        .get();

      if (activeByFolder) {
        return NextResponse.json(
          {
            detail: `Khóa học từ thư mục Google Drive này đã tồn tại trong thư viện: "${activeByFolder.title}". Không được thêm khóa học đã có trong repo.`,
            existing_course_id: activeByFolder.id,
          },
          { status: 409 }
        );
      }
    }

    // 2. Check if an ACTIVE course already exists by Title
    const trimmedTitle = title.trim();
    const activeByTitle = await db
      .select()
      .from(courses)
      .where(and(eq(courses.title, trimmedTitle), isNull(courses.deletedAt)))
      .get();

    if (activeByTitle) {
      return NextResponse.json(
        {
          detail: `Khóa học với tiêu đề "${trimmedTitle}" đã tồn tại trong thư viện. Không được thêm khóa học đã có trong repo.`,
          existing_course_id: activeByTitle.id,
        },
        { status: 409 }
      );
    }

    // 3. Check if this course was previously added and deleted -> RESTORE IT with all previous quizzes ("có sẵn bài cũ")
    let existingDeleted: any = null;
    if (folderId) {
      existingDeleted = await db
        .select()
        .from(courses)
        .where(and(eq(courses.driveFolderId, folderId), isNotNull(courses.deletedAt)))
        .get();
    }
    if (!existingDeleted) {
      existingDeleted = await db
        .select()
        .from(courses)
        .where(and(eq(courses.title, trimmedTitle), isNotNull(courses.deletedAt)))
        .get();
    }

    if (existingDeleted) {
      const nowIso = new Date().toISOString();
      await db
        .update(courses)
        .set({
          deletedAt: null,
          title: trimmedTitle || existingDeleted.title,
          description: description || existingDeleted.description,
          bannerUrl: banner,
          updatedAt: nowIso,
        })
        .where(eq(courses.id, existingDeleted.id));

      await syncCourseDriveQuizzes(existingDeleted.id, db);
      const stats = await calculateCourseStats(existingDeleted.id, db);

      return NextResponse.json({
        id: existingDeleted.id,
        title: trimmedTitle || existingDeleted.title,
        description: description || existingDeleted.description,
        drive_folder_id: existingDeleted.driveFolderId,
        drive_folder_url: existingDeleted.driveFolderUrl,
        banner_url: banner,
        total_quizzes: stats.total_quizzes,
        ready_quizzes: stats.ready_quizzes,
        pending_quizzes: stats.pending_quizzes,
        completed_quizzes: stats.completed_quizzes,
        created_at: existingDeleted.createdAt,
        updated_at: nowIso,
        restored: true,
      });
    }

    const courseId = crypto.randomUUID();
    const nowIso = new Date().toISOString();

    await db.insert(courses).values({
      id: courseId,
      title,
      description: description || null,
      driveFolderId: folderId,
      driveFolderUrl: folderUrl,
      bannerUrl: banner,
      createdAt: nowIso,
      updatedAt: nowIso,
    });

    if (folderId) {
      await syncCourseDriveQuizzes(courseId, db);
    }

    const stats = await calculateCourseStats(courseId, db);
    return NextResponse.json(
      {
        id: courseId,
        title,
        description: description || null,
        drive_folder_id: folderId,
        drive_folder_url: folderUrl,
        banner_url: banner,
        total_quizzes: stats.total_quizzes,
        ready_quizzes: stats.ready_quizzes,
        pending_quizzes: stats.pending_quizzes,
        completed_quizzes: stats.completed_quizzes,
        created_at: nowIso,
        updated_at: nowIso,
      },
      { status: 201 }
    );
  } catch (err: any) {
    return NextResponse.json({ detail: err.message }, { status: 500 });
  }
}
