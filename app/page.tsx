"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Search,
  X,
  Layers,
  RefreshCw,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { CourseCard } from "@/components/CourseCard";
import { ImportCourseModal } from "@/components/ImportCourseModal";
import { DeleteConfirmModal } from "@/components/DeleteConfirmModal";
import { QuizConfigModal } from "@/components/QuizConfigModal";
import { EditCourseModal } from "@/components/EditCourseModal";
import { QuizHistoryModal } from "@/components/QuizHistoryModal";
import {
  getCourses,
  getQuizzes,
  createCourse,
  deleteCourse,
  syncCourseDrive,
  startAttempt,
} from "@/lib/api";
import { CourseSummary, QuizSummary, LearningStatus } from "@/types/quiz";
import { useToast } from "@/components/Toast";

export default function CoursesDashboardPage() {
  const router = useRouter();
  const { showToast } = useToast();

  // Courses & Quizzes Data
  const [courses, setCourses] = useState<CourseSummary[]>([]);
  const [quizzes, setQuizzes] = useState<QuizSummary[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Search
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Modals state
  const [isImportCourseOpen, setIsImportCourseOpen] = useState<boolean>(false);
  const [courseToDelete, setCourseToDelete] = useState<CourseSummary | null>(null);
  const [isDeletingCourse, setIsDeletingCourse] = useState<boolean>(false);
  const [courseToEdit, setCourseToEdit] = useState<CourseSummary | null>(null);

  // Quiz Start modal state
  const [selectedQuizForStart, setSelectedQuizForStart] = useState<QuizSummary | null>(null);
  const [isQuizConfigOpen, setIsQuizConfigOpen] = useState<boolean>(false);
  const [isStartingQuiz, setIsStartingQuiz] = useState<boolean>(false);

  // History modal state
  const [historyQuiz, setHistoryQuiz] = useState<QuizSummary | null>(null);

  // Load all courses and quizzes
  const loadData = useCallback(async (isSilent = false) => {
    if (!isSilent) setIsLoading(true);
    else setIsRefreshing(true);
    setError(null);

    try {
      const [coursesData, quizzesData] = await Promise.all([
        getCourses(),
        getQuizzes(),
      ]);
      setCourses(coursesData);
      setQuizzes(quizzesData);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load courses data.";
      setError(msg);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Group quizzes by courseId
  const quizzesByCourse = useMemo(() => {
    const map = new Map<string, QuizSummary[]>();
    quizzes.forEach((q) => {
      if (q.course_id) {
        if (!map.has(q.course_id)) {
          map.set(q.course_id, []);
        }
        map.get(q.course_id)!.push(q);
      }
    });
    // Sort quizzes by unit number ascending
    map.forEach((list) => {
      list.sort((a, b) => (a.unit_number ?? 999) - (b.unit_number ?? 999));
    });
    return map;
  }, [quizzes]);


  // Filtered courses by search query
  const filteredCourses = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return courses;
    return courses.filter((c) => {
      const titleMatch = c.title.toLowerCase().includes(q);
      const descMatch = c.description?.toLowerCase().includes(q) ?? false;
      return titleMatch || descMatch;
    });
  }, [courses, searchQuery]);

  // Handle Sync Course with Drive
  const handleSyncDrive = async (courseId: string) => {
    try {
      const updated = await syncCourseDrive(courseId);
      showToast(
        `Synchronized "${updated.title}" with Google Drive! (${updated.total_quizzes} units mapped)`,
        "success",
        5000
      );
      await loadData(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to sync course with Drive.";
      showToast(msg, "error", 6000);
      throw err;
    }
  };

  // Handle Delete Course Modal
  const handleDeleteCourseClick = (course: CourseSummary) => {
    setCourseToDelete(course);
  };

  const handleConfirmDeleteCourse = async () => {
    if (!courseToDelete) return;
    setIsDeletingCourse(true);
    try {
      await deleteCourse(courseToDelete.id);
      showToast(`Course "${courseToDelete.title}" and its quizzes were deleted.`, "info", 5000);
      setCourseToDelete(null);
      await loadData(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to delete course.";
      showToast(msg, "error", 6000);
    } finally {
      setIsDeletingCourse(false);
    }
  };

  // Handle Start Quiz from Next Unit highlight
  const handleStartQuiz = (quiz: QuizSummary, mode: "timed" | "practice") => {
    setSelectedQuizForStart(quiz);
    if (mode === "practice") {
      // Direct start practice mode
      executeStartQuiz(quiz, 30, "practice");
    } else {
      // Open config modal for timed exam
      setIsQuizConfigOpen(true);
    }
  };

  const executeStartQuiz = async (
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
      setIsQuizConfigOpen(false);
      router.push(`/quiz/${quiz.id}/attempt/${attempt.id}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to start quiz attempt.";
      showToast(msg, "error", 5000);
      setIsStartingQuiz(false);
    }
  };

  const handleQuizStatusChange = (quizId: string, newStatus: LearningStatus) => {
    setQuizzes((prev) =>
      prev.map((q) => (q.id === quizId ? { ...q, learning_status: newStatus } : q))
    );
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#212121] text-[#ececec]" suppressHydrationWarning>
      {/* Top Navigation */}
      <Navbar
        onOpenImportCourse={() => setIsImportCourseOpen(true)}
        driveConnected={true}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-5">
        {/* Single Line Header */}
        <div className="flex items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-2.5">
            <h1 className="text-lg font-bold text-white tracking-tight">Courses</h1>
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-[#2a2a2a] text-gray-300 border border-[#3d3d3d]">
              {courses.length}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative w-52 sm:w-64">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search courses..."
                className="w-full bg-[#1b1b1b] border border-[#333333] rounded-xl pl-8 pr-7 py-1.5 text-xs text-[#ececec] placeholder-gray-500 focus:outline-none focus:border-white transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <button
              onClick={() => loadData(true)}
              disabled={isRefreshing}
              title="Refresh courses"
              className="p-1.5 rounded-xl bg-[#1b1b1b] border border-[#333333] hover:border-gray-500 text-gray-300 hover:text-white transition-all cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin text-blue-400" : ""}`} />
            </button>

            <button
              onClick={() => setIsImportCourseOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white text-black hover:bg-neutral-200 transition-all shadow-sm cursor-pointer shrink-0"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              <span className="hidden sm:inline">Import Course</span>
            </button>
          </div>
        </div>

        {/* Content Loading / Error / Grid */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-24 text-gray-400">
            <Loader2 className="w-8 h-8 animate-spin text-white mb-3" />
            <span className="text-sm">Loading course catalog...</span>
          </div>
        ) : error ? (
          <div className="max-w-lg mx-auto p-6 bg-rose-950/30 border border-rose-500/40 rounded-2xl text-center space-y-3">
            <AlertCircle className="w-8 h-8 text-rose-400 mx-auto" />
            <h3 className="text-base font-semibold text-white">Failed to load courses</h3>
            <p className="text-xs text-rose-300">{error}</p>
            <button
              onClick={() => loadData()}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#2c2c2c] hover:bg-[#383838] text-white transition-colors cursor-pointer"
            >
              Try Again
            </button>
          </div>
        ) : courses.length === 0 ? (
          /* Empty State - No Courses */
          <div className="max-w-md mx-auto py-20 px-6 text-center bg-[#1c1c1c] border border-[#2e2e2e] rounded-2xl shadow-xl space-y-5">
            <div className="w-16 h-16 rounded-2xl bg-[#262626] border border-[#383838] flex items-center justify-center text-white mx-auto shadow-inner">
              <Layers className="w-8 h-8 text-blue-400" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">No courses yet</h3>
              <p className="text-xs text-[#9CA3AF] mt-1.5 leading-relaxed">
                Import your first English Grammar course directly from Google Drive to get started with units and quizzes.
              </p>
            </div>
            <button
              onClick={() => setIsImportCourseOpen(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-white text-black hover:bg-neutral-200 transition-all shadow-md cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>Import Course from Google Drive</span>
            </button>
          </div>
        ) : filteredCourses.length === 0 ? (
          /* Empty Search State */
          <div className="max-w-md mx-auto py-16 px-6 text-center bg-[#1c1c1c] border border-[#2e2e2e] rounded-2xl space-y-3">
            <Search className="w-8 h-8 text-gray-400 mx-auto" />
            <h3 className="text-base font-semibold text-white">No matching courses</h3>
            <p className="text-xs text-gray-400">
              No courses found matching "{searchQuery}".
            </p>
            <button
              onClick={() => setSearchQuery("")}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#2a2a2a] hover:bg-[#333333] text-white transition-colors cursor-pointer"
            >
              Clear Search
            </button>
          </div>
        ) : (
          /* Courses Cards Grid (Matching Image 1) */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCourses.map((course) => (
              <CourseCard
                key={course.id}
                course={course}
                quizzes={quizzesByCourse.get(course.id) || []}
                onSyncDrive={handleSyncDrive}
                onDeleteCourse={handleDeleteCourseClick}
                onEditCourse={(c) => setCourseToEdit(c)}
                onStartQuiz={handleStartQuiz}
                onViewHistory={(q) => setHistoryQuiz(q)}
                onStatusChange={handleQuizStatusChange}
              />
            ))}
          </div>
        )}
      </main>

      {/* Import Course Modal */}
      <ImportCourseModal
        isOpen={isImportCourseOpen}
        onClose={() => setIsImportCourseOpen(false)}
        onCreateCourse={createCourse}
        onImportSuccess={async (newCourseId) => {
          showToast("Course imported and synchronized successfully!", "success", 5000);
          await loadData(true);
          router.push(`/courses/${newCourseId}`);
        }}
      />

      {/* Edit Course Modal */}
      <EditCourseModal
        isOpen={!!courseToEdit}
        onClose={() => setCourseToEdit(null)}
        course={courseToEdit}
        onSave={async (updated) => {
          setCourses((prev) =>
            prev.map((c) => (c.id === updated.id ? { ...c, ...updated } : c))
          );
        }}
      />

      {/* Delete Course Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={!!courseToDelete}
        onClose={() => setCourseToDelete(null)}
        onConfirm={handleConfirmDeleteCourse}
        title="Delete Course"
        itemName={courseToDelete?.title || ""}
        itemType="Course"
        isDeleting={isDeletingCourse}
      />

      {/* Quiz Config Modal for Starting Timed Quiz */}
      <QuizConfigModal
        quiz={selectedQuizForStart}
        isOpen={isQuizConfigOpen}
        isStarting={isStartingQuiz}
        onClose={() => {
          setIsQuizConfigOpen(false);
          setIsStartingQuiz(false);
        }}
        onStart={(durationMinutes, mode) => {
          if (selectedQuizForStart) {
            executeStartQuiz(selectedQuizForStart, durationMinutes, mode);
          }
        }}
      />

      {/* Quiz Attempt History Modal */}
      <QuizHistoryModal
        isOpen={Boolean(historyQuiz)}
        onClose={() => setHistoryQuiz(null)}
        quizId={historyQuiz?.id || null}
        quizTitle={historyQuiz?.title}
        onStartExam={() => {
          if (historyQuiz) handleStartQuiz(historyQuiz, "timed");
        }}
        onStartPractice={() => {
          if (historyQuiz) handleStartQuiz(historyQuiz, "practice");
        }}
      />
    </div>
  );
}
