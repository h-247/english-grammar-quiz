"use client";

import React, { useState, useEffect, memo } from "react";
import { useRouter } from "next/navigation";
import {
  HardDrive,
} from "lucide-react";
import { CourseSummary, QuizSummary, ChapterStatus } from "@/types/quiz";
import { CopyDriveLinkButton } from "@/components/CopyDriveLinkButton";
import { SharedPromptLinkSettings } from "@/components/SharedPromptLinkSettings";
import { ChatGPTLinkActions } from "@/components/ChatGPTLinkActions";
import { updateChapterStatus, updateCourse } from "@/lib/api";
import { getBookMainTypes } from "@/lib/utils";

interface CourseCardProps {
  course: CourseSummary;
  quizzes?: QuizSummary[];
  onSyncDrive: (courseId: string) => Promise<void>;
  onDeleteCourse: (course: CourseSummary) => void;
  onEditCourse?: (course: CourseSummary) => void;
  onStartQuiz?: (quiz: QuizSummary, mode: "timed" | "practice") => void;
  onStatusChange?: (
    courseId: string,
    newStatus: ChapterStatus,
    chapterId?: string,
    newChapterStatus?: ChapterStatus
  ) => void;
  selectedType?: string;
  onSelectType?: (type: string) => void;
  selectedGenre?: string;
  onSelectGenre?: (genre: string) => void;
  repoTypes?: string[];
  repoGenres?: string[];
}

export const CourseCard = memo(function CourseCard({
  course,
  quizzes = [],
  onSyncDrive,
  onDeleteCourse,
  onStatusChange,
  selectedType,
  onSelectType,
  selectedGenre,
  onSelectGenre,
  repoTypes,
  repoGenres,
}: CourseCardProps) {
  // Derive chapter counts reactively from quizzes if available
  const totalChapters =
    quizzes.length > 0
      ? quizzes.length
      : course.total_chapters || course.total_quizzes || 0;
  const doneChapters =
    quizzes.length > 0
      ? quizzes.filter((q) => q.status === "Done").length
      : course.done_chapters || course.completed_quizzes || 0;
  const doingChapters =
    quizzes.length > 0
      ? quizzes.filter((q) => q.status === "Doing").length
      : course.doing_chapters || 0;
  const todoChapters =
    quizzes.length > 0
      ? quizzes.filter((q) => q.status !== "Done" && q.status !== "Doing").length
      : course.todo_chapters || Math.max(0, totalChapters - doneChapters - doingChapters);

  // Compute reading progress
  const progressPercent =
    totalChapters > 0 ? Math.round((doneChapters / totalChapters) * 100) : 0;

  // Find next chapter to read
  const nextChapter =
    quizzes.find((q) => q.status === "Doing") ||
    quizzes.find((q) => q.status === "To do") ||
    quizzes[0] ||
    null;

  const [chapterStatus, setChapterStatus] = useState<ChapterStatus>(
    (nextChapter?.status as ChapterStatus) || "To do"
  );
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  useEffect(() => {
    if (nextChapter?.status) {
      setChapterStatus(nextChapter.status as ChapterStatus);
    }
  }, [nextChapter?.status]);

  const computedBookStatus: ChapterStatus =
    totalChapters > 0 && doneChapters >= totalChapters
      ? "Done"
      : doneChapters > 0 || doingChapters > 0
      ? "Doing"
      : course.status || "To do";

  const [activeBookStatus, setActiveBookStatus] = useState<ChapterStatus>(computedBookStatus);

  useEffect(() => {
    setActiveBookStatus(computedBookStatus);
  }, [computedBookStatus]);

  const handleStatusChange = async (newStatus: ChapterStatus) => {
    if (!nextChapter) return;
    setIsUpdatingStatus(true);
    setChapterStatus(newStatus);
    nextChapter.status = newStatus;

    // Immediately compute new book status from updated chapter status
    const updatedDoing = quizzes.filter((q) =>
      q.id === nextChapter.id ? newStatus === "Doing" : q.status === "Doing"
    ).length;
    const updatedDone = quizzes.filter((q) =>
      q.id === nextChapter.id ? newStatus === "Done" : q.status === "Done"
    ).length;
    const updatedTotal = totalChapters;

    const newBookStatus: ChapterStatus =
      updatedTotal > 0 && updatedDone >= updatedTotal
        ? "Done"
        : updatedDone > 0 || updatedDoing > 0
        ? "Doing"
        : "To do";

    setActiveBookStatus(newBookStatus);

    try {
      await updateChapterStatus(nextChapter.id, newStatus);
    } catch (err) {
      console.error("Failed to update status", err);
    } finally {
      setIsUpdatingStatus(false);
    }

    onStatusChange?.(course.id, newBookStatus, nextChapter.id, newStatus);
  };

  const handleBookStatusChange = async (newStatus: ChapterStatus) => {
    setActiveBookStatus(newStatus);
    if (nextChapter) {
      setIsUpdatingStatus(true);
      setChapterStatus(newStatus);
      nextChapter.status = newStatus;
      try {
        await updateChapterStatus(nextChapter.id, newStatus);
      } catch (err) {
        console.error("Failed to update status", err);
      } finally {
        setIsUpdatingStatus(false);
      }
    }
    onStatusChange?.(course.id, newStatus, nextChapter?.id, newStatus);
  };

  const currentGenre = selectedGenre ?? selectedType;
  const handleSelectGenre = onSelectGenre ?? onSelectType;
  const genresList = repoGenres ?? repoTypes;

  const mainGenres = getBookMainTypes(
    course,
    genresList && genresList.length > 0 ? genresList : undefined
  );

  const router = useRouter();

  const handleCardClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (
      target.closest("button") ||
      target.closest("a") ||
      target.closest("input") ||
      target.closest("[data-prevent-card-click]")
    ) {
      return;
    }
    if (e.metaKey || e.ctrlKey) {
      window.open(`/courses/${course.id}`, "_blank");
      return;
    }
    router.push(`/courses/${course.id}`);
  };

  return (
    <div
      onClick={handleCardClick}
      className="group rounded-2xl bg-[#1c1c1c] border border-[#2e2e2e] hover:border-[#444444] transition-all duration-200 overflow-hidden flex flex-col justify-between shadow-xl shadow-black/40 cursor-pointer"
    >
      <div className="p-5 flex flex-col flex-1">
        {/* Title and Book Status */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <h3 className="text-lg font-bold text-white group-hover:text-amber-300 transition-colors leading-snug flex-1">
            {course.title}
          </h3>

          <div className="shrink-0 pt-0.5 flex flex-col items-end gap-1.5">
            {/* 2 Main Genres */}
            {mainGenres.length > 0 && (
              <div className="flex items-center justify-end gap-1.5 flex-wrap">
                {mainGenres.map((g, idx) => {
                  const isSelected =
                    currentGenre && currentGenre.toLowerCase() === g.toLowerCase();
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelectGenre?.(isSelected ? "all" : g);
                      }}
                      title={`Filter books by genre "${g}"`}
                      className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all cursor-pointer ${
                        isSelected
                          ? "bg-purple-600 text-white border border-purple-400 shadow-sm"
                          : "bg-purple-500/15 text-purple-300 border border-purple-500/30 hover:bg-purple-500/30 hover:border-purple-400"
                      }`}
                    >
                      {g}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Current Book Status Button (One button) */}
            {(() => {
              const nextStatusCycle: ChapterStatus =
                activeBookStatus === "To do"
                  ? "Doing"
                  : activeBookStatus === "Doing"
                  ? "Done"
                  : "To do";

              return (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleBookStatusChange(nextStatusCycle);
                  }}
                  title={`Current Book status: ${activeBookStatus} (Click to change)`}
                  className={`flex items-center px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer select-none ${
                    activeBookStatus === "Doing"
                      ? "bg-[#25170b] text-amber-400 border-2 border-amber-500 shadow-sm shadow-amber-500/10"
                      : activeBookStatus === "Done"
                      ? "bg-emerald-950/40 text-emerald-400 border-2 border-emerald-500 shadow-sm shadow-emerald-500/10"
                      : "bg-[#262626] text-white border-2 border-neutral-400 shadow-sm"
                  }`}
                >
                  <span>{activeBookStatus}</span>
                </button>
              );
            })()}
          </div>
        </div>

        {/* Next Chapter Highlight */}
        {nextChapter && (
          <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-3.5 mb-2">
            <h4 className="text-sm font-semibold text-[#ececec] line-clamp-1 mb-3">
              {nextChapter.unit_number != null ? `Ch. ${nextChapter.unit_number}: ` : ""}
              {nextChapter.unit_title || nextChapter.title}
              </h4>

              {/* Action Buttons in Next Chapter Box */}
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  {(
                    [
                      { key: "To do", label: "To do" },
                      { key: "Doing", label: "Doing" },
                      { key: "Done", label: "Done" },
                    ] as const
                  ).map(({ key, label }) => {
                    const isActive = chapterStatus === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        disabled={isUpdatingStatus}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStatusChange(key);
                        }}
                        title={`Set chapter status to ${label}`}
                        className={`flex items-center px-2.5 py-1 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                          isActive
                            ? key === "Doing"
                              ? "bg-[#25170b] text-amber-400 border-2 border-amber-500 shadow-sm shadow-amber-500/10"
                              : key === "Done"
                              ? "bg-emerald-950/40 text-emerald-400 border-2 border-emerald-500 shadow-sm shadow-emerald-500/10"
                              : "bg-[#262626] text-white border-2 border-neutral-400 shadow-sm"
                            : key === "To do" && chapterStatus === "Doing"
                            ? "bg-[#212121] text-white border border-[#383838] hover:border-gray-500"
                            : "bg-[#212121] text-gray-400 border border-[#383838] hover:border-gray-500 hover:text-gray-200"
                        }`}
                      >
                        <span>{label}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Chapter Action Links & Icons in One Line */}
                <div className="flex items-center gap-2 flex-wrap">
                  {nextChapter.drive_file_id && (
                    <div className="inline-flex h-7 items-center overflow-hidden rounded-lg border border-blue-900/30 bg-[#222222]">
                      <a
                        href={`https://drive.google.com/file/d/${nextChapter.drive_file_id}/view`}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        title="View PDF in Google Drive"
                        aria-label="View PDF in Google Drive"
                        className="inline-flex h-7 w-7 items-center justify-center hover:bg-white/10 text-blue-400 hover:text-blue-300 transition-colors"
                      >
                        <HardDrive className="h-3.5 w-3.5" />
                      </a>
                      <CopyDriveLinkButton
                        fileId={nextChapter.drive_file_id}
                        title="Copy Drive PDF link"
                        className="inline-flex h-7 w-7 items-center justify-center border-l border-blue-900/40 text-blue-400/80 hover:text-blue-200 hover:bg-white/10 rounded-none p-0"
                      />
                    </div>
                  )}

                  <SharedPromptLinkSettings compact canEdit={false} />

                  <ChatGPTLinkActions
                    url={nextChapter.chatgpt_url}
                    chapterId={nextChapter.id}
                    chapterTitle={nextChapter.unit_title || nextChapter.title}
                    onLinkClick={() => {
                      if (chapterStatus !== "Doing") {
                        handleStatusChange("Doing");
                      }
                    }}
                    onSaved={(newUrl) => {
                      nextChapter.chatgpt_url = newUrl;
                    }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }
);

export const BookCard = CourseCard;
