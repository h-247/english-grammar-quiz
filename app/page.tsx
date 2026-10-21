"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Upload, Layers, Loader2, AlertCircle, Search, X, Tag, CheckCircle2, Clock } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { CourseHeader } from "@/components/CourseHeader";
import { QuizCard } from "@/components/QuizCard";
import { ImportModal } from "@/components/ImportModal";
import { QuizConfigModal } from "@/components/QuizConfigModal";
import { getCourses, getQuizzes, startAttempt, deleteQuiz, syncCourseDrive } from "@/lib/api";
import { CourseSummary, QuizSummary } from "@/types/quiz";
import { useToast } from "@/components/Toast";

export default function QuizLibraryPage() {
  const router = useRouter();
  const { showToast } = useToast();

  // Course State
  const [courses, setCourses] = useState<CourseSummary[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<CourseSummary | null>(null);

  // Quizzes State
  const [quizzes, setQuizzes] = useState<QuizSummary[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Search and Filtering State
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedStatus, setSelectedStatus] = useState<"all" | "ready" | "pending_import">("all");
  const [selectedTopic, setSelectedTopic] = useState<string>("all");
  const [selectedUnit, setSelectedUnit] = useState<string>("all");

  // Modals State
  const [isImportOpen, setIsImportOpen] = useState<boolean>(false);
  const [targetQuizForImport, setTargetQuizForImport] = useState<QuizSummary | null>(null);
  const [selectedQuiz, setSelectedQuiz] = useState<QuizSummary | null>(null);
  const [isConfigOpen, setIsConfigOpen] = useState<boolean>(false);
  const [isStarting, setIsStarting] = useState<boolean>(false);

  const loadData = useCallback(async (courseId?: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const courseList = await getCourses();
      setCourses(courseList);

      const activeCourse = courseId
        ? courseList.find((c) => c.id === courseId) || courseList[0] || null
        : courseList[0] || null;
      setSelectedCourse(activeCourse);

      const quizList = await getQuizzes(activeCourse ? { course_id: activeCourse.id } : undefined);
      setQuizzes(quizList);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load course quizzes.";
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSelectCourse = async (course: CourseSummary) => {
    setSelectedCourse(course);
    setIsLoading(true);
    try {
      const quizList = await getQuizzes({ course_id: course.id });
      setQuizzes(quizList);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load quizzes for course.";
      showToast(msg, "error", 5000);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSyncDrive = async () => {
    if (!selectedCourse) return;
    try {
      const updatedCourseDetail = await syncCourseDrive(selectedCourse.id);
      showToast(
        `Synchronized "${updatedCourseDetail.title}" with Google Drive! (${updatedCourseDetail.total_quizzes} units mapped)`,
        "success",
        5000
      );
      await loadData(selectedCourse.id);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to sync course with Google Drive.";
      showToast(msg, "error", 6000);
    }
  };

  // Extract unique topics and units for filtering
  const allTopics = useMemo(() => {
    const topicMap = new Map<string, string>();
    quizzes.forEach((quiz) => {
      quiz.topics?.forEach((t) => {
        if (!topicMap.has(t.id)) {
          topicMap.set(t.id, t.title);
        }
      });
    });
    return Array.from(topicMap.entries()).map(([id, title]) => ({ id, title }));
  }, [quizzes]);

  const allUnits = useMemo(() => {
    const units = new Set<number>();
    quizzes.forEach((quiz) => {
      if (quiz.unit_number !== null && quiz.unit_number !== undefined) {
        units.add(quiz.unit_number);
      }
    });
    return Array.from(units).sort((a, b) => a - b);
  }, [quizzes]);

  // Counts for status tabs
  const readyCount = useMemo(() => {
    return quizzes.filter((q) => q.status === "ready" && q.question_count > 0).length;
  }, [quizzes]);

  const pendingCount = useMemo(() => {
    return quizzes.filter((q) => q.status === "pending_import" || q.question_count === 0).length;
  }, [quizzes]);

  // Filtered Quizzes
  const filteredQuizzes = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return quizzes.filter((quiz) => {
      // 1. Status Filter
      if (selectedStatus === "ready") {
        if (quiz.status !== "ready" || quiz.question_count === 0) return false;
      } else if (selectedStatus === "pending_import") {
        if (quiz.status === "ready" && quiz.question_count > 0) return false;
      }

      // 2. Search Query filter
      if (query) {
        const titleMatch = quiz.title?.toLowerCase().includes(query);
        const unitTitleMatch = quiz.unit_title?.toLowerCase().includes(query);
        const instructionsMatch = quiz.instructions?.toLowerCase().includes(query);
        const topicMatch = quiz.topics?.some((t) => t.title.toLowerCase().includes(query));

        if (!titleMatch && !unitTitleMatch && !instructionsMatch && !topicMatch) {
          return false;
        }
      }

      // 3. Topic filter
      if (selectedTopic !== "all") {
        const hasTopic = quiz.topics?.some((t) => t.id === selectedTopic);
        if (!hasTopic) return false;
      }

      // 4. Unit filter
      if (selectedUnit !== "all") {
        if (quiz.unit_number?.toString() !== selectedUnit) {
          return false;
        }
      }

      return true;
    });
  }, [quizzes, selectedStatus, searchQuery, selectedTopic, selectedUnit]);

  const hasActiveFilters =
    searchQuery.trim() !== "" ||
    selectedStatus !== "all" ||
    selectedTopic !== "all" ||
    selectedUnit !== "all";

  const clearFilters = () => {
    setSearchQuery("");
    setSelectedStatus("all");
    setSelectedTopic("all");
    setSelectedUnit("all");
  };

  const handleStartClick = (quiz: QuizSummary) => {
    setSelectedQuiz(quiz);
    setIsConfigOpen(true);
  };

  const handleUploadJsonForQuiz = (quiz: QuizSummary) => {
    setTargetQuizForImport(quiz);
    setIsImportOpen(true);
  };

  const handleDeleteQuiz = async (quiz: QuizSummary) => {
    try {
      await deleteQuiz(quiz.id);
      showToast(`Quiz "${quiz.title}" deleted successfully.`, "info", 4000);
      await loadData(selectedCourse?.id);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to delete quiz.";
      showToast(msg, "error", 5000);
    }
  };

  const handleConfirmStart = async (durationMinutes: number, mode: "timed" | "practice") => {
    if (!selectedQuiz) return;
    setIsStarting(true);
    try {
      const attempt = await startAttempt(selectedQuiz.id, durationMinutes, mode);
      if (mode === "timed") {
        showToast(`Timed quiz started! You have ${durationMinutes} minutes.`, "info", 4000);
      } else {
        showToast("Self-paced practice started! Immediate feedback active.", "success", 4000);
      }
      setIsConfigOpen(false);
      router.push(`/quiz/${selectedQuiz.id}/attempt/${attempt.id}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to start quiz attempt.";
      showToast(msg, "error", 5000);
      setIsStarting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#212121]">
      <Navbar
        onOpenImport={() => {
          setTargetQuizForImport(null);
          setIsImportOpen(true);
        }}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-8">
        {/* Course Header Banner */}
        {selectedCourse && (
          <CourseHeader
            courses={courses}
            selectedCourse={selectedCourse}
            onSelectCourse={handleSelectCourse}
            onSyncDrive={handleSyncDrive}
            onOpenImport={() => {
              setTargetQuizForImport(null);
              setIsImportOpen(true);
            }}
          />
        )}

        {/* Search, Status Tabs, and Filter Bar */}
        {quizzes.length > 0 && (
          <div className="mb-6 space-y-4">
            {/* Status Filter Tabs */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#383838] pb-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedStatus("all")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    selectedStatus === "all"
                      ? "bg-white text-black shadow-sm"
                      : "bg-[#262626] text-gray-400 hover:text-white hover:bg-[#333333]"
                  }`}
                >
                  All Units ({quizzes.length})
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedStatus("ready")}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    selectedStatus === "ready"
                      ? "bg-emerald-500 text-white shadow-sm"
                      : "bg-[#262626] text-emerald-400/90 hover:text-emerald-300 hover:bg-[#333333]"
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Ready to Play ({readyCount})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedStatus("pending_import")}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    selectedStatus === "pending_import"
                      ? "bg-amber-500 text-black shadow-sm"
                      : "bg-[#262626] text-amber-400/90 hover:text-amber-300 hover:bg-[#333333]"
                  }`}
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>Awaiting JSON ({pendingCount})</span>
                </button>
              </div>

              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-gray-400 hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-3 h-3" />
                  <span>Reset Filters</span>
                </button>
              )}
            </div>

            {/* Search Box and Unit Selector */}
            <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
              {/* Search Box */}
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-[#9CA3AF] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search quizzes by unit, title, topics, or instructions..."
                  className="w-full bg-[#262626] border border-[#383838] rounded-xl pl-9 pr-9 py-2 text-sm text-[#ECECEC] placeholder-[#6B7280] focus:outline-none focus:border-white transition-colors"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#ECECEC] cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Unit Dropdown */}
              {allUnits.length > 1 && (
                <div className="flex items-center gap-2">
                  <select
                    value={selectedUnit}
                    onChange={(e) => setSelectedUnit(e.target.value)}
                    className="bg-[#262626] border border-[#383838] rounded-xl px-3 py-2 text-sm text-[#ECECEC] focus:outline-none focus:border-white cursor-pointer"
                  >
                    <option value="all">All Units ({allUnits.length})</option>
                    {allUnits.map((u) => (
                      <option key={u} value={u.toString()}>
                        Unit {u}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Topic Filter Pills */}
            {allTopics.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                <span className="text-[#9CA3AF] font-medium flex items-center gap-1 mr-1">
                  <Tag className="w-3.5 h-3.5" />
                  <span>Topic:</span>
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedTopic("all")}
                  className={`px-2.5 py-1 rounded-lg border transition-all cursor-pointer font-medium ${
                    selectedTopic === "all"
                      ? "bg-white text-black border-white shadow-sm"
                      : "bg-[#1E1E1E] border-[#383838] text-[#9CA3AF] hover:text-[#ECECEC] hover:border-[#555555]"
                  }`}
                >
                  All ({quizzes.length})
                </button>
                {allTopics.map((topic) => {
                  const isSelected = selectedTopic === topic.id;
                  return (
                    <button
                      key={topic.id}
                      type="button"
                      onClick={() => setSelectedTopic(isSelected ? "all" : topic.id)}
                      className={`px-2.5 py-1 rounded-lg border transition-all cursor-pointer font-medium ${
                        isSelected
                          ? "bg-white text-black border-white shadow-sm"
                          : "bg-[#1E1E1E] border-[#383838] text-[#9CA3AF] hover:text-[#ECECEC] hover:border-[#555555]"
                      }`}
                    >
                      {topic.title}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Filter Stats */}
            {hasActiveFilters && (
              <div className="text-xs text-[#9CA3AF] pt-1">
                Showing {filteredQuizzes.length} of {quizzes.length} quizzes in this course
              </div>
            )}
          </div>
        )}

        {/* Content Area */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 text-[#9CA3AF]">
            <Loader2 className="w-8 h-8 animate-spin text-white mb-3" />
            <span className="text-sm">Loading course quizzes...</span>
          </div>
        ) : error ? (
          <div className="max-w-lg mx-auto p-6 bg-rose-950/30 border border-rose-500/40 rounded-xl text-center space-y-3">
            <AlertCircle className="w-8 h-8 text-rose-400 mx-auto" />
            <h3 className="text-base font-semibold text-[#ECECEC]">Failed to load quizzes</h3>
            <p className="text-xs text-rose-300">{error}</p>
            <button
              onClick={() => loadData(selectedCourse?.id)}
              className="px-4 py-2 rounded-lg text-xs font-semibold bg-[#333333] hover:bg-[#404040] text-[#ECECEC] transition-colors cursor-pointer"
            >
              Try Again
            </button>
          </div>
        ) : quizzes.length === 0 ? (
          /* Empty State */
          <div className="max-w-md mx-auto py-16 px-6 text-center bg-[#262626] border border-[#383838] rounded-xl shadow-sm space-y-4">
            <div className="w-14 h-14 rounded-full bg-[#1A1A1A] border border-[#383838] flex items-center justify-center text-white mx-auto">
              <Layers className="w-7 h-7 text-[#9CA3AF]" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-[#ECECEC]">No quizzes found in this course</h3>
              <p className="text-xs text-[#9CA3AF] mt-1.5 leading-relaxed">
                Sync with Google Drive to auto-populate quizzes from your drive folder, or import a JSON quiz file.
              </p>
            </div>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={handleSyncDrive}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white transition-colors cursor-pointer"
              >
                <span>Sync with Google Drive</span>
              </button>
              <button
                onClick={() => {
                  setTargetQuizForImport(null);
                  setIsImportOpen(true);
                }}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold bg-white text-black hover:bg-neutral-200 transition-colors shadow-sm cursor-pointer"
              >
                <Upload className="w-4 h-4" />
                <span>Import JSON</span>
              </button>
            </div>
          </div>
        ) : filteredQuizzes.length === 0 ? (
          /* Empty Search / Filter State */
          <div className="max-w-md mx-auto py-12 px-6 text-center bg-[#262626] border border-[#383838] rounded-xl space-y-3">
            <Search className="w-8 h-8 text-[#9CA3AF] mx-auto" />
            <h3 className="text-base font-semibold text-[#ECECEC]">No matching quizzes found</h3>
            <p className="text-xs text-[#9CA3AF]">
              No quizzes match your current search and filter criteria.
            </p>
            <button
              onClick={clearFilters}
              className="px-4 py-2 rounded-lg text-xs font-semibold bg-[#333333] hover:bg-[#404040] text-[#ECECEC] transition-colors cursor-pointer"
            >
              Clear All Filters
            </button>
          </div>
        ) : (
          /* Quizzes Grid */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredQuizzes.map((quiz) => (
              <QuizCard
                key={quiz.id}
                quiz={quiz}
                onStart={handleStartClick}
                onDelete={handleDeleteQuiz}
                onUploadJson={handleUploadJsonForQuiz}
              />
            ))}
          </div>
        )}
      </main>

      {/* Import Modal */}
      <ImportModal
        isOpen={isImportOpen}
        targetCourseId={selectedCourse?.id}
        targetQuizTitle={targetQuizForImport?.title}
        onClose={() => {
          setIsImportOpen(false);
          setTargetQuizForImport(null);
        }}
        onSuccess={() => loadData(selectedCourse?.id)}
      />

      {/* Quiz Config Modal */}
      <QuizConfigModal
        quiz={selectedQuiz}
        isOpen={isConfigOpen}
        isStarting={isStarting}
        onClose={() => {
          setIsConfigOpen(false);
          setIsStarting(false);
        }}
        onStart={handleConfirmStart}
      />
    </div>
  );
}
