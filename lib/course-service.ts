import { eq, and, sql } from 'drizzle-orm';
import { courses, quizzes, quizAttempts, appSettings } from '@/db/schema';
import {
  DEFAULT_COURSE_TITLE,
  DEFAULT_COURSE_DESC,
  DEFAULT_DRIVE_FOLDER_ID,
  DEFAULT_DRIVE_URL,
  DEFAULT_COURSE_BANNER,
  GRAMMAR_UNITS_MANIFEST,
} from './course-manifest';
import { calculateContentHash } from './hash';
import { listDriveFolderFiles, fetchDriveFileContent } from './gdrive-service';
import { importQuizData } from './importer';
import type { drizzle } from 'drizzle-orm/d1';

type DbInstance = ReturnType<typeof drizzle>;

export async function ensureDefaultCourseExists(db: DbInstance) {
  // Check if initial course seeding has already occurred
  try {
    const setting = await db
      .select()
      .from(appSettings)
      .where(eq(appSettings.key, 'has_seeded_initial_course'))
      .get();
    if (setting) {
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
      userId: null,
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

export interface DriveSyncOptions {
  batchSize?: number;
  offset?: number;
  forceRefresh?: boolean;
}

export interface DriveFileReport {
  fileId: string;
  filename: string;
  status: 'synced' | 'skipped' | 'failed' | 'updated';
  error?: string;
}

export interface DriveSyncResult {
  totalFiles: number;
  processedCount: number;
  syncedCount: number;
  skippedCount: number;
  failedCount: number;
  hasMore: boolean;
  nextOffset: number | null;
  fileReports: DriveFileReport[];
}

export async function syncCourseDriveQuizzes(
  courseId: string,
  db: DbInstance,
  options?: DriveSyncOptions
): Promise<DriveSyncResult> {
  const course = await db.select().from(courses).where(eq(courses.id, courseId)).get();
  if (!course) {
    return {
      totalFiles: 0,
      processedCount: 0,
      syncedCount: 0,
      skippedCount: 0,
      failedCount: 0,
      hasMore: false,
      nextOffset: null,
      fileReports: [],
    };
  }

  const existingCourseQuizzes = await db
    .select()
    .from(quizzes)
    .where(eq(quizzes.courseId, courseId))
    .all();

  const quizByDriveId = new Map<string, (typeof existingCourseQuizzes)[0]>();
  const quizByUnitNum = new Map<number, (typeof existingCourseQuizzes)[0]>();
  const quizByFilename = new Map<string, (typeof existingCourseQuizzes)[0]>();

  for (const q of existingCourseQuizzes) {
    if (q.driveFileId) quizByDriveId.set(q.driveFileId, q);
    if (q.unitNumber !== null) quizByUnitNum.set(q.unitNumber, q);
    if (q.sourceFilename) quizByFilename.set(q.sourceFilename, q);
  }

  const fileReports: DriveFileReport[] = [];
  let syncedCount = 0;
  let skippedCount = 0;
  let failedCount = 0;

  // 1. If Google Drive folder is configured, attempt dynamic listing via drive.files.list
  let driveFiles: Array<{ id: string; name: string; mimeType?: string }> = [];
  if (course.driveFolderId) {
    driveFiles = await listDriveFolderFiles(course.driveFolderId, {
      forceRefresh: options?.forceRefresh,
    });
  }

  if (driveFiles.length > 0) {
    const totalFiles = driveFiles.length;
    const offset = Math.max(0, options?.offset || 0);
    const batchSize =
      options?.batchSize && options.batchSize > 0 ? options.batchSize : totalFiles;
    const batchSlice = driveFiles.slice(offset, offset + batchSize);
    const hasMore = offset + batchSize < totalFiles;
    const nextOffset = hasMore ? offset + batchSize : null;

    // Dynamic import & synchronization per file in the batch
    for (const file of batchSlice) {
      const filename = file.name;
      const driveFileId = file.id;

      // Parse unit number if present in filename
      const unitMatch = filename.match(/(?:unit|grammar_unit)[_\s-]*0*(\d+)/i);
      const unitNum = unitMatch ? parseInt(unitMatch[1], 10) : null;

      const existing =
        quizByDriveId.get(driveFileId) ||
        (unitNum !== null ? quizByUnitNum.get(unitNum) : null) ||
        quizByFilename.get(filename);

      if (existing) {
        let needsUpdate = false;
        const updateData: Record<string, any> = {};

        if (!existing.driveFileId && driveFileId) {
          updateData.driveFileId = driveFileId;
          needsUpdate = true;
        }
        if (!existing.sourceFilename && filename) {
          updateData.sourceFilename = filename;
          needsUpdate = true;
        }

        if (needsUpdate) {
          await db.update(quizzes).set(updateData).where(eq(quizzes.id, existing.id));
        }

        // If existing quiz is still pending, attempt to fetch content from Drive
        if (existing.status === 'pending_import' || existing.questionCount === 0) {
          try {
            const content = await fetchDriveFileContent(driveFileId);
            if (content) {
              await importQuizData(content, db, {
                overwrite: true,
                courseId,
                driveFileId,
                sourceFilename: filename,
              });
              syncedCount++;
              fileReports.push({ fileId: driveFileId, filename, status: 'synced' });
            } else {
              skippedCount++;
              fileReports.push({
                fileId: driveFileId,
                filename,
                status: 'skipped',
                error: 'Empty file content',
              });
            }
          } catch (err: any) {
            failedCount++;
            fileReports.push({
              fileId: driveFileId,
              filename,
              status: 'failed',
              error: err?.message || 'Failed to parse or import file',
            });
          }
        } else {
          skippedCount++;
          fileReports.push({ fileId: driveFileId, filename, status: 'skipped' });
        }
        continue;
      }

      // Try downloading and importing directly if new quiz
      let importedSuccessfully = false;
      try {
        const content = await fetchDriveFileContent(driveFileId);
        if (content) {
          await importQuizData(content, db, {
            overwrite: false,
            courseId,
            driveFileId,
            sourceFilename: filename,
          });
          importedSuccessfully = true;
          syncedCount++;
          fileReports.push({ fileId: driveFileId, filename, status: 'synced' });
        }
      } catch (err: any) {
        console.warn(`File ${filename} corrupt or failed import:`, err?.message);
        failedCount++;
        fileReports.push({
          fileId: driveFileId,
          filename,
          status: 'failed',
          error: err?.message || 'Import failed',
        });
      }

      if (!importedSuccessfully) {
        // Fallback: create pending placeholder quiz
        try {
          const cleanName = filename.replace(/\.json$/i, '').replace(/[_-]+/g, ' ');
          const unitTitle =
            unitNum !== null
              ? `Unit ${String(unitNum).padStart(2, '0')}: ${cleanName}`
              : cleanName;
          const placeholderHash = await calculateContentHash(
            `course_${courseId}_file_${driveFileId}_${filename}`
          );
          const nowIso = new Date().toISOString();

          await db.insert(quizzes).values({
            id: crypto.randomUUID(),
            courseId,
            contentHash: placeholderHash,
            schemaVersion: '2.0.0',
            quizType: 'multi_blank_fill_in_the_blank',
            language: 'en',
            title: unitTitle,
            unitNumber: unitNum,
            unitTitle: cleanName,
            instructions:
              'Fill in every numbered blank. Answers are tied to their numbered placeholders.',
            placeholderSyntax: '{{n}}',
            gradingConfig: {
              mode: 'per_blank',
              questionCompleteWhen: 'all_blanks_correct',
            },
            topics: unitNum ? [{ id: `unit_${unitNum}`, title: cleanName }] : null,
            questionCount: 0,
            blankCount: 0,
            status: 'pending_import',
            driveFileId,
            sourceFilename: filename,
            createdAt: nowIso,
          });
          syncedCount++;
          fileReports.push({ fileId: driveFileId, filename, status: 'updated' });
        } catch {}
      }
    }

    return {
      totalFiles,
      processedCount: batchSlice.length,
      syncedCount,
      skippedCount,
      failedCount,
      hasMore,
      nextOffset,
      fileReports,
    };
  }

  // 2. Fallback to static manifest for default grammar course if Drive is unreachable
  if (course.driveFolderId === DEFAULT_DRIVE_FOLDER_ID) {
    for (const item of GRAMMAR_UNITS_MANIFEST) {
      const unitNum = item.unit;
      const unitTitle = item.title;
      const filename = item.filename;
      const driveFileId = item.drive_file_id;

      if (quizByUnitNum.has(unitNum)) {
        const q = quizByUnitNum.get(unitNum)!;
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
        skippedCount++;
        fileReports.push({ fileId: driveFileId, filename, status: 'skipped' });
        continue;
      }

      // Create pending placeholder quiz
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

      syncedCount++;
      fileReports.push({ fileId: driveFileId, filename, status: 'synced' });
    }
  }

  return {
    totalFiles: fileReports.length,
    processedCount: fileReports.length,
    syncedCount,
    skippedCount,
    failedCount,
    hasMore: false,
    nextOffset: null,
    fileReports,
  };
}

export async function calculateCourseStats(
  courseId: string,
  db: DbInstance,
  userId?: string
) {
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
    const attemptsQuery = db
      .select({
        quizId: quizAttempts.quizId,
      })
      .from(quizAttempts)
      .where(
        userId && userId !== 'local-user'
          ? and(eq(quizAttempts.status, 'completed'), eq(quizAttempts.userId, userId))
          : eq(quizAttempts.status, 'completed')
      );

    const completedAttempts = await attemptsQuery.all();

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
