import {
  QuizSummary,
  QuizDetail,
  CourseSummary,
  CourseDetail,
  CourseCreatePayload,
  ChapterStatus,
  GoodreadsBookDetails,
  AttemptState,
  SaveAnswersResponse,
  AttemptResultResponse,
  AttemptHistoryResponse,
  QuestionCheckFeedback,
  TopicMasteryResponse,
  AppSettingsResponse,
  QuizHistoryResponse,
} from "@/types/quiz";

export function getApiBase(): string {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }
  if (typeof window !== "undefined") {
    return "/api";
  }
  return "http://127.0.0.1:8080/api";
}

export async function fetchApi<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${getApiBase()}${endpoint}`;
  const headers = new Headers(options.headers || {});

  if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorDetail = "An unexpected error occurred.";
    try {
      const errJson = (await response.json()) as { detail?: unknown };
      if (errJson && errJson.detail) {
        errorDetail =
          typeof errJson.detail === "string"
            ? errJson.detail
            : JSON.stringify(errJson.detail);
      }
    } catch {
      errorDetail = `Request failed with status ${response.status}: ${response.statusText}`;
    }
    throw new Error(errorDetail);
  }

  return response.json() as Promise<T>;
}

export async function getCourses(): Promise<CourseSummary[]> {
  return fetchApi<CourseSummary[]>("/courses");
}

export async function getCourse(courseId: string): Promise<CourseDetail> {
  return fetchApi<CourseDetail>(`/courses/${courseId}`);
}

export async function syncCourseDrive(
  courseId: string,
  options?: { offset?: number; batchSize?: number; forceRefresh?: boolean }
): Promise<CourseDetail> {
  const query = new URLSearchParams();
  if (options?.offset != null) query.append("offset", String(options.offset));
  if (options?.batchSize != null) query.append("batchSize", String(options.batchSize));
  if (options?.forceRefresh) query.append("force", "true");
  const qStr = query.toString();
  return fetchApi<CourseDetail>(`/courses/${courseId}/sync-drive${qStr ? `?${qStr}` : ""}`, {
    method: "POST",
  });
}

export async function createCourse(data: CourseCreatePayload): Promise<CourseSummary> {
  return fetchApi<CourseSummary>("/courses", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function deleteCourse(courseId: string): Promise<{ message: string; course_id: string }> {
  return fetchApi<{ message: string; course_id: string }>(`/courses/${courseId}`, {
    method: "DELETE",
  });
}

export async function updateCourse(
  courseId: string,
  data: {
    title?: string;
    description?: string;
    author?: string;
    goodreads_url?: string;
    cover_url?: string;
    banner_url?: string;
    rating?: number;
    page_count?: number;
  }
): Promise<CourseSummary> {
  return fetchApi<CourseSummary>(`/courses/${courseId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function getDriveFolderInfo(
  urlOrId: string
): Promise<{ folder_id: string; name: string | null }> {
  return fetchApi<{ folder_id: string; name: string | null }>(
    `/drive/folder-info?url=${encodeURIComponent(urlOrId)}`
  );
}

export async function getQuizzes(params?: { course_id?: string; status?: string }): Promise<QuizSummary[]> {
  const query = new URLSearchParams();
  if (params?.course_id) query.append("course_id", params.course_id);
  if (params?.status) query.append("status", params.status);
  const qStr = query.toString();
  return fetchApi<QuizSummary[]>(`/quizzes${qStr ? `?${qStr}` : ""}`);
}

export async function getQuiz(quizId: string): Promise<QuizDetail> {
  return fetchApi<QuizDetail>(`/quizzes/${quizId}`);
}

export async function deleteQuiz(quizId: string): Promise<{ message: string; quiz_id: string }> {
  return fetchApi<{ message: string; quiz_id: string }>(`/quizzes/${quizId}`, {
    method: "DELETE",
  });
}

export async function updateQuiz(
  quizId: string,
  data: { chatgpt_url?: string | null; status?: ChapterStatus | string }
): Promise<{ id: string; title: string; status?: string; chatgpt_url: string | null; message: string }> {
  return fetchApi<{ id: string; title: string; status?: string; chatgpt_url: string | null; message: string }>(
    `/quizzes/${quizId}`,
    {
      method: "PATCH",
      body: JSON.stringify(data),
    }
  );
}

export async function updateChapterStatus(
  chapterId: string,
  status: ChapterStatus
): Promise<{ id: string; title: string; status: string; message: string }> {
  return fetchApi<{ id: string; title: string; status: string; message: string }>(
    `/quizzes/${chapterId}`,
    {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }
  );
}

export async function fetchGoodreadsInfo(
  url: string
): Promise<GoodreadsBookDetails> {
  return fetchApi<GoodreadsBookDetails>(
    `/books/goodreads?url=${encodeURIComponent(url)}`
  );
}

export async function importQuizJson(
  jsonText: string,
  overwrite: boolean = false,
  courseId?: string
): Promise<{
  message: string;
  quiz_id: string;
  title: string;
  question_count: number;
  blank_count: number;
  is_duplicate: boolean;
}> {
  const query = new URLSearchParams();
  if (overwrite) query.append("overwrite", "true");
  if (courseId) query.append("course_id", courseId);
  const qStr = query.toString();

  return fetchApi<{
    message: string;
    quiz_id: string;
    title: string;
    question_count: number;
    blank_count: number;
    is_duplicate: boolean;
  }>(`/quizzes/import${qStr ? `?${qStr}` : ""}`, {
    method: "POST",
    body: jsonText,
  });
}

export async function getSettings(): Promise<AppSettingsResponse> {
  return fetchApi<AppSettingsResponse>("/settings");
}

export async function updateSettings(data: {
  prompt_chat_url?: string;
  gdrive_access_token?: string;
  gdrive_refresh_token?: string;
  gdrive_client_id?: string;
  gdrive_client_secret?: string;
  clear_gdrive?: boolean;
}): Promise<{ message: string }> {
  return fetchApi<{ message: string }>("/settings", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updatePromptChatUrl(url: string): Promise<{ prompt_chat_url: string }> {
  return fetchApi<{ prompt_chat_url: string }>("/settings", {
    method: "POST",
    body: JSON.stringify({ prompt_chat_url: url }),
  });
}

export async function testDriveConnection(folderId?: string): Promise<{
  success: boolean;
  folder_name?: string;
  files_found?: number;
  error?: string;
}> {
  return fetchApi<{
    success: boolean;
    folder_name?: string;
    files_found?: number;
    error?: string;
  }>("/settings/test-drive", {
    method: "POST",
    body: JSON.stringify({ folder_id: folderId }),
  });
}

export async function startAttempt(
  quizId: string,
  durationMinutes: number = 15,
  mode: "timed" | "practice" = "timed"
): Promise<{ id: string; quiz_id: string; mode: string }> {
  return fetchApi<{ id: string; quiz_id: string; mode: string }>(
    `/quizzes/${quizId}/attempts`,
    {
      method: "POST",
      body: JSON.stringify({ duration_minutes: durationMinutes, mode }),
    }
  );
}

export async function getAttempt(attemptId: string): Promise<AttemptState> {
  return fetchApi<AttemptState>(`/attempts/${attemptId}`);
}

export async function saveAnswers(
  attemptId: string,
  answers: Record<string, Record<string, string>>
): Promise<SaveAnswersResponse> {
  return fetchApi<SaveAnswersResponse>(`/attempts/${attemptId}/answers`, {
    method: "PATCH",
    body: JSON.stringify({ answers }),
  });
}

export async function checkQuestion(
  attemptId: string,
  questionId: string,
  answers: Record<string, string>
): Promise<QuestionCheckFeedback> {
  return fetchApi<QuestionCheckFeedback>(
    `/attempts/${attemptId}/check-question`,
    {
      method: "POST",
      body: JSON.stringify({ question_id: questionId, answers }),
    }
  );
}

export const checkQuestionAnswers = checkQuestion;

export async function submitAttempt(
  attemptId: string,
  answers?: Record<string, Record<string, string>>
): Promise<{ message: string; attempt_id: string; accuracy_percentage: number }> {
  return fetchApi<{ message: string; attempt_id: string; accuracy_percentage: number }>(
    `/attempts/${attemptId}/submit`,
    {
      method: "POST",
      body: JSON.stringify({ answers }),
    }
  );
}

export async function getAttemptResults(attemptId: string): Promise<AttemptResultResponse> {
  return fetchApi<AttemptResultResponse>(`/attempts/${attemptId}/results`);
}

export async function getAttemptHistory(): Promise<AttemptHistoryResponse> {
  return fetchApi<AttemptHistoryResponse>("/attempts");
}

export async function getTopicMastery(): Promise<TopicMasteryResponse> {
  return fetchApi<TopicMasteryResponse>("/mastery");
}

export async function practiceMistakesForAttempt(
  attemptId: string
): Promise<{ attempt_id: string; quiz_id: string; total_questions: number }> {
  return fetchApi<{ attempt_id: string; quiz_id: string; total_questions: number }>(
    `/attempts/${attemptId}/practice-mistakes`,
    {
      method: "POST",
    }
  );
}

export async function practiceMistakesForCourse(
  courseId: string
): Promise<{ attempt_id: string; quiz_id: string; total_questions: number }> {
  return fetchApi<{ attempt_id: string; quiz_id: string; total_questions: number }>(
    `/courses/${courseId}/practice-mistakes`,
    {
      method: "POST",
    }
  );
}

// Book & Chapter domain aliases
export const getBooks = getCourses;
export const getBook = getCourse;
export const createBook = createCourse;
export const updateBook = updateCourse;
export const deleteBook = deleteCourse;
export const syncBookDrive = syncCourseDrive;
export const getChapters = getQuizzes;
export const getChapter = getQuiz;
export const updateChapter = updateQuiz;
export const deleteChapter = deleteQuiz;

export async function getQuizHistory(quizId: string): Promise<QuizHistoryResponse> {
  return fetchApi<QuizHistoryResponse>(`/quizzes/${quizId}/attempts`, {
    cache: "no-store",
  });
}
