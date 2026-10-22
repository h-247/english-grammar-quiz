import {
  QuizSummary,
  QuizDetail,
  CourseSummary,
  CourseDetail,
  CourseCreatePayload,
  AttemptState,
  SaveAnswersResponse,
  AttemptResultResponse,
  AttemptHistoryResponse,
  QuestionCheckFeedback,
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
      const errJson = (await response.json()) as any;
      if (errJson && errJson.detail) {
        errorDetail = typeof errJson.detail === "string" ? errJson.detail : JSON.stringify(errJson.detail);
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

export async function syncCourseDrive(courseId: string): Promise<CourseDetail> {
  return fetchApi<CourseDetail>(`/courses/${courseId}/sync-drive`, {
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
  data: { title?: string; description?: string; banner_url?: string }
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

  const url = `${getApiBase()}/quizzes/import${qStr ? `?${qStr}` : ""}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: jsonText,
  });

  if (!response.ok) {
    let errorDetail = "Failed to import quiz.";
    try {
      const errJson = (await response.json()) as any;
      if (errJson && errJson.detail) {
        errorDetail = typeof errJson.detail === "string" ? errJson.detail : JSON.stringify(errJson.detail);
      }
    } catch {
      errorDetail = `Import failed: ${response.statusText}`;
    }
    throw new Error(errorDetail);
  }

  return response.json();
}

export async function getSettings(): Promise<{ prompt_chat_url: string }> {
  return fetchApi<{ prompt_chat_url: string }>("/settings");
}

export async function updatePromptChatUrl(url: string): Promise<{ prompt_chat_url: string }> {
  return fetchApi<{ prompt_chat_url: string }>("/settings", {
    method: "POST",
    body: JSON.stringify({ prompt_chat_url: url }),
  });
}

export async function importQuizFile(
  file: File,
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
  const formData = new FormData();
  formData.append("file", file);

  const query = new URLSearchParams();
  if (overwrite) query.append("overwrite", "true");
  if (courseId) query.append("course_id", courseId);
  const qStr = query.toString();

  const url = `${getApiBase()}/quizzes/import${qStr ? `?${qStr}` : ""}`;
  const response = await fetch(url, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    let errorDetail = "Failed to import quiz.";
    try {
      const errJson = (await response.json()) as any;
      if (errJson && errJson.detail) {
        errorDetail = typeof errJson.detail === "string" ? errJson.detail : JSON.stringify(errJson.detail);
      }
    } catch {
      errorDetail = `Import failed: ${response.statusText}`;
    }
    throw new Error(errorDetail);
  }

  return response.json();
}

export async function startAttempt(
  quizId: string,
  durationMinutes = 15,
  mode: "timed" | "practice" = "timed"
): Promise<AttemptState> {
  return fetchApi<AttemptState>(`/quizzes/${quizId}/attempts`, {
    method: "POST",
    body: JSON.stringify({ duration_minutes: durationMinutes, mode }),
  });
}

export async function checkQuestionAnswers(
  attemptId: string,
  questionId: string,
  answers: Record<string, string>
): Promise<QuestionCheckFeedback> {
  return fetchApi<QuestionCheckFeedback>(`/attempts/${attemptId}/check-question`, {
    method: "POST",
    body: JSON.stringify({ question_id: questionId, answers }),
  });
}

export async function getAttempt(attemptId: string): Promise<AttemptState> {
  return fetchApi<AttemptState>(`/attempts/${attemptId}`, {
    cache: "no-store",
  });
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

export async function submitAttempt(
  attemptId: string,
  answers?: Record<string, Record<string, string>>
): Promise<AttemptResultResponse> {
  return fetchApi<AttemptResultResponse>(`/attempts/${attemptId}/submit`, {
    method: "POST",
    body: JSON.stringify({ answers }),
  });
}

export async function getAttemptResults(attemptId: string): Promise<AttemptResultResponse> {
  return fetchApi<AttemptResultResponse>(`/attempts/${attemptId}/results`, {
    cache: "no-store",
  });
}

export async function getAttemptHistory(skip = 0, limit = 50): Promise<AttemptHistoryResponse> {
  return fetchApi<AttemptHistoryResponse>(`/attempts?skip=${skip}&limit=${limit}`, {
    cache: "no-store",
  });
}
