import { eq, sql } from 'drizzle-orm';
import { courses, quizzes, appSettings } from '@/db/schema';
import {
  DEFAULT_COURSE_TITLE,
  DEFAULT_COURSE_DESC,
  DEFAULT_DRIVE_FOLDER_ID,
  DEFAULT_DRIVE_URL,
  DEFAULT_COURSE_BANNER,
  GRAMMAR_UNITS_MANIFEST,
  SAMPLE_BOOK_DRIVE_FOLDER_ID,
  DEFINING_DECADE_DRIVE_FOLDER_ID,
} from './course-manifest';
import { calculateContentHash } from './hash';
import { listDriveFolderFiles, fetchDriveFileContent } from './gdrive-service';
import { importQuizData } from './importer';
import type { drizzle } from 'drizzle-orm/d1';

type DbInstance = ReturnType<typeof drizzle>;

export const SAMPLE_BOOK_MANIFEST = [
  { unit: 0, title: 'Front matter (includes Prologue)', filename: '00_front_p001-p022.pdf', start_page: 1, end_page: 22, drive_file_id: '1fItm7A21E4dux8QHujUkB3lssFsFsXZJ' },
  { unit: 1, title: 'Chapter 1 - Chicago', filename: '01_ch01_chicago_p023-p039.pdf', start_page: 23, end_page: 39, drive_file_id: '19cgbe62X7SvZiVpUyOH-tiWLGZiVGREh' },
  { unit: 2, title: 'Chapter 2 - St. Louis', filename: '02_ch02_st-louis_p040-p053.pdf', start_page: 40, end_page: 53, drive_file_id: '1EdzD-8cRcURSFrtOtWmbJyUuNexeZq0z' },
  { unit: 3, title: 'Chapter 3 - Where Are You?', filename: '03_ch03_where-are-you_p054-p064.pdf', start_page: 54, end_page: 64, drive_file_id: '1cFPOb0lEsthlB25hdVDaVtujBj0DoI_O' },
  { unit: 4, title: 'Chapter 4 - Among the “Nerd’s Nerds”', filename: '04_ch04_among-the-nerds-nerds_p065-p080.pdf', start_page: 65, end_page: 80, drive_file_id: '1DkKyk23_5CXKHaNng7MGFzVRddKjpOU4' },
  { unit: 5, title: 'Chapter 5 - Stopping Out', filename: '05_ch05_stopping-out_p081-p094.pdf', start_page: 81, end_page: 94, drive_file_id: '1DD6lgl8ZcKcni-OVUbAjQaguj5cUAJG5' },
  { unit: 6, title: 'Chapter 6 - Where You At?', filename: '06_ch06_where-you-at_p095-p104.pdf', start_page: 95, end_page: 104, drive_file_id: '17OArmOHGxu7c-K-JGqPmuUzs0zUqXHMw' },
  { unit: 7, title: 'Chapter 7 - From “Weak” to “Cool”', filename: '07_ch07_from-weak-to-cool_p105-p112.pdf', start_page: 105, end_page: 112, drive_file_id: '111a0c6zdlCK49WHC8BnhktvgnoIjzbLE' },
  { unit: 8, title: 'Chapter 8 - The Douchebag Badge', filename: '08_ch08_the-douchebag-badge_p113-p123.pdf', start_page: 113, end_page: 123, drive_file_id: '11Qt4vwuY5Krcgca_8FS6O5RtSfQIXGOF' },
  { unit: 9, title: 'Chapter 9 - A Ride on a Rocket', filename: '09_ch09_a-ride-on-a-rocket_p124-p141.pdf', start_page: 124, end_page: 141, drive_file_id: '1g_GQRHwlvtDoQa0ZQFGUUftQ18hM1kBI' },
  { unit: 10, title: 'Chapter 10 - Sam Altman for President', filename: '10_ch10_sam-altman-for-president_p142-p158.pdf', start_page: 142, end_page: 158, drive_file_id: '1r1FS5KbgGqUHUZIwERhf5GFtD6L94WRI' },
  { unit: 11, title: 'Chapter 11 - A Manhattan Project for AI', filename: '11_ch11_a-manhattan-project-for-ai_p159-p178.pdf', start_page: 159, end_page: 178, drive_file_id: '1SGXxbDH1Z6oke6F6PWNxfQGpRk2b5g5I' },
  { unit: 12, title: 'Chapter 12 - Altruists', filename: '12_ch12_altruists_p179-p202.pdf', start_page: 179, end_page: 202, drive_file_id: '12LbqHM2WhI_CES6rlAeARFHlz9hgPDbB' },
  { unit: 13, title: 'Chapter 13 - Pivoting to Profit', filename: '13_ch13_pivoting-to-profit_p203-p224.pdf', start_page: 203, end_page: 224, drive_file_id: '1xIDigO7kT86LCyZoyxWJ3D5KeorS2l0U' },
  { unit: 14, title: 'Chapter 14 - Products', filename: '14_ch14_products_p225-p237.pdf', start_page: 225, end_page: 237, drive_file_id: '1oIKP6rfYFUV13RR-H8slvSU0hU-VZIwm' },
  { unit: 15, title: 'Chapter 15 - ChatGPT', filename: '15_ch15_chatgpt_p238-p258.pdf', start_page: 238, end_page: 258, drive_file_id: '1jQCL-6HiFqXOq-Vvg36ywWvnfSHd2Qty' },
  { unit: 16, title: 'Chapter 16 - The Blip', filename: '16_ch16_the-blip_p259-p276.pdf', start_page: 259, end_page: 276, drive_file_id: '1bsHC5MgSUaBAFdGGwAZMFqaAdgFPlGZ4' },
  { unit: 17, title: 'Chapter 17 - Prometheus Unbound', filename: '17_ch17_prometheus-unbound_p277-p291.pdf', start_page: 277, end_page: 291, drive_file_id: '10qjsWmgDDZu0uG2FrycnhbGfPg7-nKir' },
  { unit: 99, title: 'Back matter', filename: '99_back_p292-p354.pdf', start_page: 292, end_page: 354, drive_file_id: '1HUJ84qEUnDUtva5jGoabMNCIh_l32bWI' },
];

export const DEFINING_DECADE_MANIFEST = [
  { unit: 0, title: 'Front', filename: '00_front_p001-p019.pdf', start_page: 1, end_page: 19, drive_file_id: '16wBSuS2DPmuSY7V0igEWXdYXmApGAtYC' },
  { unit: 1, title: 'WORK: Identity Capital', filename: '01_work_identity-capital_p020-p030.pdf', start_page: 20, end_page: 30, drive_file_id: '1ROQEi38bclpHyl59nBM7RZ4rsbKy5C1b' },
  { unit: 2, title: 'WORK: Weak Ties', filename: '02_work_weak-ties_p031-p042.pdf', start_page: 31, end_page: 42, drive_file_id: '1imHA-QIkNXv10Sr81Ax3UAbgxCpQaVmb' },
  { unit: 3, title: 'WORK: The Unthought Known', filename: '03_work_the-unthought-known_p043-p049.pdf', start_page: 43, end_page: 49, drive_file_id: '1UwbHkWFm3ZFI95f-jZr8WkNDCkwdgUes' },
  { unit: 4, title: 'WORK: My Life Should Look Better on Facebook', filename: '04_work_my-life-should-look-better-on-facebook_p050-p059.pdf', start_page: 50, end_page: 59, drive_file_id: '14fibhxypN0N0qqgWeH1tD-4zwL0E-6qp' },
  { unit: 5, title: 'WORK: The Customized Life', filename: '05_work_the-customized-life_p060-p067.pdf', start_page: 60, end_page: 67, drive_file_id: '1cbGwfW4T3MFKvkPsNIOApWzCRpdg27TA' },
  { unit: 6, title: 'LOVE: An Upmarket Conversation', filename: '06_love_an-upmarket-conversation_p068-p077.pdf', start_page: 68, end_page: 77, drive_file_id: '1l5qM7ldMyc2O1QaGmC2SXh6JV1KIvw_q' },
  { unit: 7, title: 'LOVE: Picking Your Family', filename: '07_love_picking-your-family_p078-p083.pdf', start_page: 78, end_page: 83, drive_file_id: '1LcbEQLArnPA_upEdXQ0Ca_3kgH1SUJZV' },
  { unit: 8, title: 'LOVE: The Cohabitation Effect', filename: '08_love_the-cohabitation-effect_p084-p092.pdf', start_page: 84, end_page: 92, drive_file_id: '1xcwiSQiQ_T0Ft6E1hlanS7rXVZhXqSon' },
  { unit: 9, title: 'LOVE: On Dating Down', filename: '09_love_on-dating-down_p093-p101.pdf', start_page: 93, end_page: 101, drive_file_id: '1l33UD2TJA8VyoYmX3IEr2E9inbpqdD5A' },
  { unit: 10, title: 'LOVE: Being in Like', filename: '10_love_being-in-like_p102-p115.pdf', start_page: 102, end_page: 115, drive_file_id: '1ghFWgTj_k_Ty2i_ucntBDzqiubiqdcx0' },
  { unit: 11, title: 'THE BRAIN AND THE BODY: Forward Thinking', filename: '11_the-brain-and-the-body_forward-thinking_p116-p123.pdf', start_page: 116, end_page: 123, drive_file_id: '1DVivWAPy7zKPezhfzk4jYS8m4hSGX4ay' },
  { unit: 12, title: 'THE BRAIN AND THE BODY: Calm Yourself', filename: '12_the-brain-and-the-body_calm-yourself_p124-p132.pdf', start_page: 124, end_page: 132, drive_file_id: '1qIg6T4lmQWIA15-2Ydo2UVnSv13Ea3SN' },
  { unit: 13, title: 'THE BRAIN AND THE BODY: Outside In', filename: '13_the-brain-and-the-body_outside-in_p133-p139.pdf', start_page: 133, end_page: 139, drive_file_id: '1Yip7oglyfYTSw7_T4QscH3G6GkZHfKNA' },
  { unit: 14, title: 'THE BRAIN AND THE BODY: Getting Along and Getting Ahead', filename: '14_the-brain-and-the-body_getting-along-and-getting-ahead_p140-p146.pdf', start_page: 140, end_page: 146, drive_file_id: '1ruqBdwNwICaJQ5wJGs62LxhjEO5F1KIp' },
  { unit: 15, title: 'THE BRAIN AND THE BODY: Every Body', filename: '15_the-brain-and-the-body_every-body_p147-p156.pdf', start_page: 147, end_page: 156, drive_file_id: '1E2rut2ThMX5L42RLb3_C14T7GIDSrdDl' },
  { unit: 16, title: 'THE BRAIN AND THE BODY: Do the Math', filename: '16_the-brain-and-the-body_do-the-math_p157-p164.pdf', start_page: 157, end_page: 164, drive_file_id: '1PSpc6tLYXniLNkEa6qb0AAEQ6psYQR98' },
  { unit: 17, title: 'EPILOGUE: Will Things Work Out for Me?', filename: '17_epilogue_will-things-work-out-for-me_p165-p167.pdf', start_page: 165, end_page: 167, drive_file_id: '1rJXlk7Qf_iDNBLI3QR_h8KKGyTjy8MqM' },
  { unit: 99, title: 'Back Matter', filename: '99_back_p168-p210.pdf', start_page: 168, end_page: 210, drive_file_id: '1OkxacISMDgcN7yF7-lgyNQ6oA0TIbguX' },
];

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"' || char === '“' || char === '”') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

export async function ensureDefaultCourseExists(db: DbInstance) {
  try {
    const setting = await db
      .select()
      .from(appSettings)
      .where(eq(appSettings.key, 'has_seeded_initial_course'))
      .get();
    if (setting) {
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
      author: 'English Grammar Specialist',
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

  const existingQuizzes = await db
    .select()
    .from(quizzes)
    .where(eq(quizzes.courseId, courseId))
    .all();

  const quizByDriveId = new Map<string, (typeof existingQuizzes)[0]>();
  const quizByUnitNum = new Map<number, (typeof existingQuizzes)[0]>();
  const quizByFilename = new Map<string, (typeof existingQuizzes)[0]>();

  for (let i = 0; i < existingQuizzes.length; i++) {
    const q = existingQuizzes[i];
    if (q.driveFileId) quizByDriveId.set(q.driveFileId, q);
    if (q.unitNumber !== null) quizByUnitNum.set(q.unitNumber, q);
    if (q.sourceFilename) quizByFilename.set(q.sourceFilename, q);
  }

  const fileReports: DriveFileReport[] = [];
  let syncedCount = 0;
  let skippedCount = 0;
  let failedCount = 0;

  // 1. Fetch dynamic folder files from Google Drive
  let driveFiles: Array<{ id: string; name: string; mimeType?: string }> = [];
  if (course.driveFolderId) {
    driveFiles = await listDriveFolderFiles(course.driveFolderId, {
      forceRefresh: options?.forceRefresh,
    });
  }

  // Check if manifest.csv or toc.json exists in the Drive folder
  const manifestFile = driveFiles.find((f) => f.name.toLowerCase() === 'manifest.csv');
  const tocFile = driveFiles.find((f) => f.name.toLowerCase() === 'toc.json');

  if (manifestFile) {
    // Strategy A: Parse manifest.csv to create book chapters
    try {
      const csvContent = await fetchDriveFileContent(manifestFile.id);
      if (csvContent) {
        const lines = csvContent.split(/\r?\n/).filter((l) => l.trim().length > 0);
        const headers = lines.length > 0 ? parseCsvLine(lines[0]).map((h) => h.toLowerCase().trim()) : [];
        const filenameIdx = headers.findIndex((h) => h.includes('filename') || h.includes('file'));
        const titleIdx = headers.findIndex((h) => h === 'title' || h.includes('title') || h.includes('chapter'));
        const partIdx = headers.findIndex((h) => h === 'part' || h.includes('section'));
        const startPageIdx = headers.findIndex((h) => h.includes('start') || h.includes('from'));
        const endPageIdx = headers.findIndex((h) => h.includes('end') || h.includes('to'));

        for (let i = 1; i < lines.length; i++) {
          const parts = parseCsvLine(lines[i]);
          if (parts.length < 3) continue;

          const filename = filenameIdx !== -1 && parts[filenameIdx] ? parts[filenameIdx] : parts[0];
          const part = partIdx !== -1 && parts[partIdx] ? parts[partIdx] : '';
          let rawTitle = titleIdx !== -1 && parts[titleIdx] ? parts[titleIdx] : (parts.length > 3 ? parts[3] : parts[2]);
          if (!rawTitle) rawTitle = filename;
          const title = part && !rawTitle.toLowerCase().includes(part.toLowerCase()) ? `${part}: ${rawTitle}` : rawTitle;

          const startRaw = startPageIdx !== -1 ? parts[startPageIdx] : (parts.length > 4 ? parts[4] : parts[3]);
          const endRaw = endPageIdx !== -1 ? parts[endPageIdx] : (parts.length > 5 ? parts[5] : parts[4]);
          const startPage = startRaw ? parseInt(startRaw, 10) : null;
          const endPage = endRaw ? parseInt(endRaw, 10) : null;

          const numMatch = filename.match(/^0*(\d+)/);
          const unitNum = numMatch ? parseInt(numMatch[1], 10) : i;

          const matchedFile = driveFiles.find((f) => {
            const fLower = f.name.toLowerCase();
            const fnLower = filename.toLowerCase();
            if (fLower === fnLower) return true;
            const unitPrefix = `${String(unitNum).padStart(2, '0')}_`;
            if (fLower.startsWith(unitPrefix) && (fnLower.startsWith(unitPrefix) || fnLower.startsWith(String(unitNum)))) {
              return true;
            }
            const baseShort = fLower.replace(/~.*\.pdf$/i, '');
            if (baseShort.length >= 4 && fnLower.startsWith(baseShort)) {
              return true;
            }
            return false;
          });
          const driveFileId = matchedFile?.id || null;

          const existing =
            (driveFileId ? quizByDriveId.get(driveFileId) : null) ||
            quizByFilename.get(filename) ||
            quizByUnitNum.get(unitNum);

          if (existing) {
            const updateSet: Record<string, any> = {
              title,
              unitTitle: title,
              sourceFilename: filename,
            };
            if (driveFileId) updateSet.driveFileId = driveFileId;
            if (startPage !== null) updateSet.startPage = startPage;
            if (endPage !== null) updateSet.endPage = endPage;
            if (!existing.status) updateSet.status = 'To do';

            await db.update(quizzes).set(updateSet).where(eq(quizzes.id, existing.id));
            syncedCount++;
            fileReports.push({
              fileId: driveFileId || existing.id,
              filename,
              status: 'updated',
            });
          } else {
            const chapterHash = await calculateContentHash(
              `book_${courseId}_chapter_${unitNum}_${filename}`
            );
            await db.insert(quizzes).values({
              id: crypto.randomUUID(),
              courseId,
              contentHash: chapterHash,
              title,
              unitNumber: unitNum,
              unitTitle: title,
              instructions:
                startPage && endPage
                  ? `Pages ${startPage} - ${endPage}`
                  : undefined,
              status: 'To do',
              readingStatus: 'To do',
              driveFileId,
              sourceFilename: filename,
              startPage,
              endPage,
              questionCount: 0,
              blankCount: 0,
              placeholderSyntax: '{{n}}',
              createdAt: new Date().toISOString(),
            });
            syncedCount++;
            fileReports.push({
              fileId: driveFileId || filename,
              filename,
              status: 'synced',
            });
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
    } catch (err: unknown) {
      console.warn('Error reading manifest.csv:', err);
    }
  }

  if (tocFile) {
    // Strategy B: Parse toc.json
    try {
      const tocContent = await fetchDriveFileContent(tocFile.id);
      if (tocContent) {
        const tocItems = JSON.parse(tocContent);
        if (Array.isArray(tocItems)) {
          for (let i = 0; i < tocItems.length; i++) {
            const item = tocItems[i];
            const title = item.title || `Chapter ${i + 1}`;
            const unitNum = i;
            const startPage = item.start_page || null;
            const endPage = item.end_page || null;

            // Try to match with file in folder by number prefix
            const matchedFile = driveFiles.find((f) => {
              const prefix = String(unitNum).padStart(2, '0');
              return f.name.startsWith(prefix);
            });
            const driveFileId = matchedFile?.id || null;
            const filename = matchedFile?.name || `chapter_${unitNum}`;

            const existing =
              (driveFileId ? quizByDriveId.get(driveFileId) : null) ||
              quizByUnitNum.get(unitNum);

            if (existing) {
              await db
                .update(quizzes)
                .set({
                  title,
                  unitTitle: title,
                  driveFileId: driveFileId || existing.driveFileId,
                  startPage,
                  endPage,
                })
                .where(eq(quizzes.id, existing.id));
              syncedCount++;
              fileReports.push({ fileId: driveFileId || existing.id, filename, status: 'updated' });
            } else {
              const hash = await calculateContentHash(`book_${courseId}_toc_${unitNum}`);
              await db.insert(quizzes).values({
                id: crypto.randomUUID(),
                courseId,
                contentHash: hash,
                title,
                unitNumber: unitNum,
                unitTitle: title,
                instructions: startPage && endPage ? `Pages ${startPage} - ${endPage}` : undefined,
                status: 'To do',
                readingStatus: 'To do',
                driveFileId,
                sourceFilename: filename,
                startPage,
                endPage,
                questionCount: 0,
                blankCount: 0,
                placeholderSyntax: '{{n}}',
                createdAt: new Date().toISOString(),
              });
              syncedCount++;
              fileReports.push({ fileId: driveFileId || filename, filename, status: 'synced' });
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
      }
    } catch (err: unknown) {
      console.warn('Error reading toc.json:', err);
    }
  }

  // Strategy C: Standard file-by-file synchronization for PDF/EPUB/Audio/JSON files
  if (driveFiles.length > 0) {
    const totalFiles = driveFiles.length;
    const offset = Math.max(0, options?.offset || 0);
    const batchSize =
      options?.batchSize && options.batchSize > 0 ? options.batchSize : totalFiles;
    const batchSlice = driveFiles.slice(offset, offset + batchSize);
    const hasMore = offset + batchSize < totalFiles;
    const nextOffset = hasMore ? offset + batchSize : null;

    for (let i = 0; i < batchSlice.length; i++) {
      const file = batchSlice[i];
      const filename = file.name;
      const driveFileId = file.id;

      // Ignore metadata / helper files in chapter listing
      if (
        filename.toLowerCase() === 'manifest.csv' ||
        filename.toLowerCase() === 'toc.json' ||
        filename.toLowerCase() === 'toc.md' ||
        filename.toLowerCase() === 'assumptions.txt'
      ) {
        skippedCount++;
        continue;
      }

      const unitMatch = filename.match(/(?:unit|chapter|ch|grammar_unit)[_\s-]*0*(\d+)/i) ||
        filename.match(/^0*(\d+)/);
      const unitNum = unitMatch ? parseInt(unitMatch[1], 10) : i + 1;

      const existing =
        quizByDriveId.get(driveFileId) ||
        quizByFilename.get(filename) ||
        quizByUnitNum.get(unitNum);

      const cleanTitle = filename
        .replace(/\.[a-zA-Z0-9]+$/, '')
        .replace(/^[0-9]+[_\s-]+/, '')
        .replace(/[_-]+/g, ' ')
        .replace(/\bp\d+-p\d+\b/gi, '')
        .trim();

      const displayTitle =
        cleanTitle || (unitNum !== null ? `Chapter ${unitNum}` : filename);

      if (existing) {
        const updateData: Record<string, any> = {};
        if (!existing.driveFileId && driveFileId) {
          updateData.driveFileId = driveFileId;
        }
        if (!existing.sourceFilename && filename) {
          updateData.sourceFilename = filename;
        }
        if (Object.keys(updateData).length > 0) {
          await db.update(quizzes).set(updateData).where(eq(quizzes.id, existing.id));
        }
        skippedCount++;
        fileReports.push({ fileId: driveFileId, filename, status: 'skipped' });
        continue;
      }

      // If json quiz file, try importing quiz content
      let importedSuccessfully = false;
      if (filename.endsWith('.json')) {
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
        } catch {}
      }

      if (!importedSuccessfully) {
        // Create chapter item with status 'To do'
        try {
          const contentHashKey = `book_${courseId}_file_${driveFileId}_${filename}`;
          const hash = await calculateContentHash(contentHashKey);

          await db.insert(quizzes).values({
            id: crypto.randomUUID(),
            courseId,
            contentHash: hash,
            schemaVersion: '2.0.0',
            quizType: 'multi_blank_fill_in_the_blank',
            language: 'en',
            title: displayTitle,
            unitNumber: unitNum,
            unitTitle: displayTitle,
            instructions: `Chapter file: ${filename}`,
            placeholderSyntax: '{{n}}',
            status: 'To do',
            readingStatus: 'To do',
            driveFileId,
            sourceFilename: filename,
            questionCount: 0,
            blankCount: 0,
            createdAt: new Date().toISOString(),
          });
          syncedCount++;
          fileReports.push({ fileId: driveFileId, filename, status: 'synced' });
        } catch (err: unknown) {
          failedCount++;
          fileReports.push({
            fileId: driveFileId,
            filename,
            status: 'failed',
            error: err instanceof Error ? err.message : 'Failed to create chapter',
          });
        }
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

  // Strategy D: Static Fallback for Sample Books when offline / in tests
  if (course.driveFolderId === SAMPLE_BOOK_DRIVE_FOLDER_ID) {
    for (let i = 0; i < SAMPLE_BOOK_MANIFEST.length; i++) {
      const item = SAMPLE_BOOK_MANIFEST[i];
      if (quizByUnitNum.has(item.unit) || quizByFilename.has(item.filename)) {
        skippedCount++;
        continue;
      }
      const hash = await calculateContentHash(`book_${courseId}_unit_${item.unit}_${item.filename}`);
      await db.insert(quizzes).values({
        id: crypto.randomUUID(),
        courseId,
        contentHash: hash,
        title: item.title,
        unitNumber: item.unit,
        unitTitle: item.title,
        instructions: `Pages ${item.start_page} - ${item.end_page}`,
        status: 'To do',
        readingStatus: 'To do',
        startPage: item.start_page,
        endPage: item.end_page,
        driveFileId: item.drive_file_id,
        sourceFilename: item.filename,
        questionCount: 0,
        blankCount: 0,
        placeholderSyntax: '{{n}}',
        createdAt: new Date().toISOString(),
      });
      syncedCount++;
      fileReports.push({ fileId: item.drive_file_id, filename: item.filename, status: 'synced' });
    }
  } else if (
    course.driveFolderId === DEFINING_DECADE_DRIVE_FOLDER_ID ||
    (course.title && course.title.toLowerCase().includes('defining decade'))
  ) {
    for (let i = 0; i < DEFINING_DECADE_MANIFEST.length; i++) {
      const item = DEFINING_DECADE_MANIFEST[i];
      if (quizByUnitNum.has(item.unit) || quizByFilename.has(item.filename)) {
        skippedCount++;
        continue;
      }
      const hash = await calculateContentHash(`book_${courseId}_unit_${item.unit}_${item.filename}`);
      await db.insert(quizzes).values({
        id: crypto.randomUUID(),
        courseId,
        contentHash: hash,
        title: item.title,
        unitNumber: item.unit,
        unitTitle: item.title,
        instructions: `Pages ${item.start_page} - ${item.end_page}`,
        status: 'To do',
        readingStatus: 'To do',
        startPage: item.start_page,
        endPage: item.end_page,
        driveFileId: item.drive_file_id,
        sourceFilename: item.filename,
        questionCount: 0,
        blankCount: 0,
        placeholderSyntax: '{{n}}',
        createdAt: new Date().toISOString(),
      });
      syncedCount++;
      fileReports.push({ fileId: item.drive_file_id, filename: item.filename, status: 'synced' });
    }
  } else if (course.driveFolderId === DEFAULT_DRIVE_FOLDER_ID) {
    // Grammar quizzes fallback
    for (let i = 0; i < GRAMMAR_UNITS_MANIFEST.length; i++) {
      const item = GRAMMAR_UNITS_MANIFEST[i];
      if (quizByUnitNum.has(item.unit)) {
        skippedCount++;
        continue;
      }
      const placeholderHash = await calculateContentHash(`course_${courseId}_unit_${item.unit}_${item.filename}`);
      await db.insert(quizzes).values({
        id: crypto.randomUUID(),
        courseId,
        contentHash: placeholderHash,
        schemaVersion: '2.0.0',
        quizType: 'multi_blank_fill_in_the_blank',
        language: 'en',
        title: `Unit ${String(item.unit).padStart(2, '0')}: ${item.title}`,
        unitNumber: item.unit,
        unitTitle: item.title,
        instructions: 'Fill in every numbered blank.',
        placeholderSyntax: '{{n}}',
        status: 'To do',
        readingStatus: 'To do',
        driveFileId: item.drive_file_id,
        sourceFilename: item.filename,
        questionCount: 0,
        blankCount: 0,
        createdAt: new Date().toISOString(),
      });
      syncedCount++;
      fileReports.push({ fileId: item.drive_file_id, filename: item.filename, status: 'synced' });
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
  _userId?: string
) {
  const courseQuizzes = await db
    .select()
    .from(quizzes)
    .where(eq(quizzes.courseId, courseId))
    .all();

  const total = courseQuizzes.length;
  let todoCount = 0;
  let doingCount = 0;
  let doneCount = 0;
  let ready = 0;
  let pending = 0;

  for (let i = 0; i < courseQuizzes.length; i++) {
    const q = courseQuizzes[i];
    const st = q.status;
    const learningSt = (q as any).learningStatus;
    if (st === 'Done' || learningSt === 'done') {
      doneCount++;
    } else if (st === 'Doing' || learningSt === 'doing') {
      doingCount++;
    } else {
      todoCount++;
    }

    if (q.questionCount > 0) {
      ready++;
    } else {
      pending++;
    }
  }

  return {
    total_chapters: total,
    todo_chapters: todoCount,
    doing_chapters: doingCount,
    done_chapters: doneCount,
    // Backwards-compatible aliases
    total_quizzes: total,
    ready_quizzes: ready,
    pending_quizzes: pending,
    completed_quizzes: doneCount,
  };
}
