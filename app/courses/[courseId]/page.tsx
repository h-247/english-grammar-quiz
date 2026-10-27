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
  Pencil,
  Star,
  Bookmark,
  ChevronDown,
  Check,
  Sparkles,
} from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { DeleteConfirmModal } from "@/components/DeleteConfirmModal";
import { QuizConfigModal } from "@/components/QuizConfigModal";
import { EditCourseModal } from "@/components/EditCourseModal";
import { CopyDriveLinkButton } from "@/components/CopyDriveLinkButton";
import { SharedPromptLinkSettings } from "@/components/SharedPromptLinkSettings";
import { ChatGPTLinkActions } from "@/components/ChatGPTLinkActions";
import { DEFAULT_COURSE_BANNER } from "@/lib/course-manifest";
import {
  getCourse,
  syncCourseDrive,
  deleteCourse,
  deleteQuiz,
  startAttempt,
  updateChapterStatus,
} from "@/lib/api";
import { CourseDetail, QuizSummary, ChapterStatus } from "@/types/quiz";
import { useToast } from "@/components/Toast";

export default function BookDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { showToast } = useToast();

  const courseId = ((params?.courseId || params?.bookId) as string) || "";

  // Book Data
  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Search & Status filters: All, To do, Doing, Done
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedStatus, setSelectedStatus] = useState<"all" | "To do" | "Doing" | "Done">("all");

  // Deletion Modals
  const [quizToDelete, setQuizToDelete] = useState<QuizSummary | null>(null);
  const [isDeletingQuiz, setIsDeletingQuiz] = useState<boolean>(false);

  const [isDeleteCourseOpen, setIsDeleteCourseOpen] = useState<boolean>(false);
  const [isDeletingCourse, setIsDeletingCourse] = useState<boolean>(false);
  const [isEditCourseOpen, setIsEditCourseOpen] = useState<boolean>(false);

  // Status updating state
  const [updatingChapterId, setUpdatingChapterId] = useState<string | null>(null);
  const [openStatusMenuId, setOpenStatusMenuId] = useState<string | null>(null);

  // Quiz Start Configuration Modal
  const [selectedQuizForStart, setSelectedQuizForStart] = useState<QuizSummary | null>(null);
  const [isConfigOpen, setIsConfigOpen] = useState<boolean>(false);
  const [isStartingQuiz, setIsStartingQuiz] = useState<boolean>(false);

  // Fetch book details
  const loadCourse = useCallback(async (isSilent = false) => {
    if (!courseId) return;
    if (!isSilent) setIsLoading(true);
    setError(null);

    try {
      const data = await getCourse(courseId);
      setCourse(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load book details.";
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    loadCourse();
  }, [loadCourse]);

  // Sync chapters with Google Drive
  const handleSyncDrive = async () => {
    if (!courseId || isSyncing) return;
    setIsSyncing(true);
    try {
      const updated = await syncCourseDrive(courseId, { forceRefresh: true });
      setCourse(updated);
      const chCount = updated.total_chapters || updated.total_quizzes || 0;
      showToast(
        `Synchronized chapters from Google Drive! (${chCount} chapters mapped)`,
        "success",
        5000
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to sync chapters with Drive.";
      showToast(msg, "error", 6000);
    } finally {
      setIsSyncing(false);
    }
  };

  // Delete Book
  const handleConfirmDeleteCourse = async () => {
    if (!course) return;
    setIsDeletingCourse(true);
    try {
      await deleteCourse(course.id);
      showToast(`Book "${course.title}" was deleted.`, "info", 5000);
      setIsDeleteCourseOpen(false);
      router.push("/");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to delete book.";
      showToast(msg, "error", 6000);
    } finally {
      setIsDeletingCourse(false);
    }
  };

  // Change Chapter Status: 'To do' | 'Doing' | 'Done'
  const handleStatusChange = async (chapterId: string, newStatus: ChapterStatus) => {
    setOpenStatusMenuId(null);
    setUpdatingChapterId(chapterId);

    // Optimistically update local state
    setCourse((prev) => {
      if (!prev) return prev;
      const updatedQuizzes = (prev.quizzes || prev.chapters || []).map((q) =>
        q.id === chapterId ? { ...q, status: newStatus, reading_status: newStatus } : q
      );

      const doneCount = updatedQuizzes.filter((q) => q.status === "Done").length;
      const doingCount = updatedQuizzes.filter((q) => q.status === "Doing").length;
      const todoCount = updatedQuizzes.filter((q) => q.status === "To do").length;

      return {
        ...prev,
        quizzes: updatedQuizzes,
        chapters: updatedQuizzes,
        done_chapters: doneCount,
        doing_chapters: doingCount,
        todo_chapters: todoCount,
        completed_quizzes: doneCount,
      };
    });

    try {
      await updateChapterStatus(chapterId, newStatus);
      showToast(`Chapter status updated to "${newStatus}"`, "success", 2500);
    } catch {
      showToast("Failed to update status", "error", 4000);
      loadCourse(true);
    } finally {
      setUpdatingChapterId(null);
    }
  };

  // Delete Chapter
  const handleConfirmDeleteQuiz = async () => {
    if (!quizToDelete) return;
    setIsDeletingQuiz(true);
    try {
      await deleteQuiz(quizToDelete.id);
      showToast(`Chapter "${quizToDelete.title}" deleted.`, "info", 4000);
      setQuizToDelete(null);
      await loadCourse(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to delete chapter.";
      showToast(msg, "error", 5000);
    } finally {
      setIsDeletingQuiz(false);
    }
  };

  // Start Chapter Practice / Quiz
  const handleStartExamClick = (quiz: QuizSummary) => {
    setSelectedQuizForStart(quiz);
    setIsConfigOpen(true);
  };

  const handleStartPracticeClick = async (quiz: QuizSummary) => {
    setIsStartingQuiz(true);
    try {
      const attempt = await startAttempt(quiz.id, 30, "practice");
      showToast("Practice session started!", "success", 3000);
      router.push(`/quiz/${quiz.id}/attempt/${attempt.id}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to start practice.";
      showToast(msg, "error", 5000);
    } finally {
      setIsStartingQuiz(false);
    }
  };

  const executeStartExam = async (durationMinutes: number) => {
    if (!selectedQuizForStart) return;
    setIsStartingQuiz(true);
    try {
      const attempt = await startAttempt(selectedQuizForStart.id, durationMinutes, "timed");
      showToast(`Timed session started! You have ${durationMinutes} minutes.`, "info", 4000);
      setIsConfigOpen(false);
      router.push(`/quiz/${selectedQuizForStart.id}/attempt/${attempt.id}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to start exam.";
      showToast(msg, "error", 5000);
    } finally {
      setIsStartingQuiz(false);
    }
  };

  const quizzes = useMemo(() => {
    return course?.chapters || course?.quizzes || [];
  }, [course]);

  const nextChapter = useMemo(() => {
    return (
      quizzes.find((q) => q.status === "Doing") ||
      quizzes.find((q) => q.status === "To do") ||
      quizzes[0] ||
      null
    );
  }, [quizzes]);

  // Status counts
  const totalChapters = quizzes.length;
  const doneCount = quizzes.filter((q) => q.status === "Done").length;
  const doingCount = quizzes.filter((q) => q.status === "Doing").length;
  const todoCount = quizzes.filter((q) => q.status !== "Done" && q.status !== "Doing").length;

  const bookStatus: ChapterStatus =
    totalChapters > 0 && doneCount >= totalChapters
      ? "Done"
      : doneCount > 0 || doingCount > 0
      ? "Doing"
      : "To do";

  const progressPercent = totalChapters > 0 ? Math.round((doneCount / totalChapters) * 100) : 0;

  // Filtered chapters
  const filteredQuizzes = useMemo(() => {
    return quizzes.filter((q) => {
      const query = searchQuery.trim().toLowerCase();
      const titleMatch =
        !query ||
        q.title.toLowerCase().includes(query) ||
        (q.unit_title && q.unit_title.toLowerCase().includes(query)) ||
        (q.unit_number != null && String(q.unit_number).includes(query));

      const statusMatch =
        selectedStatus === "all" ||
        (selectedStatus === "To do" && (q.status === "To do" || !q.status || q.status === "pending_import")) ||
        (selectedStatus === "Doing" && q.status === "Doing") ||
        (selectedStatus === "Done" && q.status === "Done");

      return titleMatch && statusMatch;
    });
  }, [quizzes, searchQuery, selectedStatus]);

  return (
    <div className="min-h-screen flex flex-col bg-[#212121] text-[#ececec]" suppressHydrationWarning>
      <Navbar driveConnected={true} />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6">
        {/* Breadcrumb Navigation */}
        <div className="flex items-center justify-between mb-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-xs font-medium text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Books</span>
          </Link>

          {course?.goodreads_url && (
            <a
              href={course.goodreads_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-300 hover:bg-amber-500/25 border border-amber-500/30 transition-colors"
            >
              <Bookmark className="w-3.5 h-3.5" />
              <span>Goodreads Page</span>
              <ExternalLink className="w-3 h-3 text-amber-400/80" />
            </a>
          )}
        </div>

        {/* Loading State */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-32 text-gray-400">
            <Loader2 className="w-8 h-8 animate-spin text-white mb-3" />
            <span className="text-sm">Loading book details...</span>
          </div>
        ) : error || !course ? (
          <div className="max-w-lg mx-auto p-6 bg-rose-950/30 border border-rose-500/40 rounded-2xl text-center space-y-3">
            <AlertCircle className="w-8 h-8 text-rose-400 mx-auto" />
            <h3 className="text-base font-semibold text-white">Book Not Found</h3>
            <p className="text-xs text-rose-300">{error || "Unable to retrieve book details."}</p>
            <Link
              href="/"
              className="inline-block px-4 py-2 rounded-xl text-xs font-semibold bg-[#2c2c2c] hover:bg-[#383838] text-white transition-colors"
            >
              Return to Book Library
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Book Hero Card */}
            <div className="rounded-2xl bg-[#1c1c1c] border border-[#2e2e2e] overflow-hidden shadow-2xl">
              <div className="relative h-56 md:h-64 w-full bg-[#141414]">
                <img
                  src={course.cover_url || course.banner_url || DEFAULT_COURSE_BANNER}
                  alt={course.title}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#1c1c1c] via-[#1c1c1c]/70 to-transparent" />

                <div className="absolute bottom-6 left-6 right-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
                  <div className="space-y-1.5 max-w-3xl">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-white/20 backdrop-blur-md text-white border border-white/20">
                        Book
                      </span>
                      <span
                        className={`flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold backdrop-blur-md border ${
                          bookStatus === "Done"
                            ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                            : bookStatus === "Doing"
                            ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                            : "bg-neutral-800/80 text-neutral-300 border-neutral-700"
                        }`}
                      >
                        {bookStatus === "Done" ? (
                          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                        ) : bookStatus === "Doing" ? (
                          <Clock className="w-3 h-3 text-amber-400" />
                        ) : (
                          <BookOpen className="w-3 h-3 text-neutral-400" />
                        )}
                        <span>{bookStatus}</span>
                      </span>
                      {course.rating && (
                        <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-black/70 backdrop-blur-md text-amber-300 border border-amber-500/40">
                          <Star className="w-3.5 h-3.5 fill-amber-300 text-amber-300" />
                          <span>{course.rating.toFixed(2)}</span>
                          {course.rating_count ? (
                            <span className="text-gray-400 text-[10px]">({course.rating_count.toLocaleString()})</span>
                          ) : null}
                        </span>
                      )}
                      {course.page_count && (
                        <span className="text-xs text-gray-300 bg-black/60 backdrop-blur-md px-2.5 py-0.5 rounded-full border border-white/10">
                          {course.page_count} pages
                        </span>
                      )}
                      {course.drive_folder_id && (
                        <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-950/80 backdrop-blur-md text-blue-300 border border-blue-500/30">
                          <HardDrive className="w-3 h-3 text-blue-400" />
                          <span>Drive Folder Linked</span>
                        </div>
                      )}
                    </div>

                    <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight leading-tight">
                      {course.title}
                    </h1>

                    {course.author && (
                      <p className="text-sm font-semibold text-amber-300">
                        by {course.author}
                      </p>
                    )}

                    {course.description && (
                      <p className="text-xs sm:text-sm text-gray-300 line-clamp-2 max-w-2xl leading-relaxed">
                        {course.description}
                      </p>
                    )}
                  </div>

                  {/* Actions Header */}
                  <div className="flex items-center gap-2 flex-wrap shrink-0">
                    <button
                      onClick={() => setIsEditCourseOpen(true)}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-[#282828] hover:bg-[#323232] text-gray-200 border border-[#3e3e3e] transition-all cursor-pointer"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      <span>Edit Book</span>
                    </button>

                    <button
                      onClick={handleSyncDrive}
                      disabled={isSyncing}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-[#262626] hover:bg-[#303030] text-gray-200 border border-[#383838] transition-all cursor-pointer disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin text-blue-400" : ""}`} />
                      <span>{isSyncing ? "Syncing..." : "Sync Drive Chapters"}</span>
                    </button>

                    <button
                      onClick={() => setIsDeleteCourseOpen(true)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-red-400 hover:text-red-300 hover:bg-red-950/30 border border-red-900/40 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete Book</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* 4 Metric / KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Card 1: Total Chapters */}
              <div className="p-5 rounded-2xl bg-[#1c1c1c] border border-[#2e2e2e] shadow-lg flex items-center justify-between">
                <div>
                  <span className="text-xs font-medium text-[#9CA3AF]">Total Chapters</span>
                  <p className="text-3xl font-extrabold text-white mt-1">{totalChapters}</p>
                  <span className="text-[11px] text-gray-500 mt-0.5 block">All book chapters</span>
                </div>
                <div className="p-3 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  <Layers className="w-6 h-6" />
                </div>
              </div>

              {/* Card 2: To do */}
              <div className="p-5 rounded-2xl bg-[#1c1c1c] border border-[#2e2e2e] shadow-lg flex items-center justify-between">
                <div>
                  <span className="text-xs font-medium text-gray-400">To do</span>
                  <p className="text-3xl font-extrabold text-gray-200 mt-1">{todoCount}</p>
                  <span className="text-[11px] text-gray-500 mt-0.5 block">Waiting to be read</span>
                </div>
                <div className="p-3 rounded-xl bg-neutral-800 text-neutral-300 border border-neutral-700">
                  <Clock className="w-6 h-6" />
                </div>
              </div>

              {/* Card 3: Doing */}
              <div className="p-5 rounded-2xl bg-[#1c1c1c] border border-[#2e2e2e] shadow-lg flex items-center justify-between">
                <div>
                  <span className="text-xs font-medium text-amber-400">Doing</span>
                  <p className="text-3xl font-extrabold text-amber-300 mt-1">{doingCount}</p>
                  <span className="text-[11px] text-gray-500 mt-0.5 block">In progress</span>
                </div>
                <div className="p-3 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  <BookOpen className="w-6 h-6" />
                </div>
              </div>

              {/* Card 4: Done */}
              <div className="p-5 rounded-2xl bg-[#1c1c1c] border border-[#2e2e2e] shadow-lg flex items-center justify-between">
                <div>
                  <span className="text-xs font-medium text-emerald-400">Done</span>
                  <p className="text-3xl font-extrabold text-emerald-400 mt-1">{doneCount}</p>
                  <span className="text-[11px] text-emerald-500/80 mt-0.5 block">
                    {progressPercent}% completed
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
              </div>
            </div>

            {/* Continue Reading / Next Chapter Banner */}
            {nextChapter && (
              <div className="p-5 sm:p-6 bg-gradient-to-r from-[#222222] to-[#1a1a1a] border border-amber-500/30 rounded-2xl shadow-xl space-y-3">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="flex items-center gap-1 font-bold text-amber-300">
                    <Sparkles className="w-3.5 h-3.5" />
                    CONTINUE READING
                  </span>
                  {nextChapter.unit_number != null && (
                    <span className="text-gray-400">Chapter {nextChapter.unit_number}</span>
                  )}
                  <span
                    className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                      nextChapter.status === "Doing"
                        ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                        : "bg-neutral-800 text-neutral-300 border border-neutral-700"
                    }`}
                  >
                    {nextChapter.status || "To do"}
                  </span>
                </div>

                <h2 className="text-lg sm:text-xl font-bold text-white">
                  {nextChapter.unit_number != null ? `${nextChapter.unit_number}. ` : ""}
                  {nextChapter.unit_title || nextChapter.title}
                </h2>

                <div className="flex flex-wrap items-center gap-3 text-xs text-gray-400">
                  {nextChapter.instructions && <span>{nextChapter.instructions}</span>}
                  {nextChapter.drive_file_id && (
                    <a
                      href={`https://drive.google.com/file/d/${nextChapter.drive_file_id}/view`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-blue-400 hover:text-blue-300 transition-colors"
                    >
                      <HardDrive className="w-3.5 h-3.5" />
                      <span>View in Drive</span>
                    </a>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => handleStatusChange(nextChapter.id, "Done")}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-900/50 transition-colors cursor-pointer"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Mark as Done</span>
                  </button>

                  {nextChapter.status !== "Doing" && (
                    <button
                      type="button"
                      onClick={() => handleStatusChange(nextChapter.id, "Doing")}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-950/40 border border-amber-500/40 text-amber-300 hover:bg-amber-900/50 transition-colors cursor-pointer"
                    >
                      <span>Mark as Doing</span>
                    </button>
                  )}

                  {nextChapter.drive_file_id && (
                    <a
                      href={`https://drive.google.com/file/d/${nextChapter.drive_file_id}/view`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white text-black hover:bg-neutral-200 transition-colors"
                    >
                      <BookOpen className="w-3.5 h-3.5" />
                      <span>Read Chapter</span>
                    </a>
                  )}

                  <SharedPromptLinkSettings compact canEdit={false} />

                  <ChatGPTLinkActions
                    url={nextChapter.chatgpt_url}
                    chapterId={nextChapter.id}
                    chapterTitle={nextChapter.unit_title || nextChapter.title}
                    onSaved={(newUrl) => {
                      setCourse((prev) => {
                        if (!prev) return prev;
                        const updated = (prev.chapters || prev.quizzes || []).map((q) =>
                          q.id === nextChapter.id ? { ...q, chatgpt_url: newUrl } : q
                        );
                        return { ...prev, chapters: updated, quizzes: updated };
                      });
                    }}
                  />
                </div>
              </div>
            )}

            {/* Chapters Section */}
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
                    All Chapters ({totalChapters})
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedStatus("To do")}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                      selectedStatus === "To do"
                        ? "bg-neutral-200 text-black shadow-sm"
                        : "bg-[#262626] text-neutral-300 hover:text-white hover:bg-[#303030]"
                    }`}
                  >
                    <Clock className="w-3.5 h-3.5" />
                    <span>To do ({todoCount})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedStatus("Doing")}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                      selectedStatus === "Doing"
                        ? "bg-amber-500 text-black shadow-sm"
                        : "bg-[#262626] text-amber-400/90 hover:text-amber-300 hover:bg-[#303030]"
                    }`}
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>Doing ({doingCount})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedStatus("Done")}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                      selectedStatus === "Done"
                        ? "bg-emerald-500 text-white shadow-sm"
                        : "bg-[#262626] text-emerald-400/90 hover:text-emerald-300 hover:bg-[#303030]"
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Done ({doneCount})</span>
                  </button>
                </div>

                {/* Chapter Search Bar */}
                <div className="relative w-full md:w-72">
                  <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search chapters by number or title..."
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

              {/* Chapters List */}
              {filteredQuizzes.length === 0 ? (
                <div className="py-12 text-center text-gray-400">
                  <p className="text-sm">No chapters match your filter criteria.</p>
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
                    const chapterStatus = (quiz.status || "To do") as ChapterStatus;
                    const hasQuestions = quiz.question_count > 0;

                    return (
                      <div
                        key={quiz.id}
                        className="py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-[#232323]/50 px-2 rounded-xl transition-colors"
                      >
                        {/* Chapter Index & Title */}
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-[#292929] text-gray-300 border border-[#383838] shrink-0">
                            {quiz.unit_number != null ? `Ch. ${quiz.unit_number}` : "Ch."}
                          </span>

                          <div className="min-w-0 flex-1">
                            <h4 className="text-sm font-semibold text-white truncate">
                              {quiz.unit_title || quiz.title}
                            </h4>

                            <div className="flex items-center gap-3 text-xs text-[#888888] mt-0.5">
                              {quiz.instructions && (
                                <span className="text-gray-400">
                                  {quiz.instructions}
                                </span>
                              )}

                              {hasQuestions && (
                                <span className="text-emerald-400 font-medium">
                                  • {quiz.question_count} Questions
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

                        {/* Interactive Status Switcher: To do, Doing, Done */}
                        <div className="relative shrink-0">
                          <button
                            type="button"
                            onClick={() =>
                              setOpenStatusMenuId(openStatusMenuId === quiz.id ? null : quiz.id)
                            }
                            disabled={updatingChapterId === quiz.id}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                              chapterStatus === "Done"
                                ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/25"
                                : chapterStatus === "Doing"
                                ? "bg-amber-500/15 text-amber-300 border-amber-500/30 hover:bg-amber-500/25"
                                : "bg-neutral-800 text-neutral-300 border-neutral-700 hover:bg-neutral-700"
                            }`}
                            title="Click to change chapter status"
                          >
                            {updatingChapterId === quiz.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : chapterStatus === "Done" ? (
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                            ) : chapterStatus === "Doing" ? (
                              <BookOpen className="w-3.5 h-3.5 text-amber-400" />
                            ) : (
                              <Clock className="w-3.5 h-3.5 text-neutral-400" />
                            )}
                            <span>{chapterStatus}</span>
                            <ChevronDown className="w-3 h-3 ml-0.5 opacity-60" />
                          </button>

                          {/* Dropdown Menu */}
                          {openStatusMenuId === quiz.id && (
                            <div className="absolute right-0 mt-1 w-36 bg-[#1f1f1f] border border-[#383838] rounded-xl shadow-2xl py-1 z-30 animate-in fade-in zoom-in-95 duration-100">
                              {(["To do", "Doing", "Done"] as ChapterStatus[]).map((st) => (
                                <button
                                  key={st}
                                  type="button"
                                  onClick={() => handleStatusChange(quiz.id, st)}
                                  className={`w-full flex items-center justify-between px-3 py-1.5 text-xs font-semibold hover:bg-[#2b2b2b] transition-colors ${
                                    chapterStatus === st
                                      ? st === "Done"
                                        ? "text-emerald-400"
                                        : st === "Doing"
                                        ? "text-amber-400"
                                        : "text-white"
                                      : "text-gray-300"
                                  }`}
                                >
                                  <span>{st}</span>
                                  {chapterStatus === st && <Check className="w-3.5 h-3.5" />}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Chapter Actions: Drive PDF, Practice, Delete (NO PASTE JSON) */}
                        <div className="flex items-center gap-2 shrink-0 flex-wrap">
                          {quiz.drive_file_id && (
                            <div className="flex items-center rounded-lg bg-blue-950/20 border border-blue-900/30 p-0.5">
                              <a
                                href={`https://drive.google.com/file/d/${quiz.drive_file_id}/view`}
                                target="_blank"
                                rel="noreferrer"
                                title="Open chapter PDF in Google Drive"
                                className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-blue-400 hover:text-blue-300 rounded hover:bg-blue-950/40 transition-colors"
                              >
                                <HardDrive className="w-3.5 h-3.5" />
                                <span>Drive PDF</span>
                              </a>
                              <CopyDriveLinkButton
                                fileId={quiz.drive_file_id}
                                title={`Copy Drive link for Chapter ${quiz.unit_number ?? ""}`}
                                className="p-1 border-l border-blue-900/40 text-blue-400/80 hover:text-blue-200"
                              />
                            </div>
                          )}

                          {hasQuestions && (
                            <>
                              <button
                                onClick={() => handleStartExamClick(quiz)}
                                title="Start Timed Session"
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
                            </>
                          )}

                          <button
                            onClick={() => setQuizToDelete(quiz)}
                            title="Delete this chapter"
                            className="p-1.5 text-gray-500 hover:text-red-400 rounded-lg hover:bg-red-950/20 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>

                          {/* Shared Prompt Link Pill */}
                          <SharedPromptLinkSettings compact canEdit={false} />

                          {/* Chapter ChatGPT Conversation Pill */}
                          <ChatGPTLinkActions
                            url={quiz.chatgpt_url}
                            chapterId={quiz.id}
                            chapterTitle={quiz.unit_title || quiz.title}
                            onSaved={(newUrl) => {
                              setCourse((prev) => {
                                if (!prev) return prev;
                                const updated = (prev.chapters || prev.quizzes || []).map((q) =>
                                  q.id === quiz.id ? { ...q, chatgpt_url: newUrl } : q
                                );
                                return { ...prev, chapters: updated, quizzes: updated };
                              });
                            }}
                          />
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

      {/* Delete Book Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={isDeleteCourseOpen}
        onClose={() => setIsDeleteCourseOpen(false)}
        onConfirm={handleConfirmDeleteCourse}
        title={`Delete Book: ${course?.title || ""}`}
        description="Are you sure you want to permanently delete this book and all its chapters? This action cannot be undone."
        isDeleting={isDeletingCourse}
      />

      {/* Delete Chapter Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={!!quizToDelete}
        onClose={() => setQuizToDelete(null)}
        onConfirm={handleConfirmDeleteQuiz}
        title={`Delete Chapter: ${quizToDelete?.title || ""}`}
        description="Are you sure you want to delete this chapter?"
        isDeleting={isDeletingQuiz}
      />

      {/* Edit Book Modal */}
      {course && (
        <EditCourseModal
          isOpen={isEditCourseOpen}
          onClose={() => setIsEditCourseOpen(false)}
          course={course}
          onSuccess={() => loadCourse(true)}
        />
      )}

      {/* Quiz Config Modal */}
      {selectedQuizForStart && (
        <QuizConfigModal
          isOpen={isConfigOpen}
          onClose={() => setIsConfigOpen(false)}
          quizTitle={selectedQuizForStart.title}
          unitNumber={selectedQuizForStart.unit_number}
          onStart={executeStartExam}
          isStarting={isStartingQuiz}
        />
      )}
    </div>
  );
}
