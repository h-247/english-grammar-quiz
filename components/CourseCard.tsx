"use client";

import React, { useState, useEffect, memo } from "react";
import Link from "next/link";
import {
  ExternalLink,
  RefreshCw,
  Trash2,
  ArrowRight,
  HardDrive,
  BookOpen,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { CourseSummary, QuizSummary, ChapterStatus } from "@/types/quiz";
import { CopyDriveLinkButton } from "@/components/CopyDriveLinkButton";
import { SharedPromptLinkSettings } from "@/components/SharedPromptLinkSettings";
import { ChatGPTLinkActions } from "@/components/ChatGPTLinkActions";
import { updateChapterStatus } from "@/lib/api";
import { extractDriveFolderId, getDriveFolderUrl } from "@/lib/course-manifest";
import { formatDateOnly, getBookGoodreadsUrl, getAuthorGoodreadsUrl, getBookMainTypes } from "@/lib/utils";

interface CourseCardProps {
  course: CourseSummary;
  quizzes?: QuizSummary[];
  onSyncDrive: (courseId: string) => Promise<void>;
  onDeleteCourse: (course: CourseSummary) => void;
  onEditCourse?: (course: CourseSummary) => void;
  onStartQuiz?: (quiz: QuizSummary, mode: "timed" | "practice") => void;
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
  selectedType,
  onSelectType,
  selectedGenre,
  onSelectGenre,
  repoTypes,
  repoGenres,
}: CourseCardProps) {
  const [isSyncing, setIsSyncing] = useState(false);

  const totalChapters = course.total_chapters || course.total_quizzes || quizzes.length;
  const doneChapters = course.done_chapters || course.completed_quizzes || 0;
  const doingChapters = course.doing_chapters || 0;
  const todoChapters = course.todo_chapters || Math.max(0, totalChapters - doneChapters - doingChapters);

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

  const handleStatusChange = async (newStatus: ChapterStatus) => {
    if (!nextChapter) return;
    setIsUpdatingStatus(true);
    try {
      await updateChapterStatus(nextChapter.id, newStatus);
      setChapterStatus(newStatus);
      nextChapter.status = newStatus;
    } catch (err) {
      console.error("Failed to update status", err);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleSync = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsSyncing(true);
    try {
      await onSyncDrive(course.id);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onDeleteCourse(course);
  };

  const bookStatus: ChapterStatus =
    course.status ||
    (totalChapters > 0 && doneChapters >= totalChapters
      ? "Done"
      : doneChapters > 0 || doingChapters > 0
      ? "Doing"
      : "To do");

  const currentGenre = selectedGenre ?? selectedType;
  const handleSelectGenre = onSelectGenre ?? onSelectType;
  const genresList = repoGenres ?? repoTypes;

  const mainGenres = getBookMainTypes(
    course,
    genresList && genresList.length > 0 ? genresList : undefined
  );
  const bookGoodreadsUrl = getBookGoodreadsUrl(course);
  const authorGoodreadsUrl = getAuthorGoodreadsUrl(course);

  const hasValidDriveFolder = Boolean(
    course.drive_folder_id &&
    extractDriveFolderId(course.drive_folder_id) &&
    !course.drive_folder_id.includes("goodreads")
  );
  const driveFolderUrl = hasValidDriveFolder
    ? getDriveFolderUrl(course.drive_folder_id || course.drive_folder_url || "")
    : null;

  const syncDate = formatDateOnly(course.updated_at);

  return (
    <div className="group rounded-2xl bg-[#1c1c1c] border border-[#2e2e2e] hover:border-[#444444] transition-all duration-200 overflow-hidden flex flex-col justify-between shadow-xl shadow-black/40">
      <div className="p-5">
        {/* Top Badges: Book Status, Drive Linked, Goodreads, Rating */}
        <div className="flex items-center justify-between gap-2 mb-4 flex-wrap">
          <div className="flex items-center gap-1.5 flex-wrap">
            {/* Book Reading Status Badge */}
            <span
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${
                bookStatus === "Done"
                  ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                  : bookStatus === "Doing"
                  ? "bg-amber-500/15 text-amber-300 border-amber-500/30"
                  : "bg-[#252525] text-neutral-300 border-[#383838]"
              }`}
            >
              {bookStatus === "Done" ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              ) : bookStatus === "Doing" ? (
                <Clock className="w-3.5 h-3.5 text-amber-300" />
              ) : (
                <BookOpen className="w-3.5 h-3.5 text-neutral-400" />
              )}
              <span>{bookStatus}</span>
            </span>

            {/* 2 Main Genres */}
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
        </div>
          {/* Title & Author */}
          <div className="flex items-start justify-between gap-2 mb-1">
            <a
              href={bookGoodreadsUrl}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              title={`Open "${course.title}" on Goodreads`}
              className="text-lg font-bold text-white hover:text-amber-300 transition-colors line-clamp-1 inline-flex items-center gap-1.5 group/title cursor-pointer"
            >
              <span className="group-hover/title:underline">{course.title}</span>
              <ExternalLink className="w-3.5 h-3.5 opacity-60 group-hover/title:opacity-100 text-amber-400 shrink-0 transition-opacity" />
            </a>
            {hasValidDriveFolder && driveFolderUrl && (
              <div className="flex items-center gap-0.5 shrink-0">
                <CopyDriveLinkButton
                  url={driveFolderUrl}
                  folderId={course.drive_folder_id}
                  title="Copy Google Drive folder link"
                />
                <a
                  href={driveFolderUrl}
                  target="_blank"
                  rel="noreferrer"
                  title="Open Folder on Google Drive"
                  className="text-gray-400 hover:text-white p-1 rounded-md hover:bg-[#2c2c2c] transition-colors shrink-0"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            )}
          </div>

          {course.author && (
            <p className="text-xs font-medium text-gray-400 mb-2">
              by{" "}
              {authorGoodreadsUrl ? (
                <a
                  href={authorGoodreadsUrl}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  title={`View "${course.author}" on Goodreads`}
                  className="text-amber-400/90 hover:text-amber-300 hover:underline transition-colors cursor-pointer"
                >
                  {course.author}
                </a>
              ) : (
                <span className="text-gray-300">{course.author}</span>
              )}
            </p>
          )}

          <p className="text-xs text-[#9CA3AF] line-clamp-2 mb-4">
            {course.description || "Interactive book chapters and reading management."}
          </p>

          {/* Reading Progress */}
          <div className="mb-4">
            <div className="flex items-center justify-between text-xs text-[#9CA3AF] mb-1.5">
              <span>Chapter Progress</span>
              <span className="font-semibold text-white">
                {doneChapters} / {totalChapters} chapters ({progressPercent}%)
              </span>
            </div>
            <div className="w-full bg-[#2a2a2a] h-2 rounded-full overflow-hidden">
              <div
                className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {/* Chapter Status Breakdown Badges */}
          <div className="flex items-center gap-1.5 flex-wrap mb-4">
            <span className="px-2.5 py-1 rounded-lg text-xs font-medium bg-[#242424] text-[#ececec] border border-[#333333]">
              {totalChapters} Chapters
            </span>
            <span className="px-2.5 py-1 rounded-lg text-xs font-medium bg-[#222222] text-gray-300 border border-gray-700">
              {todoChapters} To do
            </span>
            {doingChapters > 0 && (
              <span className="px-2.5 py-1 rounded-lg text-xs font-medium bg-amber-500/15 text-amber-300 border border-amber-500/30">
                {doingChapters} Doing
              </span>
            )}
            <span className="px-2.5 py-1 rounded-lg text-xs font-medium bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
              {doneChapters} Done
            </span>
          </div>

          {/* Next Chapter Highlight */}
          {nextChapter && (
            <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-3.5 mb-2">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-semibold text-amber-400 flex items-center gap-1">
                  📖 Next Chapter
                </span>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase ${
                    nextChapter.status === "Done"
                      ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                      : nextChapter.status === "Doing"
                      ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                      : "bg-neutral-800 text-neutral-300 border border-neutral-700"
                  }`}
                >
                  {nextChapter.status || "To do"}
                </span>
              </div>

              <h4 className="text-sm font-semibold text-[#ececec] line-clamp-1 mb-1">
                {nextChapter.unit_number != null ? `Ch. ${nextChapter.unit_number}: ` : ""}
                {nextChapter.unit_title || nextChapter.title}
              </h4>

              {nextChapter.instructions && (
                <div className="text-[11px] text-[#888888] flex items-center gap-2 mb-3">
                  <span>{nextChapter.instructions}</span>
                </div>
              )}

              {/* Action Buttons in Next Chapter Box */}
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    aria-label="Chapter status"
                    disabled={isUpdatingStatus}
                    value={chapterStatus}
                    onChange={(e) => handleStatusChange(e.target.value as ChapterStatus)}
                    onClick={(e) => e.stopPropagation()}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold border cursor-pointer outline-none transition-colors ${
                      chapterStatus === "Done"
                        ? "bg-emerald-950/40 text-emerald-300 border-emerald-500/40"
                        : chapterStatus === "Doing"
                        ? "bg-amber-950/40 text-amber-300 border-amber-500/40"
                        : "bg-[#262626] text-[#ECECEC] border-[#444444]"
                    }`}
                  >
                    <option value="To do" className="bg-[#212121] text-white">To do</option>
                    <option value="Doing" className="bg-[#212121] text-amber-300">Doing</option>
                    <option value="Done" className="bg-[#212121] text-emerald-300">Done</option>
                  </select>

                  {nextChapter.drive_file_id && (
                    <div className="flex items-center rounded-lg bg-[#222222] border border-blue-900/30 p-0.5">
                      <a
                        href={`https://drive.google.com/file/d/${nextChapter.drive_file_id}/view`}
                        target="_blank"
                        rel="noreferrer"
                        title="View PDF in Google Drive"
                        className="flex items-center justify-center gap-1 px-2.5 py-1 text-xs font-medium text-blue-400 hover:text-blue-300 transition-colors"
                      >
                        <HardDrive className="w-3 h-3" />
                        <span>Drive</span>
                      </a>
                      <CopyDriveLinkButton
                        fileId={nextChapter.drive_file_id}
                        title="Copy Drive PDF link"
                        className="p-1 border-l border-blue-900/40 text-blue-400/80 hover:text-blue-200"
                      />
                    </div>
                  )}

                  <Link
                    href={`/courses/${course.id}`}
                    className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white text-black hover:bg-neutral-200 transition-colors cursor-pointer"
                  >
                    <BookOpen className="w-3 h-3 text-black" />
                    <span>Read</span>
                  </Link>

                  <SharedPromptLinkSettings compact canEdit={false} />
                </div>

                {/* ChatGPT Conversation Pill */}
                <div className="flex items-center gap-2">
                  <ChatGPTLinkActions
                    url={nextChapter.chatgpt_url}
                    chapterId={nextChapter.id}
                    chapterTitle={nextChapter.unit_title || nextChapter.title}
                    onSaved={(newUrl) => {
                      nextChapter.chatgpt_url = newUrl;
                    }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Card Footer */}
      <div className="px-5 py-3 border-t border-[#262626] bg-[#171717] flex items-center justify-between text-xs text-gray-400">
        <span className="text-[11px] text-gray-500">Updated: {syncDate}</span>

        <div className="flex items-center gap-1">
          <button
            onClick={handleSync}
            disabled={isSyncing}
            title="Sync chapters with Google Drive"
            className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-[#252525] transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin text-blue-400" : ""}`} />
          </button>

          <Link
            href={`/courses/${course.id}`}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-200 hover:text-white bg-[#252525] hover:bg-[#303030] transition-colors"
          >
            <span>Open Book</span>
            <ArrowRight className="w-3 h-3" />
          </Link>

          <button
            onClick={handleDelete}
            title="Delete Book"
            className="p-1.5 text-gray-400 hover:text-red-400 rounded-lg hover:bg-red-950/20 transition-colors cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
});

export const BookCard = CourseCard;
