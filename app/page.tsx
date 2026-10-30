"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Search,
  X,
  RefreshCw,
  Loader2,
  AlertCircle,
  BookOpen,
  Bookmark,
  SlidersHorizontal,
  Tag,
} from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { CourseCard } from "@/components/CourseCard";
import { ImportCourseModal } from "@/components/ImportCourseModal";
import { DeleteConfirmModal } from "@/components/DeleteConfirmModal";
import { QuizConfigModal } from "@/components/QuizConfigModal";
import { EditCourseModal } from "@/components/EditCourseModal";
import { ManageBookTypesModal } from "@/components/ManageBookTypesModal";
import {
  getCourses,
  getQuizzes,
  createCourse,
  deleteCourse,
  syncCourseDrive,
  startAttempt,
  getBookTypes,
} from "@/lib/api";
import { CourseSummary, QuizSummary, BookTypeItem } from "@/types/quiz";
import { useToast } from "@/components/Toast";
import { getBookMainTypes } from "@/lib/utils";

export default function BooksDashboardPage() {
  const router = useRouter();
  const { showToast } = useToast();

  // Books & Chapters Data
  const [courses, setCourses] = useState<CourseSummary[]>([]);
  const [quizzes, setQuizzes] = useState<QuizSummary[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Search & Status filters
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedStatus, setSelectedStatus] = useState<"all" | "To do" | "Doing" | "Done">("all");

  // Modals state
  const [isImportCourseOpen, setIsImportCourseOpen] = useState<boolean>(false);
  const [isManageTypesOpen, setIsManageTypesOpen] = useState<boolean>(false);
  const [courseToDelete, setCourseToDelete] = useState<CourseSummary | null>(null);
  const [isDeletingCourse, setIsDeletingCourse] = useState<boolean>(false);
  const [courseToEdit, setCourseToEdit] = useState<CourseSummary | null>(null);

  // Quiz / Chapter Start modal state
  const [selectedQuizForStart, setSelectedQuizForStart] = useState<QuizSummary | null>(null);
  const [isQuizConfigOpen, setIsQuizConfigOpen] = useState<boolean>(false);
  const [isStartingQuiz, setIsStartingQuiz] = useState<boolean>(false);

  // Load all books and chapters
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
      const msg = err instanceof Error ? err.message : "Failed to load books.";
      setError(msg);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Group chapters by bookId
  const quizzesByCourse = useMemo(() => {
    const map = new Map<string, QuizSummary[]>();
    quizzes.forEach((q) => {
      const parentId = q.book_id || q.course_id;
      if (parentId) {
        if (!map.has(parentId)) {
          map.set(parentId, []);
        }
        map.get(parentId)!.push(q);
      }
    });
    // Sort chapters by unit number ascending
    map.forEach((list) => {
      list.sort((a, b) => (a.unit_number ?? 999) - (b.unit_number ?? 999));
    });
    return map;
  }, [quizzes]);

  // Determine book reading status based on chapters
  const getBookStatus = useCallback(
    (course: CourseSummary): "To do" | "Doing" | "Done" => {
      const bookQuizzes = quizzesByCourse.get(course.id) || [];
      const total =
        bookQuizzes.length > 0
          ? bookQuizzes.length
          : course.total_chapters || course.total_quizzes || 0;
      const done =
        bookQuizzes.length > 0
          ? bookQuizzes.filter((q) => q.status === "Done").length
          : course.done_chapters || course.completed_quizzes || 0;
      const doing =
        bookQuizzes.length > 0
          ? bookQuizzes.filter((q) => q.status === "Doing").length
          : course.doing_chapters || 0;

      if (total > 0 && done >= total) return "Done";
      if (done > 0 || doing > 0) return "Doing";
      return "To do";
    },
    [quizzesByCourse]
  );

  // Status counts for filter tabs
  const statusCounts = useMemo(() => {
    let todo = 0;
    let doing = 0;
    let done = 0;
    courses.forEach((c) => {
      const s = getBookStatus(c);
      if (s === "Done") done++;
      else if (s === "Doing") doing++;
      else todo++;
    });
    return { all: courses.length, todo, doing, done };
  }, [courses, getBookStatus]);

  // Selected Genre filter
  const [selectedGenre, setSelectedGenre] = useState<string>("all");
  const [repoGenres, setRepoGenres] = useState<BookTypeItem[]>([]);

  useEffect(() => {
    getBookTypes()
      .then((types) => {
        if (Array.isArray(types)) setRepoGenres(types);
      })
      .catch(() => {});
  }, []);

  const repoGenreNames = useMemo(() => repoGenres.map((t) => t.name), [repoGenres]);

  // Available unique genres across all books
  const availableGenres = useMemo(() => {
    const genresSet = new Set<string>();

    courses.forEach((c) => {
      const types = getBookMainTypes(c, repoGenreNames.length > 0 ? repoGenreNames : undefined);
      types.forEach((t) => {
        if (
          t &&
          t.toLowerCase() !== "nonfiction" &&
          t.toLowerCase() !== "fiction" &&
          t.toLowerCase() !== "non-fiction"
        ) {
          genresSet.add(t);
        }
      });
    });

    const list = Array.from(genresSet);
    list.sort((a, b) => a.localeCompare(b));
    return list;
  }, [courses, repoGenreNames]);

  // Genre counts for each filter tab
  const genreCounts = useMemo(() => {
    const counts: Record<string, number> = { all: courses.length };
    courses.forEach((c) => {
      const types = getBookMainTypes(c, repoGenreNames.length > 0 ? repoGenreNames : undefined);
      const bookTypes = new Set<string>(
        types
          .filter(
            (t) =>
              t.toLowerCase() !== "nonfiction" &&
              t.toLowerCase() !== "fiction" &&
              t.toLowerCase() !== "non-fiction"
          )
          .map((t) => t.toLowerCase())
      );

      availableGenres.forEach((g) => {
        if (bookTypes.has(g.toLowerCase())) {
          counts[g] = (counts[g] || 0) + 1;
        }
      });
    });
    return counts;
  }, [courses, availableGenres, repoGenreNames]);

  // Filtered books by search query, status filter, and genre filter
  const filteredCourses = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return courses.filter((c) => {
      const titleMatch =
        !q ||
        c.title.toLowerCase().includes(q) ||
        (c.description?.toLowerCase().includes(q) ?? false) ||
        (c.author?.toLowerCase().includes(q) ?? false);

      const statusMatch =
        selectedStatus === "all" || getBookStatus(c) === selectedStatus;

      const types = getBookMainTypes(c, repoGenreNames.length > 0 ? repoGenreNames : undefined);
      const bookTypes = new Set<string>(types.map((t) => t.toLowerCase()));
      const genreMatch =
        selectedGenre === "all" || bookTypes.has(selectedGenre.toLowerCase());

      return titleMatch && statusMatch && genreMatch;
    });
  }, [courses, searchQuery, selectedStatus, selectedGenre, getBookStatus, repoGenreNames]);

  // Handle Sync Book with Drive
  const handleSyncDrive = async (courseId: string) => {
    try {
      const updated = await syncCourseDrive(courseId);
      showToast(
        `Synchronized "${updated.title}" with Google Drive! (${updated.total_chapters || updated.total_quizzes} chapters)`,
        "success",
        5000
      );
      await loadData(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to sync book with Drive.";
      showToast(msg, "error", 6000);
      throw err;
    }
  };

  // Handle Delete Book Modal
  const handleDeleteCourseClick = (course: CourseSummary) => {
    setCourseToDelete(course);
  };

  const handleConfirmDeleteCourse = async () => {
    if (!courseToDelete) return;
    setIsDeletingCourse(true);
    try {
      await deleteCourse(courseToDelete.id);
      showToast(`Book "${courseToDelete.title}" and its chapters were deleted.`, "info", 5000);
      setCourseToDelete(null);
      await loadData(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to delete book.";
      showToast(msg, "error", 6000);
    } finally {
      setIsDeletingCourse(false);
    }
  };

  // Handle Start Quiz / Chapter
  const handleStartQuiz = (quiz: QuizSummary, mode: "timed" | "practice") => {
    setSelectedQuizForStart(quiz);
    if (mode === "practice") {
      executeStartQuiz(quiz, 30, "practice");
    } else {
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
        showToast(`Timed session started! You have ${durationMinutes} minutes.`, "info", 4000);
      } else {
        showToast("Self-paced practice started! Immediate feedback active.", "success", 4000);
      }
      setIsQuizConfigOpen(false);
      router.push(`/quiz/${quiz.id}/attempt/${attempt.id}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to start chapter session.";
      showToast(msg, "error", 5000);
      setIsStartingQuiz(false);
    }
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
            <h1 className="text-lg font-bold text-white tracking-tight">Books</h1>
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
                placeholder="Search books by title, author..."
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
              title="Refresh books"
              className="p-1.5 rounded-xl bg-[#1b1b1b] border border-[#333333] hover:border-gray-500 text-gray-300 hover:text-white transition-all cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin text-blue-400" : ""}`} />
            </button>

            <button
              onClick={() => setIsManageTypesOpen(true)}
              title="CRUD Genres of Books (Add, Edit, Delete genres in repo)"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#222222] text-purple-300 hover:text-white hover:bg-[#2c2c2c] border border-purple-500/30 transition-all cursor-pointer shrink-0"
            >
              <Tag className="w-3.5 h-3.5 text-purple-400" />
              <span className="hidden sm:inline">Genres of Book</span>
            </button>

            <button
              onClick={() => setIsImportCourseOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white text-black hover:bg-neutral-200 transition-all shadow-sm cursor-pointer shrink-0"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              <span className="hidden sm:inline">Import Book</span>
            </button>
          </div>
        </div>

        {/* Filters: Status & Genre Filters */}
        {courses.length > 0 && (
          <div className="space-y-3 mb-6 bg-[#181818] p-3.5 rounded-2xl border border-[#2a2a2a]">
            {/* Status Filter Tabs */}
            <div className="flex items-center gap-2 overflow-x-auto pb-0.5 scrollbar-none">
              <span className="text-xs font-semibold text-gray-400 shrink-0 min-w-[52px]">
                Status:
              </span>
              {(
                [
                  { key: "all", label: "All Statuses", count: statusCounts.all },
                  { key: "To do", label: "To do", count: statusCounts.todo },
                  { key: "Doing", label: "Doing", count: statusCounts.doing },
                  { key: "Done", label: "Done", count: statusCounts.done },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setSelectedStatus(tab.key)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                    selectedStatus === tab.key
                      ? "bg-white text-black shadow-sm"
                      : "bg-[#222222] text-gray-400 hover:text-white border border-[#333333]"
                  }`}
                >
                  <span>{tab.label}</span>
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                      selectedStatus === tab.key
                        ? "bg-neutral-200 text-black"
                        : "bg-[#2c2c2c] text-gray-400"
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>

            {/* Genre Filter Tabs */}
            {availableGenres.length > 0 && (
              <div className="flex items-center gap-2 overflow-x-auto pb-0.5 scrollbar-none border-t border-[#262626] pt-2.5">
                <span className="text-xs font-semibold text-purple-300 flex items-center gap-1 shrink-0 min-w-[52px]">
                  <Bookmark className="w-3.5 h-3.5 text-purple-400" />
                  Genre:
                </span>
                <button
                  onClick={() => setSelectedGenre("all")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                    selectedGenre === "all"
                      ? "bg-purple-600 text-white shadow-sm"
                      : "bg-[#222222] text-purple-300 hover:text-white border border-purple-500/25 hover:border-purple-500/50"
                  }`}
                >
                  <span>All Genres</span>
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                      selectedGenre === "all"
                        ? "bg-purple-700 text-white"
                        : "bg-[#2a2a2a] text-purple-300"
                    }`}
                  >
                    {genreCounts.all || courses.length}
                  </span>
                </button>

                {availableGenres.map((genre) => (
                  <button
                    key={genre}
                    onClick={() => setSelectedGenre(selectedGenre === genre ? "all" : genre)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                      selectedGenre === genre
                        ? "bg-purple-600 text-white shadow-sm"
                        : "bg-[#222222] text-purple-300 hover:text-white border border-purple-500/25 hover:border-purple-500/50"
                    }`}
                  >
                    <span>{genre}</span>
                    <span
                      className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                        selectedGenre === genre
                          ? "bg-purple-700 text-white"
                          : "bg-[#2a2a2a] text-purple-300"
                      }`}
                    >
                      {genreCounts[genre] || 0}
                    </span>
                  </button>
                ))}

                {/* CRUD Genres of Book Button */}
                <button
                  type="button"
                  onClick={() => setIsManageTypesOpen(true)}
                  className="px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-purple-500/20 text-purple-200 hover:bg-purple-500/30 border border-purple-500/40 transition-all flex items-center gap-1 shrink-0 cursor-pointer shadow-sm ml-1"
                  title="CRUD Genres of Books (Add, Edit, Delete genres in repo)"
                >
                  <Plus className="w-3.5 h-3.5 text-purple-300" />
                  <span>Add / Manage Genres</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Content Loading / Error / Grid */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-24 text-gray-400">
            <Loader2 className="w-8 h-8 animate-spin text-white mb-3" />
            <span className="text-sm">Loading book library...</span>
          </div>
        ) : error ? (
          <div className="max-w-lg mx-auto p-6 bg-rose-950/30 border border-rose-500/40 rounded-2xl text-center space-y-3">
            <AlertCircle className="w-8 h-8 text-rose-400 mx-auto" />
            <h3 className="text-base font-semibold text-white">Failed to load books</h3>
            <p className="text-xs text-rose-300">{error}</p>
            <button
              onClick={() => loadData()}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#2c2c2c] hover:bg-[#383838] text-white transition-colors cursor-pointer"
            >
              Try Again
            </button>
          </div>
        ) : courses.length === 0 ? (
          <div className="p-12 text-center border border-dashed border-[#333333] rounded-2xl bg-[#191919]">
            <BookOpen className="w-12 h-12 text-gray-500 mx-auto mb-3" />
            <h3 className="text-base font-bold text-white mb-1">Your Book Library is Empty</h3>
            <p className="text-xs text-gray-400 max-w-md mx-auto mb-5">
              Import books using Goodreads links to fetch rich details, and Google Drive links to add chapters.
            </p>
            <button
              onClick={() => setIsImportCourseOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-white text-black hover:bg-neutral-200 transition-all shadow-md cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>Import First Book</span>
            </button>
          </div>
        ) : filteredCourses.length === 0 ? (
          <div className="p-12 text-center border border-dashed border-[#333333] rounded-2xl bg-[#191919]">
            <BookOpen className="w-10 h-10 text-gray-500 mx-auto mb-3" />
            <h3 className="text-sm font-bold text-white mb-1">No Books Found</h3>
            <p className="text-xs text-gray-400 max-w-md mx-auto mb-4">
              No books match the selected filters
              {selectedStatus !== "all" ? ` (Status: "${selectedStatus}")` : ""}
              {selectedGenre !== "all" ? ` (Genre: "${selectedGenre}")` : ""}
              {searchQuery ? ` or search &quot;${searchQuery}&quot;` : ""}.
            </p>
            <button
              onClick={() => {
                setSelectedStatus("all");
                setSelectedGenre("all");
                setSearchQuery("");
              }}
              className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-[#2a2a2a] hover:bg-[#353535] text-white transition-colors cursor-pointer"
            >
              Reset Filters
            </button>
          </div>
        ) : (
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
                selectedGenre={selectedGenre}
                onSelectGenre={(g) => setSelectedGenre(g)}
                selectedType={selectedGenre}
                onSelectType={(t) => setSelectedGenre(t)}
                repoGenres={repoGenreNames}
                repoTypes={repoGenreNames}
              />
            ))}
          </div>
        )}
      </main>

      {/* Import Book Modal */}
      <ImportCourseModal
        isOpen={isImportCourseOpen}
        onClose={() => setIsImportCourseOpen(false)}
        onImportSuccess={async () => {
          showToast("Book imported successfully!", "success", 4000);
          await loadData(true);
        }}
        onCreateCourse={createCourse}
      />

      {/* Manage Book Genres Modal (CRUD Genres of Books) */}
      <ManageBookTypesModal
        isOpen={isManageTypesOpen}
        onClose={() => {
          setIsManageTypesOpen(false);
          loadData(true);
        }}
        onTypesChange={(updatedTypes) => setRepoGenres(updatedTypes)}
      />

      {/* Delete Book Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={!!courseToDelete}
        onClose={() => setCourseToDelete(null)}
        onConfirm={handleConfirmDeleteCourse}
        title={`Delete Book: ${courseToDelete?.title || ""}`}
        description="Are you sure you want to delete this book? All associated chapters and reading sessions will be permanently deleted."
        isDeleting={isDeletingCourse}
      />

      {/* Edit Book Modal */}
      {courseToEdit && (
        <EditCourseModal
          isOpen={!!courseToEdit}
          onClose={() => setCourseToEdit(null)}
          course={courseToEdit}
          onSuccess={() => loadData(true)}
        />
      )}

      {/* Quiz Config Modal */}
      {selectedQuizForStart && (
        <QuizConfigModal
          isOpen={isQuizConfigOpen}
          onClose={() => setIsQuizConfigOpen(false)}
          quizTitle={selectedQuizForStart.title}
          unitNumber={selectedQuizForStart.unit_number}
          onStart={(duration) =>
            executeStartQuiz(selectedQuizForStart, duration, "timed")
          }
          isStarting={isStartingQuiz}
        />
      )}
    </div>
  );
}
