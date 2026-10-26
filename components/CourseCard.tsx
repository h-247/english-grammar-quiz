"use client";

import React, { useState, useEffect, memo } from "react";
import Link from "next/link";
import {
  ExternalLink,
  RefreshCw,
  Trash2,
  Play,
  BookOpen,
  ArrowRight,
  HardDrive,
  Clock,
  Link2,
  MessageSquareCheck,
  MessageSquarePlus,
  Pencil,
} from "lucide-react";
import { CourseSummary, QuizSummary } from "@/types/quiz";
import { DEFAULT_COURSE_BANNER, DEFAULT_PROMPT_CHAT_URL } from "@/lib/course-manifest";
import { CopyDriveLinkButton } from "@/components/CopyDriveLinkButton";
import { EditQuizChatModal } from "@/components/EditQuizChatModal";
import { formatDateOnly, cn } from "@/lib/utils";

interface CourseCardProps {
  course: CourseSummary;
  quizzes?: QuizSummary[];
  onSyncDrive: (courseId: string) => Promise<void>;
  onDeleteCourse: (course: CourseSummary) => void;
  onEditCourse?: (course: CourseSummary) => void;
  onStartQuiz: (quiz: QuizSummary, mode: "timed" | "practice") => void;
}

export const CourseCard = memo(function CourseCard({
  course,
  quizzes = [],
  onSyncDrive,
  onDeleteCourse,
  onEditCourse,
  onStartQuiz,
}: CourseCardProps) {
  const [isSyncing, setIsSyncing] = useState(false);
  const [promptChatUrl, setPromptChatUrl] = useState<string>(DEFAULT_PROMPT_CHAT_URL);

  useEffect(() => {
    const cached = localStorage.getItem("prompt_chat_url");
    if (cached) setPromptChatUrl(cached);
  }, []);

  // Compute learning progress
  const progressPercent =
    course.total_quizzes > 0
      ? Math.round((course.completed_quizzes / course.total_quizzes) * 100)
      : 0;

  // Find next playable quiz or first quiz
  const nextQuiz =
    quizzes.find((q) => q.status === "ready" && q.question_count > 0) ||
    quizzes[0] ||
    null;

  const [currentQuizChatUrl, setCurrentQuizChatUrl] = useState<string | null>(
    nextQuiz?.chatgpt_url || null
  );
  const [isChatModalOpen, setIsChatModalOpen] = useState(false);

  useEffect(() => {
    setCurrentQuizChatUrl(nextQuiz?.chatgpt_url || null);
  }, [nextQuiz?.chatgpt_url]);

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

  const bannerImg = course.banner_url || DEFAULT_COURSE_BANNER;
  const syncDate = formatDateOnly(course.updated_at);

  return (
    <div className="group rounded-2xl bg-[#1c1c1c] border border-[#2e2e2e] hover:border-[#444444] transition-all duration-200 overflow-hidden flex flex-col justify-between shadow-xl shadow-black/40">
      <div>
        {/* Top Banner Cover */}
        <div className="relative h-44 w-full overflow-hidden bg-[#141414]">
          <img
            src={bannerImg}
            alt={course.title}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#1c1c1c] via-transparent to-black/30" />
          
          {/* Drive Connected badge on cover */}
          {course.drive_folder_id && (
            <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-black/70 backdrop-blur-md text-gray-200 border border-white/10">
              <HardDrive className="w-3 h-3 text-blue-400" />
              <span>Drive Linked</span>
            </div>
          )}
        </div>

        {/* Card Body */}
        <div className="p-5">
          {/* Title & Drive Link */}
          <div className="flex items-start justify-between gap-2 mb-1.5">
            <Link
              href={`/courses/${course.id}`}
              className="text-lg font-bold text-white hover:text-blue-400 transition-colors line-clamp-1"
            >
              {course.title}
            </Link>
            {course.drive_folder_url && (
              <div className="flex items-center gap-0.5 shrink-0">
                <CopyDriveLinkButton
                  url={course.drive_folder_url}
                  folderId={course.drive_folder_id}
                  title="Copy Google Drive folder link"
                />
                <a
                  href={course.drive_folder_url}
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

          <p className="text-xs text-[#9CA3AF] line-clamp-1 mb-4">
            {course.description || "Comprehensive English Grammar curriculum"}
          </p>

          {/* Learning Progress Section */}
          <div className="mb-4">
            <div className="flex items-center justify-between text-xs text-[#9CA3AF] mb-1.5">
              <span>Learning Progress</span>
              <span className="font-semibold text-white">{progressPercent}%</span>
            </div>
            <div className="w-full bg-[#2a2a2a] h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {/* Stat Badges Row */}
          <div className="flex items-center gap-2 flex-wrap mb-4">
            <span className="px-2.5 py-1 rounded-lg text-xs font-medium bg-[#242424] text-[#ececec] border border-[#333333]">
              {course.total_quizzes} Units
            </span>
            <span className="px-2.5 py-1 rounded-lg text-xs font-medium bg-[#1e2a1e] text-emerald-400 border border-emerald-900/40">
              {course.ready_quizzes} Ready
            </span>
            <span className="px-2.5 py-1 rounded-lg text-xs font-medium bg-[#2a2418] text-amber-400 border border-amber-900/40">
              {course.pending_quizzes} Pending
            </span>
            {course.completed_quizzes > 0 && (
              <span className="px-2.5 py-1 rounded-lg text-xs font-medium bg-[#241e2a] text-purple-400 border border-purple-900/40">
                {course.completed_quizzes} Completed
              </span>
            )}
          </div>

          {/* Next Unit / Next Quiz Highlight Box (Matching Image 1) */}
          {nextQuiz && (
            <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-3.5 mb-2">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-semibold text-amber-400 flex items-center gap-1">
                  ⚡ Next Unit
                </span>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase ${
                    nextQuiz.status === "ready"
                      ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                      : "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                  }`}
                >
                  {nextQuiz.status === "ready" ? "Ready" : "To do"}
                </span>
              </div>

              <h4 className="text-sm font-semibold text-[#ececec] line-clamp-1 mb-1">
                {nextQuiz.unit_number ? `${nextQuiz.unit_number}. ` : ""}
                {nextQuiz.unit_title || nextQuiz.title}
              </h4>

              <div className="text-[11px] text-[#888888] flex items-center gap-2 mb-3">
                <Clock className="w-3 h-3 text-gray-400" />
                <span>
                  {nextQuiz.question_count > 0
                    ? `${nextQuiz.question_count} Questions • ${nextQuiz.blank_count} Blanks`
                    : "Awaiting JSON upload"}
                </span>
              </div>

              {/* Action Buttons in Box */}
              <div className="flex items-center gap-2">
                {nextQuiz.status === "ready" && nextQuiz.question_count > 0 ? (
                  <>
                    <button
                      onClick={() => onStartQuiz(nextQuiz, "timed")}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white text-black hover:bg-neutral-200 transition-colors cursor-pointer"
                    >
                      <Play className="w-3 h-3 fill-black text-black" />
                      <span>Play Exam</span>
                    </button>
                    <button
                      onClick={() => onStartQuiz(nextQuiz, "practice")}
                      className="flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#252525] hover:bg-[#303030] text-[#ececec] border border-[#3a3a3a] transition-colors cursor-pointer"
                    >
                      <BookOpen className="w-3 h-3" />
                      <span>Practice</span>
                    </button>
                  </>
                ) : (
                  <Link
                    href={`/courses/${course.id}`}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#252525] hover:bg-[#303030] text-gray-300 border border-[#3a3a3a] transition-colors"
                  >
                    <span>View Units & Import</span>
                  </Link>
                )}

                {nextQuiz.drive_file_id && (
                  <div className="flex items-center rounded-lg bg-[#222222] border border-blue-900/30 p-0.5">
                    <a
                      href={`https://drive.google.com/file/d/${nextQuiz.drive_file_id}/view`}
                      target="_blank"
                      rel="noreferrer"
                      title="View Source PDF on Google Drive"
                      className="flex items-center justify-center gap-1 px-2.5 py-1 text-xs font-medium text-blue-400 hover:text-blue-300 transition-colors"
                    >
                      <HardDrive className="w-3 h-3" />
                      <span>Drive</span>
                    </a>
                    <CopyDriveLinkButton
                      fileId={nextQuiz.drive_file_id}
                      title="Copy Drive PDF link"
                      className="p-1 border-l border-blue-900/40 text-blue-400/80 hover:text-blue-200"
                    />
                  </div>
                )}

                {/* Link Prompt Chat - immediately to the right of Google Drive link */}
                <a
                  href={promptChatUrl}
                  target="_blank"
                  rel="noreferrer"
                  title="Open Prompt Chat"
                  className="p-2 rounded-lg bg-[#132c1e] hover:bg-[#1a3827] text-emerald-400 border border-[#1e5233] transition-colors flex items-center justify-center cursor-pointer shadow-sm"
                >
                  <Link2 className="w-3.5 h-3.5" />
                </a>
              </div>

              {/* Second row: Quiz Dedicated ChatGPT Link Pill (Green if set, Amber if not) */}
              <div className="flex items-center gap-2 mt-2.5">
                <div
                  className={cn(
                    "flex items-center rounded-lg p-0.5 shadow-sm border",
                    currentQuizChatUrl
                      ? "bg-[#132c1e] border-[#1e5233] text-emerald-400"
                      : "bg-[#2c1d0c] border-[#4d3214] text-amber-400"
                  )}
                >
                  {currentQuizChatUrl ? (
                    <a
                      href={currentQuizChatUrl}
                      target="_blank"
                      rel="noreferrer"
                      title={`Open Quiz ChatGPT: ${currentQuizChatUrl}`}
                      className="p-1.5 rounded transition-colors flex items-center justify-center hover:text-emerald-300 hover:bg-[#1a3827]"
                    >
                      <MessageSquareCheck className="w-3.5 h-3.5" />
                    </a>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setIsChatModalOpen(true)}
                      title="Add ChatGPT Link for this quiz"
                      className="p-1.5 rounded transition-colors flex items-center justify-center hover:text-amber-300 hover:bg-[#382610] cursor-pointer"
                    >
                      <MessageSquarePlus className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setIsChatModalOpen(true)}
                    title={
                      currentQuizChatUrl
                        ? "Edit Quiz ChatGPT Link"
                        : "Add ChatGPT Link for this quiz"
                    }
                    className={cn(
                      "p-1.5 rounded transition-colors cursor-pointer border-l",
                      currentQuizChatUrl
                        ? "border-[#1e5233] hover:text-emerald-300 hover:bg-[#1a3827]"
                        : "border-[#4d3214] hover:text-amber-300 hover:bg-[#382610]"
                    )}
                  >
                    <Pencil className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Edit Quiz Chat Modal */}
      {nextQuiz && (
        <EditQuizChatModal
          isOpen={isChatModalOpen}
          onClose={() => setIsChatModalOpen(false)}
          quiz={nextQuiz}
          onSave={(_qId, newUrl) => {
            setCurrentQuizChatUrl(newUrl);
            nextQuiz.chatgpt_url = newUrl;
          }}
        />
      )}

      {/* Card Footer */}
      <div className="px-5 py-3.5 border-t border-[#2a2a2a] bg-[#181818]/80 flex items-center justify-between">
        <span className="text-[11px] text-[#777777]">Synced: {syncDate}</span>

        <div className="flex items-center gap-2">
          {/* Re-sync Drive button */}
          <button
            onClick={handleSync}
            disabled={isSyncing}
            title="Re-sync with Google Drive"
            className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-[#2c2c2c] transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin text-blue-400" : ""}`} />
          </button>

          {/* Edit Course button */}
          {onEditCourse && (
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onEditCourse(course);
              }}
              title="Edit Course Name & Info"
              className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-[#2c2c2c] transition-colors cursor-pointer"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Delete Course button */}
          <button
            onClick={handleDelete}
            title="Delete Course"
            className="p-1.5 text-gray-400 hover:text-red-400 rounded-lg hover:bg-red-950/30 transition-colors cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>

          {/* View Course Content button */}
          <Link
            href={`/courses/${course.id}`}
            className="flex items-center gap-1 ml-1 px-3 py-1 rounded-lg text-xs font-semibold text-white hover:text-blue-400 transition-colors"
          >
            <span>View Content</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
});
