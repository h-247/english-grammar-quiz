"use client";

import React, { useState, memo } from "react";
import {
  Clock,
  HelpCircle,
  Layers,
  Play,
  Trash2,
  X,
  Check,
  FileText,
  Upload,
  ExternalLink,
} from "lucide-react";
import { QuizSummary } from "@/types/quiz";
import { CopyDriveLinkButton } from "@/components/CopyDriveLinkButton";

interface QuizCardProps {
  quiz: QuizSummary;
  onStart: (quiz: QuizSummary) => void;
  onDelete?: (quiz: QuizSummary) => void;
  onUploadJson?: (quiz: QuizSummary) => void;
}

export const QuizCard = memo(function QuizCard({ quiz, onStart, onDelete, onUploadJson }: QuizCardProps) {
  const [confirmDelete, setConfirmDelete] = useState<boolean>(false);
  const isPending = quiz.status === "pending_import" || quiz.question_count === 0;

  return (
    <div
      className={`border rounded-xl p-6 shadow-sm transition-all flex flex-col justify-between group ${
        isPending
          ? "bg-[#212121]/80 border-[#383838]/70 hover:border-gray-500/50"
          : "bg-[#262626] border-[#383838] hover:border-[#555555]"
      }`}
    >
      <div>
        {/* Header Badges */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex flex-wrap items-center gap-2">
            {quiz.unit_number ? (
              <span className="px-2.5 py-1 rounded bg-[#333333] text-xs font-semibold uppercase tracking-wider text-[#ECECEC]">
                Unit {quiz.unit_number}
              </span>
            ) : (
              <span className="px-2.5 py-1 rounded bg-[#333333] text-xs font-semibold uppercase tracking-wider text-[#ECECEC]">
                Quiz
              </span>
            )}

            {isPending ? (
              <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                Awaiting JSON
              </span>
            ) : (
              <div className="flex items-center gap-1.5 text-xs text-[#9CA3AF]">
                <Clock className="w-3.5 h-3.5 text-emerald-400" />
                <span>Default 15m</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            {/* Google Drive PDF link */}
            {quiz.drive_file_id && (
              <div className="flex items-center rounded-lg bg-blue-950/20 border border-blue-900/30 p-0.5">
                <a
                  href={`https://drive.google.com/file/d/${quiz.drive_file_id}/view`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1 rounded text-blue-400 hover:text-blue-300 hover:bg-blue-950/40 transition-colors"
                  title="View Theory PDF on Google Drive"
                  onClick={(e) => e.stopPropagation()}
                >
                  <FileText className="w-3.5 h-3.5" />
                </a>
                <CopyDriveLinkButton
                  fileId={quiz.drive_file_id}
                  title="Copy Drive PDF link"
                  className="p-1 border-l border-blue-900/40 text-blue-400/80 hover:text-blue-200"
                />
              </div>
            )}

            {/* Delete Button */}
            {onDelete && (
              <div>
                {confirmDelete ? (
                  <div className="flex items-center gap-1 bg-[#1A1A1A] border border-rose-500/50 rounded-lg p-1 text-xs">
                    <span className="text-[11px] text-rose-300 px-1">Delete?</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(quiz);
                        setConfirmDelete(false);
                      }}
                      className="p-1 rounded bg-rose-600 hover:bg-rose-500 text-white transition-colors cursor-pointer"
                      title="Confirm deletion"
                    >
                      <Check className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setConfirmDelete(false);
                      }}
                      className="p-1 rounded bg-[#333333] hover:bg-[#444444] text-[#ECECEC] transition-colors cursor-pointer"
                      title="Cancel"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setConfirmDelete(true);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-[#9CA3AF] hover:text-rose-400 hover:bg-rose-950/30 transition-all cursor-pointer"
                    title="Delete quiz"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Title */}
        <h3 className="text-lg font-semibold text-[#ECECEC] mb-2 group-hover:text-white transition-colors">
          {quiz.title}
        </h3>

        {/* Stats or Pending Notice */}
        {isPending ? (
          <div className="my-4 p-3 bg-[#1A1A1A] rounded-lg border border-[#333333] text-xs text-gray-400 space-y-1">
            <div className="flex items-center justify-between text-amber-400/90 font-medium">
              <span>Google Drive Unit File</span>
              {quiz.source_filename && (
                <span className="truncate max-w-[160px] text-[11px] text-gray-500">
                  {quiz.source_filename}
                </span>
              )}
            </div>
            <p className="text-[11px] text-gray-500 leading-snug">
              Quiz placeholder created from Drive. Import JSON questions to enable practice & exams.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 my-4 p-3 bg-[#1A1A1A] rounded-lg border border-[#333333] text-xs">
            <div className="flex items-center gap-2 text-[#9CA3AF]">
              <HelpCircle className="w-4 h-4 text-white" />
              <div>
                <span className="text-[#ECECEC] font-bold block">{quiz.question_count}</span>
                <span>Questions</span>
              </div>
            </div>
            <div className="flex items-center gap-2 text-[#9CA3AF]">
              <Layers className="w-4 h-4 text-white" />
              <div>
                <span className="text-[#ECECEC] font-bold block">{quiz.blank_count}</span>
                <span>Answer Blanks</span>
              </div>
            </div>
          </div>
        )}

        {/* Topics */}
        {quiz.topics && quiz.topics.length > 0 && (
          <div className="mb-4">
            <span className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-wider block mb-1.5">
              Topics
            </span>
            <div className="flex flex-wrap gap-1.5">
              {quiz.topics.map((t) => (
                <span
                  key={t.id}
                  className="px-2 py-0.5 rounded bg-[#1f1f1f] border border-[#383838] text-[11px] font-medium text-[#A3A3A3]"
                >
                  {t.title}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Action Button */}
      <div className="pt-4 border-t border-[#333333]">
        {isPending ? (
          <div className="flex items-center gap-2">
            <button
              onClick={() => onUploadJson?.(quiz)}
              className="flex-1 py-2 px-3 rounded-lg text-xs font-semibold bg-[#383838] hover:bg-[#454545] text-white transition-colors flex items-center justify-center gap-1.5 cursor-pointer border border-gray-600/30"
            >
              <Upload className="w-3.5 h-3.5 text-blue-400" />
              <span>Upload JSON</span>
            </button>

            {quiz.drive_file_id && (
              <div className="flex items-center rounded-lg bg-[#1e1e1e] border border-blue-500/20 p-0.5">
                <a
                  href={`https://drive.google.com/file/d/${quiz.drive_file_id}/view`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="py-1.5 px-2.5 text-xs font-medium text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1"
                >
                  <span>PDF</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
                <CopyDriveLinkButton
                  fileId={quiz.drive_file_id}
                  title="Copy Drive PDF link"
                  className="p-1 border-l border-blue-500/30 text-blue-400/80 hover:text-blue-200"
                />
              </div>
            )}
          </div>
        ) : (
          <button
            onClick={() => onStart(quiz)}
            className="w-full py-2.5 px-4 rounded-lg text-sm font-semibold bg-white text-black hover:bg-neutral-200 transition-colors shadow-sm flex items-center justify-center gap-2 cursor-pointer"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>Start Quiz</span>
          </button>
        )}
      </div>
    </div>
  );
});
