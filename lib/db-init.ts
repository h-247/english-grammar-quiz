import { getDb } from '@/db';
import { sql } from 'drizzle-orm';

let tablesChecked = false;

export async function ensureDatabaseInitialized() {
  if (tablesChecked) return;

  const db = getDb();

  // Create tables if they do not exist
  await db.run(sql`
    CREATE TABLE IF NOT EXISTS courses (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      drive_folder_id TEXT,
      drive_folder_url TEXT,
      banner_url TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  try {
    await db.run(sql`ALTER TABLE courses ADD COLUMN banner_url TEXT;`);
  } catch {}

  try {
    await db.run(
      sql`UPDATE courses SET banner_url = 'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?q=80&w=800&auto=format&fit=crop' WHERE banner_url IS NULL OR banner_url = 'banner_url' OR banner_url = '';`
    );
  } catch {}

  await db.run(sql`
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
      status TEXT NOT NULL DEFAULT 'ready',
      created_at TEXT NOT NULL
    );
  `);

  await db.run(sql`
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
  `);

  await db.run(sql`
    CREATE TABLE IF NOT EXISTS blanks (
      id TEXT PRIMARY KEY,
      question_id TEXT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
      blank_identifier TEXT NOT NULL,
      order_index INTEGER NOT NULL,
      accepted_answers TEXT NOT NULL,
      source_question_id TEXT,
      objective_id TEXT
    );
  `);

  await db.run(sql`
    CREATE TABLE IF NOT EXISTS quiz_attempts (
      id TEXT PRIMARY KEY,
      quiz_id TEXT NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
      duration_seconds INTEGER NOT NULL,
      started_at TEXT NOT NULL,
      deadline_at TEXT NOT NULL,
      submitted_at TEXT,
      status TEXT NOT NULL DEFAULT 'in_progress',
      submission_reason TEXT,
      mode TEXT NOT NULL DEFAULT 'timed',
      created_at TEXT NOT NULL
    );
  `);

  await db.run(sql`
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
  `);

  await db.run(sql`
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
  `);

  tablesChecked = true;
}
