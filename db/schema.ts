import { sqliteTable, text, integer, real, index, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const courses = sqliteTable(
  'courses',
  {
    id: text('id').primaryKey(),
    title: text('title').notNull(),
    description: text('description'),
    driveFolderId: text('drive_folder_id'),
    driveFolderUrl: text('drive_folder_url'),
    bannerUrl: text('banner_url'),
    deletedAt: text('deleted_at'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    index('courses_drive_folder_id_idx').on(table.driveFolderId),
    index('courses_deleted_at_idx').on(table.deletedAt),
  ]
);

export const quizzes = sqliteTable(
  'quizzes',
  {
    id: text('id').primaryKey(),
    contentHash: text('content_hash').notNull(),
    schemaVersion: text('schema_version').notNull().default('2.0.0'),
    quizType: text('quiz_type').notNull().default('multi_blank_fill_in_the_blank'),
    language: text('language').notNull().default('en'),
    title: text('title').notNull(),
    unitNumber: integer('unit_number'),
    unitTitle: text('unit_title'),
    instructions: text('instructions'),
    placeholderSyntax: text('placeholder_syntax').notNull().default('{{n}}'),
    gradingConfig: text('grading_config', { mode: 'json' }),
    topics: text('topics', { mode: 'json' }),
    learningObjectives: text('learning_objectives', { mode: 'json' }),
    coverageAudit: text('coverage_audit', { mode: 'json' }),
    questionCount: integer('question_count').notNull().default(0),
    blankCount: integer('blank_count').notNull().default(0),
    courseId: text('course_id').references(() => courses.id, { onDelete: 'set null' }),
    driveFileId: text('drive_file_id'),
    sourceFilename: text('source_filename'),
    status: text('status').notNull().default('ready'),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    uniqueIndex('quizzes_content_hash_idx').on(table.contentHash),
    index('quizzes_course_id_idx').on(table.courseId),
    index('quizzes_unit_number_idx').on(table.unitNumber),
  ]
);

export const questions = sqliteTable(
  'questions',
  {
    id: text('id').primaryKey(),
    quizId: text('quiz_id')
      .notNull()
      .references(() => quizzes.id, { onDelete: 'cascade' }),
    externalId: text('external_id').notNull(),
    orderIndex: integer('order_index').notNull(),
    topic: text('topic').notNull(),
    section: text('section'),
    questionType: text('question_type').notNull(),
    title: text('title').notNull(),
    prompt: text('prompt').notNull(),
    blankCount: integer('blank_count').notNull(),
    objectiveIds: text('objective_ids', { mode: 'json' }),
    explanation: text('explanation'),
    difficulty: text('difficulty'),
    sourcePdfPage: integer('source_pdf_page'),
  },
  (table) => [
    index('questions_quiz_id_idx').on(table.quizId),
    index('questions_order_idx').on(table.orderIndex),
  ]
);

export const blanks = sqliteTable(
  'blanks',
  {
    id: text('id').primaryKey(),
    questionId: text('question_id')
      .notNull()
      .references(() => questions.id, { onDelete: 'cascade' }),
    blankIdentifier: text('blank_identifier').notNull(),
    orderIndex: integer('order_index').notNull(),
    acceptedAnswers: text('accepted_answers', { mode: 'json' }).notNull(),
    sourceQuestionId: text('source_question_id'),
    objectiveId: text('objective_id'),
  },
  (table) => [
    index('blanks_question_id_idx').on(table.questionId),
  ]
);

export const quizAttempts = sqliteTable(
  'quiz_attempts',
  {
    id: text('id').primaryKey(),
    quizId: text('quiz_id')
      .notNull()
      .references(() => quizzes.id, { onDelete: 'cascade' }),
    durationSeconds: integer('duration_seconds').notNull(),
    startedAt: text('started_at').notNull(),
    deadlineAt: text('deadline_at').notNull(),
    submittedAt: text('submitted_at'),
    status: text('status').notNull().default('in_progress'),
    submissionReason: text('submission_reason'),
    mode: text('mode').notNull().default('timed'),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    index('attempts_quiz_id_idx').on(table.quizId),
    index('attempts_status_idx').on(table.status),
    index('attempts_deadline_idx').on(table.deadlineAt),
  ]
);

export const userResponses = sqliteTable(
  'user_responses',
  {
    id: text('id').primaryKey(),
    attemptId: text('attempt_id')
      .notNull()
      .references(() => quizAttempts.id, { onDelete: 'cascade' }),
    questionId: text('question_id')
      .notNull()
      .references(() => questions.id, { onDelete: 'cascade' }),
    blankIdentifier: text('blank_identifier').notNull(),
    responseText: text('response_text').notNull().default(''),
    isCorrect: integer('is_correct', { mode: 'boolean' }),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    uniqueIndex('uq_attempt_question_blank').on(
      table.attemptId,
      table.questionId,
      table.blankIdentifier
    ),
    index('responses_attempt_id_idx').on(table.attemptId),
  ]
);

export const attemptResults = sqliteTable(
  'attempt_results',
  {
    id: text('id').primaryKey(),
    attemptId: text('attempt_id')
      .notNull()
      .unique()
      .references(() => quizAttempts.id, { onDelete: 'cascade' }),
    totalQuestions: integer('total_questions').notNull(),
    totalBlanks: integer('total_blanks').notNull(),
    correctBlanks: integer('correct_blanks').notNull(),
    incorrectBlanks: integer('incorrect_blanks').notNull(),
    unansweredBlanks: integer('unanswered_blanks').notNull(),
    fullyCorrectQuestions: integer('fully_correct_questions').notNull(),
    accuracyPercentage: real('accuracy_percentage').notNull(),
    timeSpentSeconds: integer('time_spent_seconds').notNull(),
    submissionReason: text('submission_reason').notNull(),
    detailedResults: text('detailed_results', { mode: 'json' }).notNull(),
    finalizedAt: text('finalized_at').notNull(),
  },
  (table) => [
    index('results_attempt_id_idx').on(table.attemptId),
  ]
);
