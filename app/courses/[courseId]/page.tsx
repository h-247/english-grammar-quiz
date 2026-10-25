"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ExternalLink,
  RefreshCw,
  Trash2,
  Play,
  BookOpen,
  HardDrive,
  CheckCircle2,
  Clock,
  Layers,
  Search,
  X,
  Loader2,
  AlertCircle,
  Sparkles,
  ClipboardPaste,
  Pencil,
  Bot,
  History,
} from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { ImportModal } from "@/components/ImportModal";
import { DeleteConfirmModal } from "@/components/DeleteConfirmModal";
import { QuizConfigModal } from "@/components/QuizConfigModal";
import { EditCourseModal } from "@/components/EditCourseModal";
import { EditQuizChatModal } from "@/components/EditQuizChatModal";
import { CopyDriveLinkButton } from "@/components/CopyDriveLinkButton";
import { QuizHistoryModal } from "@/components/QuizHistoryModal";
import { DEFAULT_PROMPT_CHAT_URL } from "@/lib/course-manifest";
import {
  getCourse,
  syncCourseDrive,
  deleteCourse,
  deleteQuiz,
  startAttempt,
  practiceMistakesForCourse,
} from "@/lib/api";
import { CourseDetail, QuizSummary } from "@/types/quiz";
import { useToast } from "@/components/Toast";

export default function CourseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { showToast } = useToast();

  const courseId = (params?.courseId as string) || "";

  // Course Data
  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Search & Status filters (No topics!)
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedStatus, setSelectedStatus] = useState<"all" | "ready" | "pending_import">("all");

  // Prompt Chat URL state
  const [promptChatUrl, setPromptChatUrl] = useState<string>(DEFAULT_PROMPT_CHAT_URL);

  useEffect(() => {
    const cached = localStorage.getItem("prompt_chat_url");
    if (cached) setPromptChatUrl(cached);
  }, []);
  const [isImportOpen, setIsImportOpen] = useState<boolean>(false);
  const [targetQuizForImport, setTargetQuizForImport] = useState<QuizSummary | null>(null);

  // Deletion Modals
  const [quizToDelete, setQuizToDelete] = useState<QuizSummary | null>(null);
  const [isDeletingQuiz, setIsDeletingQuiz] = useState<boolean>(false);

  const [isDeleteCourseOpen, setIsDeleteCourseOpen] = useState<boolean>(false);
  const [isDeletingCourse, setIsDeletingCourse] = useState<boolean>(false);
  const [isPracticingMistakes, setIsPracticingMistakes] = useState<boolean>(false);
  const [isEditCourseOpen, setIsEditCourseOpen] = useState<boolean>(false);
  const [quizForChatEdit, setQuizForChatEdit] = useState<QuizSummary | null>(null);

  // Quiz Start Configuration Modal
  const [selectedQuizForStart, setSelectedQuizForStart] = useState<QuizSummary | null>(null);
  const [isConfigOpen, setIsConfigOpen] = useState<boolean>(false);
  const [isStartingQuiz, setIsStartingQuiz] = useState<boolean>(false);

  // Quiz History Modal
  const [historyQuiz, setHistoryQuiz] = useState<QuizSummary | null>(null);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState<boolean>(false);

  const handleOpenQuizHistory = (quiz: QuizSummary) => {
    setHistoryQuiz(quiz);
    setIsHistoryModalOpen(true);
  };

  // Fetch course details
  const loadCourse = useCallback(async (isSilent = false) => {
    if (!courseId) return;
    if (!isSilent) setIsLoading(true);
    setError(null);

    try {
      const data = await getCourse(courseId);
      setCourse(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load course details.";
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    loadCourse();
  }, [loadCourse]);

  // Handle Incremental / Batch Sync Drive
  const handleSyncDrive = async () => {
    if (!course) return;
    setIsSyncing(true);
    try {
      let offset = 0;
      const batchSize = 10;
      let hasMore = true;
      let totalSynced = 0;
      let totalFailed = 0;

      showToast(`Starting Google Drive sync for "${course.title}"...`, "info", 3000);

      while (hasMore) {
        const res = await syncCourseDrive(course.id, {
          offset,
          batchSize,
          forceRefresh: offset === 0,
        });

        const syncResult = res.sync_result;
        if (!syncResult) {
          totalSynced = res.total_quizzes || 0;
          break;
        }

        totalSynced += syncResult.syncedCount;
        totalFailed += syncResult.failedCount;
        hasMore = syncResult.hasMore;
        if (syncResult.nextOffset != null) {
          offset = syncResult.nextOffset;
          showToast(
            `Syncing units (${Math.min(offset, syncResult.totalFiles)}/${syncResult.totalFiles})...`,
            "info",
            2000
          );
        } else {
          break;
        }
      }

      const msg =
        totalFailed > 0
          ? `Synced with Google Drive! (${totalSynced} units synced, ${totalFailed} corrupt/skipped)`
          : `Synchronized "${course.title}" with Google Drive successfully!`;
      showToast(msg, totalFailed > 0 ? "warning" : "success", 5000);
      await loadCourse(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to sync course with Drive.";
      showToast(msg, "error", 6000);
    } finally {
      setIsSyncing(false);
    }
  };

  // Handle Practice Course Mistakes Only
  const handlePracticeCourseMistakes = async () => {
    if (!course) return;
    setIsPracticingMistakes(true);
    try {
      const res = await practiceMistakesForCourse(course.id);
      showToast(res.message, "success", 4000);
      router.push(`/quiz/${res.quiz_id}/attempt/${res.attempt_id}`);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "No mistakes to practice in this course!";
      showToast(msg, "info", 5000);
    } finally {
      setIsPracticingMistakes(false);
    }
  };

  // Handle Delete Course
  const handleConfirmDeleteCourse = async () => {
    if (!course) return;
    setIsDeletingCourse(true);
    try {
      await deleteCourse(course.id);
      showToast(`Course "${course.title}" was deleted successfully.`, "info", 5000);
      router.push("/");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to delete course.";
      showToast(msg, "error", 6000);
      setIsDeletingCourse(false);
    }
  };

  // Handle Delete Quiz
  const handleConfirmDeleteQuiz = async () => {
    if (!quizToDelete) return;
    setIsDeletingQuiz(true);
    try {
      await deleteQuiz(quizToDelete.id);
      showToast(`Quiz "${quizToDelete.title}" was deleted.`, "info", 4000);
      setQuizToDelete(null);
      await loadCourse(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to delete quiz.";
      showToast(msg, "error", 6000);
    } finally {
      setIsDeletingQuiz(false);
    }
  };

  // Start Quiz (Exam or Practice)
  const handleStartExamClick = (quiz: QuizSummary) => {
    setSelectedQuizForStart(quiz);
    setIsConfigOpen(true);
  };

  const handleStartPracticeClick = (quiz: QuizSummary) => {
    executeStartAttempt(quiz, 30, "practice");
  };

  const executeStartAttempt = async (
    quiz: QuizSummary,
    durationMinutes: number,
    mode: "timed" | "practice"
  ) => {
    setIsStartingQuiz(true);
    try {
      const attempt = await startAttempt(quiz.id, durationMinutes, mode);
      if (mode === "timed") {
        showToast(`Timed quiz started! You have ${durationMinutes} minutes.`, "info", 4000);
      } else {
        showToast("Self-paced practice started! Immediate feedback active.", "success", 4000);
      }
      setIsConfigOpen(false);
      router.push(`/quiz/${quiz.id}/attempt/${attempt.id}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to start quiz attempt.";
      showToast(msg, "error", 5000);
      setIsStartingQuiz(false);
    }
  };

  // Filtered Quizzes
  const quizzes = useMemo(() => course?.quizzes || [], [course]);

  const filteredQuizzes = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return quizzes.filter((quiz) => {
      // 1. Status Filter
      if (selectedStatus === "ready") {
        if (quiz.status !== "ready" || quiz.question_count === 0) return false;
      } else if (selectedStatus === "pending_import") {
        if (quiz.status === "ready" && quiz.question_count > 0) return false;
      }

      // 2. Search query filter
      if (q) {
        const titleMatch = quiz.title?.toLowerCase().includes(q);
        const unitTitleMatch = quiz.unit_title?.toLowerCase().includes(q);
        const unitNumMatch = quiz.unit_number?.toString() === q;
        if (!titleMatch && !unitTitleMatch && !unitNumMatch) return false;
      }

      return true;
    });
  }, [quizzes, selectedStatus, searchQuery]);

  // Counts
  const readyCount = useMemo(() => {
    return quizzes.filter((q) => q.status === "ready" && q.question_count > 0).length;
  }, [quizzes]);

  const pendingCount = useMemo(() => {
    return quizzes.filter((q) => q.status === "pending_import" || q.question_count === 0).length;
  }, [quizzes]);

  const progressPercent = useMemo(() => {
    if (!course || course.total_quizzes === 0) return 0;
    return Math.round((course.completed_quizzes / course.total_quizzes) * 100);
  }, [course]);

  // Next up quiz for "CONTINUE LEARNING" highlight callout (Matching Image 2)
  const nextQuiz = useMemo(() => {
    return (
      quizzes.find((q) => q.status === "ready" && q.question_count > 0) ||
      quizzes[0] ||
      null
    );
  }, [quizzes]);

  return (
    <div className="min-h-screen flex flex-col bg-[#212121] text-[#ececec]" suppressHydrationWarning>
      {/* Top Navigation */}
      <Navbar
        onOpenImportCourse={() => router.push("/")}
        driveConnected={true}
        promptChatUrl={promptChatUrl}
        onPromptChatUrlChange={setPromptChatUrl}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6">
        {/* Breadcrumb Navigation (Matching Image 2) */}
        <div className="flex items-center gap-2 text-sm text-[#9CA3AF] mb-6">
          <Link
            href="/"
            className="flex items-center gap-1.5 hover:text-white transition-colors group cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
            <span className="font-medium">Courses</span>
          </Link>
          <span className="text-[#555555]">/</span>
          <span className="text-white font-medium truncate max-w-md">
            {course ? course.title : "Course Detail"}
          </span>
          {course?.drive_folder_url && (
            <div className="inline-flex items-center gap-0.5 ml-1">
              <CopyDriveLinkButton
                url={course.drive_folder_url}
                folderId={course.drive_folder_id}
                title="Copy Google Drive folder link"
              />
              <a
                href={course.drive_folder_url}
                target="_blank"
                rel="noreferrer"
                title="Open Google Drive Folder"
                className="text-gray-400 hover:text-blue-400 p-1 rounded transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          )}
        </div>

        {/* Loading / Error States */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-24 text-gray-400">
            <Loader2 className="w-8 h-8 animate-spin text-white mb-3" />
            <span className="text-sm">Loading course and units...</span>
          </div>
        ) : error || !course ? (
          <div className="max-w-lg mx-auto p-6 bg-rose-950/30 border border-rose-500/40 rounded-2xl text-center space-y-3">
            <AlertCircle className="w-8 h-8 text-rose-400 mx-auto" />
            <h3 className="text-base font-semibold text-white">Course Not Found</h3>
            <p className="text-xs text-rose-300">{error || "Course does not exist or was deleted."}</p>
            <Link
              href="/"
              className="inline-block px-4 py-2 rounded-xl text-xs font-semibold bg-[#2c2c2c] hover:bg-[#383838] text-white transition-colors"
            >
              Back to Courses
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Hero Header Card (Matching Image 2) */}
            <div className="rounded-2xl bg-[#1c1c1c] border border-[#2e2e2e] p-6 shadow-xl relative overflow-hidden">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                {/* Title & Drive Link info */}
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                      {course.title}
                    </h1>
                    <button
                      type="button"
                      onClick={() => setIsEditCourseOpen(true)}
                      title="Edit Course Name & Details"
                      className="p-1.5 text-gray-400 hover:text-white hover:bg-[#2c2c2c] rounded-lg transition-colors border border-[#3a3a3a] cursor-pointer"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                  </div>

                  <p className="text-sm text-[#9CA3AF] max-w-3xl leading-relaxed">
                    {course.description || "Comprehensive English Grammar curriculum with automated Google Drive integration."}
                  </p>

                  <div className="flex items-center gap-3 flex-wrap pt-1 text-xs text-[#888888]">
                    {course.drive_folder_id && (
                      <div className="inline-flex items-center rounded-lg bg-[#242424] border border-[#333333] p-0.5">
                        <a
                          href={course.drive_folder_url || `https://drive.google.com/drive/folders/${course.drive_folder_id}`}
                          target="_blank"
                          rel="noreferrer"
                          title="Open Google Drive folder"
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 text-blue-400 hover:text-blue-300 transition-colors"
                        >
                          <HardDrive className="w-3.5 h-3.5" />
                          <span>Drive Folder: {course.drive_folder_id}</span>
                          <ExternalLink className="w-3 h-3 ml-0.5" />
                        </a>
                        <CopyDriveLinkButton
                          url={course.drive_folder_url}
                          folderId={course.drive_folder_id}
                          title="Copy Google Drive folder link"
                          className="p-1 border-l border-[#333333] text-gray-400 hover:text-white"
                        />
                      </div>
                    )}
                    <span>
                      Last Synced:{" "}
                      {new Date(course.updated_at).toLocaleDateString("en-US", {
                        month: "numeric",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                </div>

                {/* Top Action Buttons (Matching Image 2) */}
                <div className="flex items-center gap-2.5 flex-wrap shrink-0">
                  {/* Practice Mistakes for Course */}
                  {course.completed_quizzes > 0 && (
                    <button
                      type="button"
                      onClick={handlePracticeCourseMistakes}
                      disabled={isPracticingMistakes}
                      title="Generate dynamic practice session with questions missed across this course"
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 transition-all cursor-pointer disabled:opacity-50"
                    >
                      {isPracticingMistakes ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
                      ) : (
                        <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                      )}
                      <span>Practice Mistakes Only</span>
                    </button>
                  )}

                  {/* Re-sync Drive */}
                  <button
                    onClick={handleSyncDrive}
                    disabled={isSyncing}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-[#262626] hover:bg-[#303030] text-gray-200 border border-[#383838] transition-all cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin text-blue-400" : ""}`} />
                    <span>{isSyncing ? "Syncing..." : "Re-sync Drive"}</span>
                  </button>

                  {/* + Paste Quiz JSON */}
                  <button
                    onClick={() => {
                      setTargetQuizForImport(null);
                      setIsImportOpen(true);
                    }}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white text-black hover:bg-neutral-200 transition-all shadow-sm cursor-pointer"
                  >
                    <ClipboardPaste className="w-3.5 h-3.5 stroke-[2.5]" />
                    <span>Paste Quiz JSON</span>
                  </button>

                  {/* Delete Course (with confirmation) */}
                  <button
                    onClick={() => setIsDeleteCourseOpen(true)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-red-400 hover:text-red-300 hover:bg-red-950/30 border border-red-900/40 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Course</span>
                  </button>
                </div>
              </div>
            </div>

            {/* 4 Metric / KPI Cards (Matching Image 2) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Card 1: Total Units */}
              <div className="p-5 rounded-2xl bg-[#1c1c1c] border border-[#2e2e2e] shadow-lg flex items-center justify-between">
                <div>
                  <span className="text-xs font-medium text-[#9CA3AF]">Total Units</span>
                  <p className="text-3xl font-extrabold text-white mt-1">{course.total_quizzes}</p>
                  <span className="text-[11px] text-gray-500 mt-0.5 block">All curriculum units</span>
                </div>
                <div className="p-3 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  <Layers className="w-6 h-6" />
                </div>
              </div>

              {/* Card 2: Ready to Play */}
              <div className="p-5 rounded-2xl bg-[#1c1c1c] border border-[#2e2e2e] shadow-lg flex items-center justify-between">
                <div>
                  <span className="text-xs font-medium text-[#9CA3AF]">Ready to Play</span>
                  <p className="text-3xl font-extrabold text-emerald-400 mt-1">{course.ready_quizzes}</p>
                  <span className="text-[11px] text-emerald-500/80 mt-0.5 block">With questions & blanks</span>
                </div>
                <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
              </div>

              {/* Card 3: Pending JSON */}
              <div className="p-5 rounded-2xl bg-[#1c1c1c] border border-[#2e2e2e] shadow-lg flex items-center justify-between">
                <div>
                  <span className="text-xs font-medium text-[#9CA3AF]">Pending JSON</span>
                  <p className="text-3xl font-extrabold text-amber-400 mt-1">{course.pending_quizzes}</p>
                  <span className="text-[11px] text-amber-500/80 mt-0.5 block">Awaiting quiz import</span>
                </div>
                <div className="p-3 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  <Clock className="w-6 h-6" />
                </div>
              </div>

              {/* Card 4: Learning Progress */}
              <div className="p-5 rounded-2xl bg-[#1c1c1c] border border-[#2e2e2e] shadow-lg flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-[#9CA3AF]">Learning Progress</span>
                  <span className="text-sm font-bold text-white">{progressPercent}%</span>
                </div>
                <div className="my-2">
                  <div className="w-full bg-[#2a2a2a] h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                </div>
                <span className="text-[11px] text-gray-500">
                  {course.completed_quizzes} of {course.total_quizzes} completed
                </span>
              </div>
            </div>

            {/* "CONTINUE LEARNING" Highlight Box (Matching Image 2) */}
            {nextQuiz && (
              <div className="p-5 rounded-2xl bg-gradient-to-r from-[#1c1c1c] to-[#252525] border border-amber-500/30 shadow-xl relative overflow-hidden">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-400 border border-amber-500/40">
                        ⚡ Continue Learning
                      </span>
                      <span className="text-xs font-semibold text-gray-400">
                        Unit {nextQuiz.unit_number || 1}
                      </span>
                    </div>

                    <h3 className="text-lg font-bold text-white">
                      {nextQuiz.unit_number ? `${nextQuiz.unit_number}. ` : ""}
                      {nextQuiz.unit_title || nextQuiz.title}
                    </h3>

                    <div className="flex items-center gap-3 text-xs text-[#9CA3AF]">
                      <span>
                        {nextQuiz.question_count > 0
                          ? `${nextQuiz.question_count} Questions • ${nextQuiz.blank_count} Blanks`
                          : "Awaiting JSON upload"}
                      </span>
                      {nextQuiz.status === "ready" ? (
                        <span className="text-emerald-400 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Ready to play
                        </span>
                      ) : (
                        <span className="text-amber-400 flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" /> Pending JSON
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Highlight Box Actions */}
                  <div className="flex items-center gap-2.5 flex-wrap shrink-0">
                    {nextQuiz.status === "ready" && nextQuiz.question_count > 0 ? (
                      <>
                        <button
                          onClick={() => handleStartExamClick(nextQuiz)}
                          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-white text-black hover:bg-neutral-200 transition-colors shadow-md cursor-pointer"
                        >
                          <Play className="w-3.5 h-3.5 fill-black text-black" />
                          <span>Play Exam</span>
                        </button>
                        <button
                          onClick={() => handleStartPracticeClick(nextQuiz)}
                          className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-medium bg-[#2b2b2b] hover:bg-[#363636] text-white border border-[#3e3e3e] transition-colors cursor-pointer"
                        >
                          <BookOpen className="w-3.5 h-3.5" />
                          <span>Practice</span>
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => {
                          setTargetQuizForImport(nextQuiz);
                          setIsImportOpen(true);
                        }}
                        className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold bg-white text-black hover:bg-neutral-200 transition-colors shadow-md cursor-pointer"
                      >
                        <ClipboardPaste className="w-3.5 h-3.5 stroke-[2.5]" />
                        <span>Paste JSON Quiz</span>
                      </button>
                    )}

                    {nextQuiz.drive_file_id && (
                      <div className="flex items-center rounded-xl bg-[#242424] border border-blue-900/30 p-0.5">
                        <a
                          href={`https://drive.google.com/file/d/${nextQuiz.drive_file_id}/view`}
                          target="_blank"
                          rel="noreferrer"
                          title="Open PDF on Google Drive"
                          className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-blue-400 hover:text-blue-300 transition-colors"
                        >
                          <HardDrive className="w-3.5 h-3.5" />
                          <span>Drive PDF</span>
                        </a>
                        <CopyDriveLinkButton
                          fileId={nextQuiz.drive_file_id}
                          title="Copy Drive PDF link"
                          className="p-1.5 border-l border-blue-900/40 text-blue-400/80 hover:text-blue-200"
                        />
                      </div>
                    )}

                    {/* Link Prompt Chat - immediately to the right of Google Drive link */}
                    <a
                      href={promptChatUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-medium bg-[#1a291e] hover:bg-[#223627] text-emerald-400 border border-emerald-900/40 transition-colors cursor-pointer"
                      title="Open Prompt Chat"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Prompt Chat</span>
                      <ExternalLink className="w-3 h-3 text-emerald-500/70" />
                    </a>

                    {/* Second ChatGPT Link for this quiz (added & editable) */}
                    {nextQuiz.chatgpt_url ? (
                      <div className="flex items-center rounded-xl bg-[#142338] border border-blue-800/50 p-0.5 shadow-sm">
                        <a
                          href={nextQuiz.chatgpt_url}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-blue-400 hover:text-blue-300 transition-colors"
                          title={`Open Quiz ChatGPT: ${nextQuiz.chatgpt_url}`}
                        >
                          <Bot className="w-3.5 h-3.5 text-blue-400" />
                          <span>ChatGPT 2</span>
                          <ExternalLink className="w-3 h-3 text-blue-500/70" />
                        </a>
                        <button
                          type="button"
                          onClick={() => setQuizForChatEdit(nextQuiz)}
                          title="Edit ChatGPT Link for this quiz"
                          className="p-2 text-blue-400/70 hover:text-white hover:bg-blue-900/40 rounded-lg transition-colors cursor-pointer border-l border-blue-800/50"
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setQuizForChatEdit(nextQuiz)}
                        title="Add dedicated ChatGPT link for this quiz"
                        className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-medium bg-[#142338]/60 hover:bg-[#1a2c47] text-blue-400 border border-blue-900/40 transition-colors cursor-pointer"
                      >
                        <Bot className="w-3.5 h-3.5" />
                        <span>+ ChatGPT Link</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Curriculum Units Section (Matching Image 2) */}
            <div className="rounded-2xl bg-[#1c1c1c] border border-[#2e2e2e] p-6 shadow-xl space-y-5">
              {/* Filter Tabs & Search Bar */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#2e2e2e]">
                {/* Status Tabs */}
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setSelectedStatus("all")}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                      selectedStatus === "all"
                        ? "bg-white text-black shadow-sm"
                        : "bg-[#262626] text-gray-400 hover:text-white hover:bg-[#303030]"
                    }`}
                  >
                    All Units ({quizzes.length})
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedStatus("ready")}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                      selectedStatus === "ready"
                        ? "bg-emerald-500 text-white shadow-sm"
                        : "bg-[#262626] text-emerald-400/90 hover:text-emerald-300 hover:bg-[#303030]"
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Ready to Play ({readyCount})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedStatus("pending_import")}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                      selectedStatus === "pending_import"
                        ? "bg-amber-500 text-black shadow-sm"
                        : "bg-[#262626] text-amber-400/90 hover:text-amber-300 hover:bg-[#303030]"
                    }`}
                  >
                    <Clock className="w-3.5 h-3.5" />
                    <span>Awaiting JSON ({pendingCount})</span>
                  </button>
                </div>

                {/* Unit Search Bar */}
                <div className="relative w-full md:w-72">
                  <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search units by number or title..."
                    className="w-full bg-[#242424] border border-[#333333] rounded-xl pl-9 pr-8 py-1.5 text-xs text-[#ececec] placeholder-gray-500 focus:outline-none focus:border-white transition-colors"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Units Table / List (Matching Image 2 layout) */}
              {filteredQuizzes.length === 0 ? (
                <div className="py-12 text-center text-gray-400">
                  <p className="text-sm">No units match your filter criteria.</p>
                  <button
                    onClick={() => {
                      setSearchQuery("");
                      setSelectedStatus("all");
                    }}
                    className="mt-2 text-xs text-blue-400 hover:underline cursor-pointer"
                  >
                    Reset filters
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-[#2a2a2a]">
                  {filteredQuizzes.map((quiz) => {
                    const isReady = quiz.status === "ready" && quiz.question_count > 0;

                    return (
                      <div
                        key={quiz.id}
                        className="py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-[#232323]/50 px-2 rounded-xl transition-colors"
                      >
                        {/* Unit Index & Title */}
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-[#292929] text-gray-300 border border-[#383838] shrink-0">
                            Unit {quiz.unit_number ?? "—"}
                          </span>

                          <div className="min-w-0 flex-1">
                            <h4 className="text-sm font-semibold text-white truncate">
                              {quiz.unit_title || quiz.title}
                            </h4>

                            <div className="flex items-center gap-3 text-xs text-[#888888] mt-0.5">
                              {isReady ? (
                                <span className="text-emerald-400 font-medium">
                                  {quiz.question_count} Questions • {quiz.blank_count} Blanks
                                </span>
                              ) : (
                                <span className="text-amber-400/90 font-medium">
                                  Awaiting JSON upload
                                </span>
                              )}

                              {quiz.source_filename && (
                                <span className="hidden sm:inline truncate max-w-xs text-gray-500">
                                  • {quiz.source_filename}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Status Badge */}
                        <div className="flex items-center gap-2 shrink-0">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                              isReady
                                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                            }`}
                          >
                            {isReady ? "Ready" : "Pending JSON"}
                          </span>
                        </div>

                        {/* Actions (Play Exam, Practice, Drive PDF, Upload JSON, Delete) */}
                        <div className="flex items-center gap-2 shrink-0 flex-wrap">
                          {isReady ? (
                            <>
                              <button
                                onClick={() => handleStartExamClick(quiz)}
                                title="Start Timed Exam"
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white text-black hover:bg-neutral-200 transition-colors shadow-sm cursor-pointer"
                              >
                                <Play className="w-3 h-3 fill-black text-black" />
                                <span>Exam</span>
                              </button>

                              <button
                                onClick={() => handleStartPracticeClick(quiz)}
                                title="Practice with immediate feedback"
                                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-[#292929] hover:bg-[#333333] text-gray-200 border border-[#3d3d3d] transition-colors cursor-pointer"
                              >
                                <BookOpen className="w-3 h-3" />
                                <span>Practice</span>
                              </button>

                              <button
                                onClick={() => handleOpenQuizHistory(quiz)}
                                title="View attempt history & score statistics"
                                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-[#242424] hover:bg-[#303030] text-blue-400 hover:text-blue-300 border border-[#383838] transition-colors cursor-pointer"
                              >
                                <History className="w-3 h-3" />
                                <span>History</span>
                              </button>

                              <button
                                onClick={() => {
                                  setTargetQuizForImport(quiz);
                                  setIsImportOpen(true);
                                }}
                                title="Paste revised JSON"
                                className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-[#2c2c2c] transition-colors cursor-pointer"
                              >
                                <ClipboardPaste className="w-3.5 h-3.5" />
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => {
                                setTargetQuizForImport(quiz);
                                setIsImportOpen(true);
                              }}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white text-black hover:bg-neutral-200 transition-colors shadow-sm cursor-pointer"
                            >
                              <ClipboardPaste className="w-3 h-3 stroke-[2.5]" />
                              <span>Paste JSON</span>
                            </button>
                          )}

                          {quiz.drive_file_id && (
                            <div className="flex items-center rounded-lg bg-blue-950/20 border border-blue-900/30 p-0.5">
                              <a
                                href={`https://drive.google.com/file/d/${quiz.drive_file_id}/view`}
                                target="_blank"
                                rel="noreferrer"
                                title="Open original Drive PDF"
                                className="p-1.5 text-blue-400 hover:text-blue-300 rounded hover:bg-blue-950/40 transition-colors"
                              >
                                <HardDrive className="w-3.5 h-3.5" />
                              </a>
                              <CopyDriveLinkButton
                                fileId={quiz.drive_file_id}
                                title={`Copy Drive PDF link for Unit ${quiz.unit_number ?? ''}`}
                                className="p-1 border-l border-blue-900/40 text-blue-400/80 hover:text-blue-200"
                              />
                            </div>
                          )}

                          {/* Link Prompt Chat (display to the right of Google Drive link) */}
                          <a
                            href={promptChatUrl}
                            target="_blank"
                            rel="noreferrer"
                            title={`Open Prompt Chat for Unit ${quiz.unit_number ?? ''}`}
                            className="p-1.5 text-emerald-400 hover:text-emerald-300 rounded-lg hover:bg-emerald-950/30 transition-colors"
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                          </a>

                          {/* Second ChatGPT link for this quiz (added & editable) */}
                          {quiz.chatgpt_url ? (
                            <div className="flex items-center rounded-lg bg-[#142338] border border-blue-800/50 p-0.5">
                              <a
                                href={quiz.chatgpt_url}
                                target="_blank"
                                rel="noreferrer"
                                title={`Open Quiz ChatGPT Link: ${quiz.chatgpt_url}`}
                                className="p-1 text-blue-400 hover:text-blue-300 transition-colors flex items-center"
                              >
                                <Bot className="w-3.5 h-3.5" />
                              </a>
                              <button
                                type="button"
                                onClick={() => setQuizForChatEdit(quiz)}
                                title="Edit Quiz ChatGPT Link"
                                className="p-1 text-blue-400/70 hover:text-white hover:bg-blue-900/40 rounded transition-colors cursor-pointer border-l border-blue-800/40"
                              >
                                <Pencil className="w-2.5 h-2.5" />
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setQuizForChatEdit(quiz)}
                              title={`Add ChatGPT Link for Unit ${quiz.unit_number ?? ''}`}
                              className="p-1.5 text-gray-500 hover:text-blue-400 hover:bg-[#1a2333] rounded-lg transition-colors cursor-pointer border border-transparent hover:border-blue-900/40"
                            >
                              <Bot className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* Delete Quiz Button */}
                          <button
                            onClick={() => setQuizToDelete(quiz)}
                            title="Delete Quiz"
                            className="p-1.5 text-gray-400 hover:text-red-400 rounded-lg hover:bg-red-950/30 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Upload / Import Quiz JSON Modal */}
      <ImportModal
        isOpen={isImportOpen}
        targetCourseId={course?.id}
        targetQuizTitle={targetQuizForImport?.title}
        onClose={() => {
          setIsImportOpen(false);
          setTargetQuizForImport(null);
        }}
        onSuccess={() => loadCourse(true)}
      />

      {/* Edit Course Modal */}
      <EditCourseModal
        isOpen={isEditCourseOpen}
        onClose={() => setIsEditCourseOpen(false)}
        course={course}
        onSave={(updated) => {
          setCourse((prev) => (prev ? { ...prev, ...updated } : prev));
        }}
      />

      {/* Edit Quiz Dedicated ChatGPT Link Modal */}
      <EditQuizChatModal
        isOpen={Boolean(quizForChatEdit)}
        onClose={() => setQuizForChatEdit(null)}
        quiz={quizForChatEdit}
        onSave={(quizId, newUrl) => {
          setCourse((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              quizzes: prev.quizzes.map((q) =>
                q.id === quizId ? { ...q, chatgpt_url: newUrl } : q
              ),
            };
          });
        }}
      />

      {/* Delete Course Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={isDeleteCourseOpen}
        onClose={() => setIsDeleteCourseOpen(false)}
        onConfirm={handleConfirmDeleteCourse}
        title="Delete Course"
        itemName={course?.title || "this course"}
        itemType="Course"
        isDeleting={isDeletingCourse}
      />

      {/* Delete Quiz Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={!!quizToDelete}
        onClose={() => setQuizToDelete(null)}
        onConfirm={handleConfirmDeleteQuiz}
        title="Delete Quiz"
        itemName={quizToDelete?.title || "this quiz"}
        itemType="Quiz"
        isDeleting={isDeletingQuiz}
      />

      {/* Quiz Config Modal for Starting Exam */}
      <QuizConfigModal
        quiz={selectedQuizForStart}
        isOpen={isConfigOpen}
        isStarting={isStartingQuiz}
        onClose={() => {
          setIsConfigOpen(false);
          setIsStartingQuiz(false);
        }}
        onStart={(durationMinutes, mode) => {
          if (selectedQuizForStart) {
            executeStartAttempt(selectedQuizForStart, durationMinutes, mode);
          }
        }}
      />

      {/* Quiz Attempt History & Stats Modal */}
      <QuizHistoryModal
        quizId={historyQuiz?.id || null}
        quizTitle={historyQuiz?.title}
        isOpen={isHistoryModalOpen}
        onClose={() => {
          setIsHistoryModalOpen(false);
          setHistoryQuiz(null);
        }}
        onStartExam={(quizId) => {
          const target = course?.quizzes.find((q) => q.id === quizId);
          if (target) handleStartExamClick(target);
        }}
        onStartPractice={(quizId) => {
          const target = course?.quizzes.find((q) => q.id === quizId);
          if (target) handleStartPracticeClick(target);
        }}
      />
    </div>
  );
}
