"use client";

import React, { useState, memo } from "react";
import {
  Play,
  Trash2,
  X,
  Check,
  FileText,
  ExternalLink,
  HardDrive,
} from "lucide-react";
import { QuizSummary } from "@/types/quiz";
import { CopyDriveLinkButton } from "@/components/CopyDriveLinkButton";
import { SharedPromptLinkSettings } from "@/components/SharedPromptLinkSettings";
import { ChatGPTLinkActions } from "@/components/ChatGPTLinkActions";

interface QuizCardProps {
  quiz: QuizSummary;
  onStart: (quiz: QuizSummary) => void;
  onDelete?: (quiz: QuizSummary) => void;
  onUploadJson?: (quiz: QuizSummary) => void;
}

export const QuizCard = memo(function QuizCard({ quiz, onStart, onDelete }: QuizCardProps) {
  const [confirmDelete, setConfirmDelete] = useState<boolean>(false);
  const chapterStatus = quiz.status || "To do";
  const hasQuestions = quiz.question_count > 0;

  return (
    <div
      className="border rounded-xl p-6 shadow-sm transition-all flex flex-col justify-between group bg-[#262626] border-[#383838] hover:border-[#555555]"
    >
      <div>
        {/* Header Badges */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2.5 py-1 rounded bg-[#333333] text-xs font-semibold uppercase tracking-wider text-[#ECECEC]">
              {quiz.unit_number != null ? `Chapter ${quiz.unit_number}` : "Chapter"}
            </span>

            <span
              className={`px-2 py-0.5 rounded text-[11px] font-medium border ${
                chapterStatus === "Done"
                  ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                  : chapterStatus === "Doing"
                  ? "bg-amber-500/15 text-amber-300 border-amber-500/30"
                  : "bg-neutral-800 text-neutral-300 border-neutral-700"
              }`}
            >
              {chapterStatus}
            </span>
          </div>

          {onDelete && (
            <div>
              {confirmDelete ? (
                <div className="flex items-center gap-1.5 animate-in fade-in duration-150">
                  <span className="text-xs text-rose-400 font-medium mr-1">Delete?</span>
                  <button
                    onClick={() => {
                      onDelete(quiz);
                      setConfirmDelete(false);
                    }}
                    className="p-1.5 rounded-lg bg-rose-900/50 hover:bg-rose-800 text-rose-200 transition-colors"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setConfirmDelete(false)}
                    className="p-1.5 rounded-lg bg-[#333333] hover:bg-[#404040] text-gray-300 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-rose-400 hover:bg-[#333333] transition-colors opacity-0 group-hover:opacity-100"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Title */}
        <h3 className="text-lg font-bold text-white mb-2 line-clamp-2">
          {quiz.unit_title || quiz.title}
        </h3>

        {/* Instructions */}
        {quiz.instructions && (
          <p className="text-xs text-gray-400 mb-4 line-clamp-2">
            {quiz.instructions}
          </p>
        )}

        {/* Drive file source */}
        {quiz.source_filename && (
          <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-4">
            <FileText className="w-3.5 h-3.5 text-gray-500" />
            <span className="truncate">{quiz.source_filename}</span>
          </div>
        )}
      </div>

      {/* Action Button */}
      <div className="pt-4 border-t border-[#333333]">
        <div className="flex items-center gap-2">
          {quiz.drive_file_id && (
            <div className="flex-1 flex items-center rounded-lg bg-[#1e1e1e] border border-blue-500/20 p-0.5">
              <a
                href={`https://drive.google.com/file/d/${quiz.drive_file_id}/view`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 py-1.5 px-2.5 text-xs font-medium text-blue-400 hover:text-blue-300 transition-colors flex items-center justify-center gap-1.5"
              >
                <HardDrive className="w-3.5 h-3.5" />
                <span>Drive PDF</span>
                <ExternalLink className="w-3 h-3 opacity-70" />
              </a>
              <CopyDriveLinkButton
                fileId={quiz.drive_file_id}
                title="Copy Drive PDF link"
                className="p-1 border-l border-blue-500/30 text-blue-400/80 hover:text-blue-200"
              />
            </div>
          )}

          {hasQuestions ? (
            <button
              onClick={() => onStart(quiz)}
              className="flex-1 py-2 px-3 rounded-lg text-xs font-semibold bg-white text-black hover:bg-neutral-200 transition-colors shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Practice</span>
            </button>
          ) : !quiz.drive_file_id ? (
            <div className="text-xs text-gray-500 italic py-1">
              Chapter saved
            </div>
          ) : null}

          <SharedPromptLinkSettings compact canEdit={false} />
          <ChatGPTLinkActions
            url={quiz.chatgpt_url}
            chapterId={quiz.id}
            chapterTitle={quiz.title}
            onSaved={(newUrl) => {
              quiz.chatgpt_url = newUrl;
            }}
          />
        </div>
      </div>
    </div>
  );
});

export const ChapterCard = QuizCard;
