import { getDb } from '@/db';
import { sql } from 'drizzle-orm';

let tablesChecked = false;
let initPromise: Promise<void> | null = null;

export async function ensureDatabaseInitialized(): Promise<void> {
  if (tablesChecked) return;

  if (!initPromise) {
    initPromise = (async () => {
      const db = getDb();

      await Promise.all([
        db.run(sql`
          CREATE TABLE IF NOT EXISTS courses (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            description TEXT,
            author TEXT,
            goodreads_url TEXT,
            cover_url TEXT,
            rating REAL,
            rating_count INTEGER,
            page_count INTEGER,
            isbn TEXT,
            published_year TEXT,
            genres TEXT,
            main_type TEXT,
            author_goodreads_url TEXT,
            drive_folder_id TEXT,
            drive_folder_url TEXT,
            banner_url TEXT,
            deleted_at TEXT,
            user_id TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
          );
        `),
        db.run(sql`
          CREATE TABLE IF NOT EXISTS quizzes (
            id TEXT PRIMARY KEY,
            content_hash TEXT NOT NULL UNIQUE,
            schema_version TEXT NOT NULL DEFAULT '2.0.0',
            quiz_type TEXT NOT NULL DEFAULT 'multi_blank_fill_in_the_blank',
            language TEXT NOT NULL DEFAULT 'en',
            title TEXT NOT NULL,
            unit_number INTEGER,
            unit_title TEXT,
            instructions TEXT,
            placeholder_syntax TEXT NOT NULL DEFAULT '{{n}}',
            grading_config TEXT,
            topics TEXT,
            learning_objectives TEXT,
            coverage_audit TEXT,
            question_count INTEGER NOT NULL DEFAULT 0,
            blank_count INTEGER NOT NULL DEFAULT 0,
            course_id TEXT REFERENCES courses(id) ON DELETE SET NULL,
            drive_file_id TEXT,
            source_filename TEXT,
            chatgpt_url TEXT,
            status TEXT NOT NULL DEFAULT 'To do',
            reading_status TEXT DEFAULT 'To do',
            start_page INTEGER,
            end_page INTEGER,
            created_at TEXT NOT NULL
          );
        `),
        db.run(sql`
          CREATE TABLE IF NOT EXISTS questions (
            id TEXT PRIMARY KEY,
            quiz_id TEXT NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
            external_id TEXT NOT NULL,
            order_index INTEGER NOT NULL,
            topic TEXT NOT NULL,
            section TEXT,
            question_type TEXT NOT NULL,
            title TEXT NOT NULL,
            prompt TEXT NOT NULL,
            blank_count INTEGER NOT NULL,
            objective_ids TEXT,
            explanation TEXT,
            difficulty TEXT,
            source_pdf_page INTEGER
          );
        `),
        db.run(sql`
          CREATE TABLE IF NOT EXISTS blanks (
            id TEXT PRIMARY KEY,
            question_id TEXT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
            blank_identifier TEXT NOT NULL,
            order_index INTEGER NOT NULL,
            accepted_answers TEXT NOT NULL,
            source_question_id TEXT,
            objective_id TEXT
          );
        `),
        db.run(sql`
          CREATE TABLE IF NOT EXISTS quiz_attempts (
            id TEXT PRIMARY KEY,
            quiz_id TEXT NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
            user_id TEXT,
            duration_seconds INTEGER NOT NULL,
            started_at TEXT NOT NULL,
            deadline_at TEXT NOT NULL,
            submitted_at TEXT,
            status TEXT NOT NULL DEFAULT 'in_progress',
            submission_reason TEXT,
            mode TEXT NOT NULL DEFAULT 'timed',
            created_at TEXT NOT NULL
          );
        `),
        db.run(sql`
          CREATE TABLE IF NOT EXISTS user_responses (
            id TEXT PRIMARY KEY,
            attempt_id TEXT NOT NULL REFERENCES quiz_attempts(id) ON DELETE CASCADE,
            question_id TEXT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
            blank_identifier TEXT NOT NULL,
            response_text TEXT NOT NULL DEFAULT '',
            is_correct INTEGER,
            updated_at TEXT NOT NULL,
            UNIQUE(attempt_id, question_id, blank_identifier)
          );
        `),
        db.run(sql`
          CREATE TABLE IF NOT EXISTS attempt_results (
            id TEXT PRIMARY KEY,
            attempt_id TEXT NOT NULL UNIQUE REFERENCES quiz_attempts(id) ON DELETE CASCADE,
            total_questions INTEGER NOT NULL,
            total_blanks INTEGER NOT NULL,
            correct_blanks INTEGER NOT NULL,
            incorrect_blanks INTEGER NOT NULL,
            unanswered_blanks INTEGER NOT NULL,
            fully_correct_questions INTEGER NOT NULL,
            accuracy_percentage REAL NOT NULL,
            time_spent_seconds INTEGER NOT NULL,
            submission_reason TEXT NOT NULL,
            detailed_results TEXT NOT NULL,
            finalized_at TEXT NOT NULL
          );
        `),
        db.run(sql`
          CREATE TABLE IF NOT EXISTS book_types (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL UNIQUE,
            category TEXT NOT NULL DEFAULT 'genre',
            created_at TEXT NOT NULL
          );
        `),
        db.run(sql`
          CREATE TABLE IF NOT EXISTS app_settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
          );
        `),
      ]);

      // Safe migrations for newly added columns if table previously existed
      const courseColumns = [
        'author TEXT',
        'goodreads_url TEXT',
        'cover_url TEXT',
        'rating REAL',
        'rating_count INTEGER',
        'page_count INTEGER',
        'isbn TEXT',
        'published_year TEXT',
        'genres TEXT',
        'main_type TEXT',
        'author_goodreads_url TEXT',
      ];
      for (const col of courseColumns) {
        try {
          await db.run(sql.raw(`ALTER TABLE courses ADD COLUMN ${col}`));
        } catch {}
      }

      const quizColumns = [
        'reading_status TEXT DEFAULT \'To do\'',
        'start_page INTEGER',
        'end_page INTEGER',
      ];
      for (const col of quizColumns) {
        try {
          await db.run(sql.raw(`ALTER TABLE quizzes ADD COLUMN ${col}`));
        } catch {}
      }

      // Backfill existing grammar courses with default types and author links if missing
      try {
        await db.run(sql.raw(`
          UPDATE courses
          SET main_type = 'Grammar & Reference',
              genres = '["Grammar","Reference"]',
              goodreads_url = COALESCE(NULLIF(goodreads_url, ''), 'https://www.goodreads.com/book/show/1598466.Destination_B1'),
              author = COALESCE(NULLIF(author, ''), 'Malcolm Mann & Steve Taylore-Knowles'),
              author_goodreads_url = COALESCE(NULLIF(author_goodreads_url, ''), 'https://www.goodreads.com/search?q=Malcolm+Mann')
          WHERE lower(title) LIKE '%grammar%' AND (main_type IS NULL OR main_type = '');
        `));
      } catch {}

      // Backfill and fix The Optimist (Biography, Keach Hagey author URL, and remove any bad Goodreads drive URLs)
      try {
        await db.run(sql.raw(`
          UPDATE courses
          SET main_type = 'Biography',
              genres = '["Biography","Artificial Intelligence","Business","Technology","Audiobook","Science","Biography Memoir","History","Politics"]',
              goodreads_url = 'https://www.goodreads.com/book/show/223400731-the-optimist',
              author = 'Keach Hagey',
              author_goodreads_url = 'https://www.goodreads.com/author/show/16995547.Keach_Hagey',
              rating = 3.79,
              rating_count = 1352,
              page_count = 384
          WHERE lower(title) LIKE '%optimist%' OR lower(author) LIKE '%keach%';

          UPDATE courses
          SET main_type = 'Self Help',
              genres = '["Self Help","Psychology","Nonfiction","Personal Development","Audiobook","Personal Growth","Business"]',
              goodreads_url = COALESCE(NULLIF(goodreads_url, ''), 'https://www.goodreads.com/book/show/40603783-the-defining-decade'),
              author = 'Meg Jay',
              author_goodreads_url = 'https://www.goodreads.com/author/show/1038942.Meg_Jay',
              rating = 4.1,
              rating_count = 95421,
              page_count = 273
          WHERE lower(title) LIKE '%defining decade%' OR lower(author) LIKE '%meg jay%';

          UPDATE courses
          SET main_type = 'Biography'
          WHERE lower(main_type) IN ('nonfiction', 'fiction', 'non-fiction', 'nonfiction & biography', 'biography & nonfiction');

          UPDATE courses
          SET main_type = 'Grammar'
          WHERE lower(main_type) IN ('nonfiction & grammar', 'grammar & nonfiction');
        `));
      } catch {}

      // Clean up any drive_folder_id or drive_folder_url that was accidentally populated with Goodreads URL
      try {
        await db.run(sql.raw(`
          UPDATE courses
          SET drive_folder_id = '13_vo8ifAR_FS8jPYGKxyW_nYSlGoNYbT',
              drive_folder_url = 'https://drive.google.com/drive/folders/13_vo8ifAR_FS8jPYGKxyW_nYSlGoNYbT'
          WHERE lower(title) LIKE '%optimist%' AND (drive_folder_id LIKE '%goodreads%' OR drive_folder_url LIKE '%goodreads%');

          UPDATE courses
          SET drive_folder_id = NULL,
              drive_folder_url = NULL
          WHERE drive_folder_id LIKE '%goodreads%' OR drive_folder_url LIKE '%goodreads%';
        `));
      } catch {}

      
      // Seed default book types in repo if empty (excluding nonfiction / fiction)
      try {
        await db.run(sql.raw("DELETE FROM book_types WHERE lower(name) IN ('nonfiction', 'fiction', 'non-fiction')"));
        const defaultTypes = [
          { id: 'biography', name: 'Biography', category: 'genre' },
          { id: 'grammar', name: 'Grammar', category: 'genre' },
          { id: 'science-fiction', name: 'Science Fiction', category: 'genre' },
          { id: 'reference', name: 'Reference', category: 'genre' },
          { id: 'business', name: 'Business', category: 'genre' },
          { id: 'technology', name: 'Technology', category: 'genre' },
          { id: 'history', name: 'History', category: 'genre' },
          { id: 'literature', name: 'Literature', category: 'genre' },
          { id: 'mystery', name: 'Mystery', category: 'genre' },
          { id: 'self-help', name: 'Self-Help', category: 'genre' },
          { id: 'philosophy', name: 'Philosophy', category: 'genre' },
          { id: 'psychology', name: 'Psychology', category: 'genre' },
        ];
        const nowIso = new Date().toISOString();
        for (const t of defaultTypes) {
          await db.run(sql.raw(`INSERT OR IGNORE INTO book_types (id, name, category, created_at) VALUES ('${t.id}', '${t.name}', '${t.category}', '${nowIso}')`));
        }
      } catch (e) {
        console.error('Failed to seed default book types:', e);
      }

      tablesChecked = true;
    })();
  }

  await initPromise;
}
