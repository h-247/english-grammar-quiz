import { eq, sql } from 'drizzle-orm';
import { courses, quizzes, quizAttempts } from '@/db/schema';
import {
  DEFAULT_COURSE_TITLE,
  DEFAULT_COURSE_DESC,
  DEFAULT_DRIVE_FOLDER_ID,
  DEFAULT_DRIVE_URL,
  DEFAULT_COURSE_BANNER,
  GRAMMAR_UNITS_MANIFEST,
} from './course-manifest';
import { calculateContentHash } from './hash';
import type { drizzle } from 'drizzle-orm/d1';

type DbInstance = ReturnType<typeof drizzle>;

export async function ensureDefaultCourseExists(db: DbInstance) {
  // Check if initial course seeding has already occurred
  try {
    const settingRows: any = await db.all(
      sql`SELECT value FROM app_settings WHERE key = 'has_seeded_initial_course'`
    );
    if (settingRows && settingRows.length > 0) {
      // Already seeded at least once. If courses table is empty, it means the user deleted courses; do not resurrect!
      const anyExisting = await db.select().from(courses).limit(1).get();
      return anyExisting || null;
    }
  } catch {}

  let defaultCourse = await db
    .select()
    .from(courses)
    .where(eq(courses.driveFolderId, DEFAULT_DRIVE_FOLDER_ID))
    .get();

  if (!defaultCourse) {
    const anyCourse = await db.select().from(courses).limit(1).get();
    defaultCourse = anyCourse;
  }

  if (!defaultCourse) {
    const courseId = crypto.randomUUID();
    const nowIso = new Date().toISOString();

    await db.insert(courses).values({
      id: courseId,
      title: DEFAULT_COURSE_TITLE,
      description: DEFAULT_COURSE_DESC,
      driveFolderId: DEFAULT_DRIVE_FOLDER_ID,
      driveFolderUrl: DEFAULT_DRIVE_URL,
      bannerUrl: DEFAULT_COURSE_BANNER,
      createdAt: nowIso,
      updatedAt: nowIso,
    });

    defaultCourse = (await db
      .select()
      .from(courses)
      .where(eq(courses.id, courseId))
      .get())!;

    await syncCourseDriveQuizzes(defaultCourse.id, db);
  }

  try {
    await db.run(
      sql`INSERT OR REPLACE INTO app_settings (key, value) VALUES ('has_seeded_initial_course', 'true')`
    );
  } catch {}

  return defaultCourse;
}

export async function syncCourseDriveQuizzes(courseId: string, db: DbInstance): Promise<number> {
  const existingCourseQuizzes = await db
    .select()
    .from(quizzes)
    .where(eq(quizzes.courseId, courseId))
    .all();

  const quizMap = new Map<number, (typeof existingCourseQuizzes)[0]>();
  for (const q of existingCourseQuizzes) {
    if (q.unitNumber !== null) {
      quizMap.set(q.unitNumber, q);
    }
  }

  let registeredCount = 0;

  for (const item of GRAMMAR_UNITS_MANIFEST) {
    const unitNum = item.unit;
    const unitTitle = item.title;
    const filename = item.filename;
    const driveFileId = item.drive_file_id;

    if (quizMap.has(unitNum)) {
      const q = quizMap.get(unitNum)!;
      let needsUpdate = false;
      const updateData: Record<string, any> = {};

      if (!q.driveFileId && driveFileId) {
        updateData.driveFileId = driveFileId;
        needsUpdate = true;
      }
      if (!q.sourceFilename && filename) {
        updateData.sourceFilename = filename;
        needsUpdate = true;
      }

      if (needsUpdate) {
        await db.update(quizzes).set(updateData).where(eq(quizzes.id, q.id));
      }
      registeredCount++;
      continue;
    }

    // Create pending placeholder quiz (all units start fresh, no pre-filled old quizzes)
    const placeholderHash = await calculateContentHash(
      `course_${courseId}_unit_${unitNum}_${filename}`
    );
    const nowIso = new Date().toISOString();

    await db.insert(quizzes).values({
      id: crypto.randomUUID(),
      courseId,
      contentHash: placeholderHash,
      schemaVersion: '2.0.0',
      quizType: 'multi_blank_fill_in_the_blank',
      language: 'en',
      title: `Unit ${String(unitNum).padStart(2, '0')}: ${unitTitle}`,
      unitNumber: unitNum,
      unitTitle,
      instructions:
        'Fill in every numbered blank. Answers are tied to their numbered placeholders.',
      placeholderSyntax: '{{n}}',
      gradingConfig: {
        mode: 'per_blank',
        questionCompleteWhen: 'all_blanks_correct',
      },
      topics: [{ id: `unit_${unitNum}`, title: unitTitle }],
      questionCount: 0,
      blankCount: 0,
      status: 'pending_import',
      driveFileId,
      sourceFilename: filename,
      createdAt: nowIso,
    });

    registeredCount++;
  }

  return registeredCount;
}

export async function calculateCourseStats(courseId: string, db: DbInstance) {
  const courseQuizzes = await db
    .select()
    .from(quizzes)
    .where(eq(quizzes.courseId, courseId))
    .all();

  const total = courseQuizzes.length;
  const ready = courseQuizzes.filter(
    (q) => q.status === 'ready' && q.questionCount > 0
  ).length;
  const pending = courseQuizzes.filter(
    (q) => q.status === 'pending_import' || q.questionCount === 0
  ).length;

  const quizIds = courseQuizzes.map((q) => q.id);
  let completed = 0;

  if (quizIds.length > 0) {
    const completedAttempts = await db
      .select({
        quizId: quizAttempts.quizId,
      })
      .from(quizAttempts)
      .where(eq(quizAttempts.status, 'completed'))
      .all();

    const completedQuizIdSet = new Set(
      completedAttempts
        .filter((a) => quizIds.includes(a.quizId))
        .map((a) => a.quizId)
    );
    completed = completedQuizIdSet.size;
  }

  return {
    total_quizzes: total,
    ready_quizzes: ready,
    pending_quizzes: pending,
    completed_quizzes: completed,
  };
}
