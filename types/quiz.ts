export interface Topic {
  id: string;
  title: string;
}

export interface BlankPublic {
  id: string;
  blank_identifier: string;
  order_index: number;
}

export interface QuestionPublic {
  id: string;
  external_id: string;
  order_index: number;
  topic: string;
  section?: string | null;
  question_type: string;
  title: string;
  prompt: string;
  blank_count: number;
  blanks: BlankPublic[];
}

export interface DriveFileReport {
  fileId: string;
  filename: string;
  status: "synced" | "skipped" | "failed" | "updated";
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

export interface CourseSummary {
  id: string;
  title: string;
  description?: string | null;
  drive_folder_id?: string | null;
  drive_folder_url?: string | null;
  banner_url?: string | null;
  total_quizzes: number;
  ready_quizzes: number;
  pending_quizzes: number;
  completed_quizzes: number;
  created_at: string;
  updated_at: string;
}

export interface CourseDetail extends CourseSummary {
  quizzes: QuizSummary[];
  sync_result?: DriveSyncResult;
}

export interface CourseCreatePayload {
  title: string;
  description?: string;
  drive_folder_id?: string;
  drive_folder_url?: string;
  banner_url?: string;
}

export interface QuizSummary {
  id: string;
  title: string;
  unit_number?: number | null;
  unit_title?: string | null;
  instructions?: string | null;
  placeholder_syntax: string;
  question_count: number;
  blank_count: number;
  topics: Topic[];
  course_id?: string | null;
  course_title?: string | null;
  drive_file_id?: string | null;
  source_filename?: string | null;
  chatgpt_url?: string | null;
  status?: "ready" | "pending_import";
  created_at: string;
}

export interface QuizDetail {
  id: string;
  title: string;
  unit_number?: number | null;
  unit_title?: string | null;
  instructions?: string | null;
  placeholder_syntax: string;
  question_count: number;
  blank_count: number;
  topics: Topic[];
  course_id?: string | null;
  course_title?: string | null;
  drive_file_id?: string | null;
  source_filename?: string | null;
  chatgpt_url?: string | null;
  status?: "ready" | "pending_import";
  questions: QuestionPublic[];
}

export interface AttemptState {
  id: string;
  quiz_id: string;
  quiz_title: string;
  duration_seconds: number;
  started_at: string;
  deadline_at: string;
  server_now: string;
  remaining_seconds: number;
  status: "in_progress" | "completed" | "timed_out";
  submission_reason?: "manual" | "timeout" | null;
  mode?: "timed" | "practice";
  saved_answers: Record<string, Record<string, string>>; // question_id -> { blank_id: response }
  questions: QuestionPublic[];
}

export interface BlankCheckFeedback {
  blank_identifier: string;
  user_answer: string;
  correct_answer: string;
  accepted_answers: string[];
  is_correct: boolean;
  is_unanswered: boolean;
}

export interface QuestionCheckFeedback {
  question_id: string;
  is_fully_correct: boolean;
  explanation?: string | null;
  blanks: BlankCheckFeedback[];
}

export interface SaveAnswersResponse {
  saved: boolean;
  saved_count: number;
  server_now: string;
  remaining_seconds: number;
  is_expired: boolean;
}

export interface BlankResultReview {
  blank_identifier: string;
  user_answer: string;
  correct_answer: string;
  accepted_answers: string[];
  is_correct: boolean;
  is_unanswered: boolean;
}

export interface QuestionResultReview {
  question_id: string;
  external_id: string;
  order_index: number;
  title: string;
  topic: string;
  section?: string | null;
  prompt: string;
  explanation?: string | null;
  is_fully_correct: boolean;
  blanks: BlankResultReview[];
}

export interface AttemptResultResponse {
  attempt_id: string;
  quiz_id: string;
  quiz_title: string;
  completion_status: "completed" | "timed_out";
  submission_reason: "manual" | "timeout";
  accuracy_percentage: number;
  total_questions: number;
  total_blanks: number;
  correct_blanks: number;
  incorrect_blanks: number;
  unanswered_blanks: number;
  fully_correct_questions: number;
  time_spent_seconds: number;
  duration_seconds: number;
  started_at: string;
  finalized_at: string;
  questions: QuestionResultReview[];
}

export interface AttemptHistoryItem {
  attempt_id: string;
  quiz_id: string;
  quiz_title: string;
  status: string;
  submission_reason?: string | null;
  accuracy_percentage?: number | null;
  correct_blanks?: number | null;
  total_blanks?: number | null;
  fully_correct_questions?: number | null;
  total_questions?: number | null;
  time_spent_seconds?: number | null;
  duration_seconds: number;
  started_at: string;
  finalized_at?: string | null;
}

export interface AttemptHistoryResponse {
  total: number;
  items: AttemptHistoryItem[];
}

export interface TopicMasteryItem {
  topic: string;
  totalBlanks: number;
  correctBlanks: number;
  percentage: number;
  masteryLevel: "mastered" | "proficient" | "developing" | "needs_practice";
}

export interface TopicMasteryResponse {
  topics: TopicMasteryItem[];
  overallAccuracy: number;
  totalCompletedAttempts: number;
}

export interface AppSettingsResponse {
  prompt_chat_url: string;
  gdrive: {
    configured: boolean;
    has_access_token: boolean;
    has_refresh_token: boolean;
    client_id?: string;
  };
}
