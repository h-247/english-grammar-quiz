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
import { asc, eq, or, isNull, and } from 'drizzle-orm';
import { getAuthenticatedUserOrLocal } from '@/app/chatgpt-auth';

export async function GET() {
  try {
    await ensureDatabaseInitialized();
    const db = getDb();
    const user = await getAuthenticatedUserOrLocal();
    await ensureDefaultCourseExists(db);

    const isLocal = user.userId === 'local-user';
    const query = db.select().from(courses);
    const accessibleCoursesQuery = isLocal
      ? query
      : query.where(or(eq(courses.userId, user.userId), isNull(courses.userId)));

    const allCourses = await accessibleCoursesQuery
      .orderBy(asc(courses.createdAt))
      .all();

    const response = await Promise.all(
      allCourses.map(async (c) => {
        const stats = await calculateCourseStats(c.id, db, user.userId);
        return {
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
        };
      })
    );

    return NextResponse.json(response);
  } catch (err: any) {
    return NextResponse.json({ detail: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await ensureDatabaseInitialized();
    const db = getDb();
    const user = await getAuthenticatedUserOrLocal();

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

    const userScope =
      user.userId === 'local-user'
        ? undefined
        : or(eq(courses.userId, user.userId), isNull(courses.userId));

    // 2. Check if a course already exists by Google Drive Folder ID for this user
    if (folderId) {
      const folderFilter = userScope
        ? and(eq(courses.driveFolderId, folderId), userScope)
        : eq(courses.driveFolderId, folderId);

      const existingByFolder = await db
        .select()
        .from(courses)
        .where(folderFilter)
        .get();

      if (existingByFolder) {
        return NextResponse.json(
          {
            detail: `A course from this Google Drive folder already exists in the library: "${existingByFolder.title}". Duplicate courses cannot be added.`,
            existing_course_id: existingByFolder.id,
          },
          { status: 409 }
        );
      }
    }

    // 3. Check if a course already exists by Title for this user
    const titleFilter = userScope
      ? and(eq(courses.title, finalTitle), userScope)
      : eq(courses.title, finalTitle);

    const existingByTitle = await db
      .select()
      .from(courses)
      .where(titleFilter)
      .get();

    if (existingByTitle) {
      return NextResponse.json(
        {
          detail: `A course with the title "${finalTitle}" already exists in the library. Duplicate courses cannot be added.`,
          existing_course_id: existingByTitle.id,
        },
        { status: 409 }
      );
    }

    // 4. Create a clean fresh course scoped to current user
    const courseId = crypto.randomUUID();
    const nowIso = new Date().toISOString();

    await db.insert(courses).values({
      id: courseId,
      title: finalTitle,
      description: description || null,
      driveFolderId: folderId,
      driveFolderUrl: folderUrl,
      bannerUrl: banner,
      userId: user.userId,
      createdAt: nowIso,
      updatedAt: nowIso,
    });

    if (folderId) {
      await syncCourseDriveQuizzes(courseId, db);
    }

    const stats = await calculateCourseStats(courseId, db, user.userId);
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
