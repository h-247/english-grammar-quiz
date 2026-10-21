"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  ExternalLink,
  RefreshCw,
  Trash2,
  Play,
  BookOpen,
  ArrowRight,
  HardDrive,
  CheckCircle2,
  Clock,
  Layers,
  Sparkles,
} from "lucide-react";
import { CourseSummary, QuizSummary } from "@/types/quiz";
import { DEFAULT_COURSE_BANNER, DEFAULT_PROMPT_CHAT_URL } from "@/lib/course-manifest";

interface CourseCardProps {
  course: CourseSummary;
  quizzes?: QuizSummary[];
  onSyncDrive: (courseId: string) => Promise<void>;
  onDeleteCourse: (course: CourseSummary) => void;
  onStartQuiz: (quiz: QuizSummary, mode: "timed" | "practice") => void;
}

export function CourseCard({
  course,
  quizzes = [],
  onSyncDrive,
  onDeleteCourse,
  onStartQuiz,
}: CourseCardProps) {
  const [isSyncing, setIsSyncing] = useState(false);

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
  const syncDate = new Date(course.updated_at).toLocaleDateString("en-US", {
    month: "numeric",
    day: "numeric",
    year: "numeric",
  });

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
              <a
                href={course.drive_folder_url}
                target="_blank"
                rel="noreferrer"
                title="Open Folder on Google Drive"
                className="text-gray-400 hover:text-white p-1 rounded-md hover:bg-[#2c2c2c] transition-colors shrink-0"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
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
                  <a
                    href={`https://drive.google.com/file/d/${nextQuiz.drive_file_id}/view`}
                    target="_blank"
                    rel="noreferrer"
                    title="View Source PDF on Google Drive"
                    className="flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-[#222222] hover:bg-[#2d2d2d] text-blue-400 border border-blue-900/30 transition-colors"
                  >
                    <HardDrive className="w-3 h-3" />
                    <span>Drive</span>
                  </a>
                )}

                {/* Link Prompt Chat - immediately to the right of Google Drive link */}
                <a
                  href={DEFAULT_PROMPT_CHAT_URL}
                  target="_blank"
                  rel="noreferrer"
                  title="Open Prompt Chat"
                  className="flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-[#1a291e] hover:bg-[#223627] text-emerald-400 border border-emerald-900/40 transition-colors"
                >
                  <Sparkles className="w-3 h-3" />
                  <span>Prompt</span>
                </a>
              </div>
            </div>
          )}
        </div>
      </div>

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
}
