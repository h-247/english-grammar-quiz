import { NextResponse } from 'next/server';
import { getDb } from '@/db';
import { courses } from '@/db/schema';
import { ensureDatabaseInitialized } from '@/lib/db-init';
import {
  ensureDefaultCourseExists,
  calculateCourseStats,
  syncCourseDriveQuizzes,
} from '@/lib/course-service';
import {
  extractDriveFolderId,
  DEFAULT_COURSE_BANNER,
  DEFAULT_COURSE_TITLE,
} from '@/lib/course-manifest';
import { fetchDriveFolderMetadata } from '@/lib/gdrive-service';
import { CourseCreateSchema } from '@/lib/validation';
import { asc, eq } from 'drizzle-orm';

export async function GET() {
  try {
    await ensureDatabaseInitialized();
    const db = getDb();
    await ensureDefaultCourseExists(db);

    const allCourses = await db
      .select()
      .from(courses)
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

    // 1. Resolve course title: if Google Drive link provided, prioritize actual Drive folder name
    let finalTitle = title ? title.trim() : '';
    if (folderId) {
      const driveMeta = await fetchDriveFolderMetadata(folderId);
      if (driveMeta?.name) {
        if (!finalTitle || finalTitle === 'd' || finalTitle === DEFAULT_COURSE_TITLE) {
          finalTitle = driveMeta.name;
        }
      }
    }
    if (!finalTitle) {
      finalTitle = folderId ? `Course (${folderId.slice(0, 8)})` : DEFAULT_COURSE_TITLE;
    }

    // 2. Check if a course already exists by Google Drive Folder ID
    if (folderId) {
      const existingByFolder = await db
        .select()
        .from(courses)
        .where(eq(courses.driveFolderId, folderId))
        .get();

      if (existingByFolder) {
        return NextResponse.json(
          {
            detail: `Khóa học từ thư mục Google Drive này đã tồn tại trong thư viện: "${existingByFolder.title}". Không được thêm khóa học đã có trong repo.`,
            existing_course_id: existingByFolder.id,
          },
          { status: 409 }
        );
      }
    }

    // 3. Check if a course already exists by Title
    const existingByTitle = await db
      .select()
      .from(courses)
      .where(eq(courses.title, finalTitle))
      .get();

    if (existingByTitle) {
      return NextResponse.json(
        {
          detail: `Khóa học với tiêu đề "${finalTitle}" đã tồn tại trong thư viện. Không được thêm khóa học đã có trong repo.`,
          existing_course_id: existingByTitle.id,
        },
        { status: 409 }
      );
    }

    // 4. Create a clean fresh course (never resurrect old modified/pasted quizzes)
    const courseId = crypto.randomUUID();
    const nowIso = new Date().toISOString();

    await db.insert(courses).values({
      id: courseId,
      title: finalTitle,
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
        title: finalTitle,
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
