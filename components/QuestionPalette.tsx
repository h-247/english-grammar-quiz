"use client";

import React from "react";
import { QuestionPublic } from "@/types/quiz";
import { cn } from "@/lib/utils";

interface QuestionPaletteProps {
  questions: QuestionPublic[];
  currentIndex: number;
  userAnswers: Record<string, Record<string, string>>; // question_id -> { blank_id: response }
  onSelectQuestion: (index: number) => void;
  className?: string;
}

export function QuestionPalette({
  questions,
  currentIndex,
  userAnswers,
  onSelectQuestion,
  className,
}: QuestionPaletteProps) {
  // A question is answered if all its required blanks have nonempty responses
  const isQuestionAnswered = (q: QuestionPublic): boolean => {
    const qAnswers = userAnswers[q.id] || {};
    if (q.blanks.length === 0) return false;
    return q.blanks.every((b) => {
      const val = qAnswers[b.blank_identifier];
      return typeof val === "string" && val.trim().length > 0;
    });
  };

  const answeredCount = questions.filter(isQuestionAnswered).length;
  const progressPercent = questions.length > 0 ? Math.round((answeredCount / questions.length) * 100) : 0;

  return (
    <div className={cn("bg-[#262626] border border-[#383838] rounded-xl p-5 shadow-sm", className)}>
      {/* Header and Progress */}
      <div className="flex items-center justify-between mb-3 text-sm">
        <span className="font-medium text-[#ECECEC]">Questions Navigation</span>
        <span className="text-xs font-semibold text-[#9CA3AF]">
          {answeredCount} / {questions.length} answered ({progressPercent}%)
        </span>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-[#1A1A1A] h-2 rounded-full mb-4 overflow-hidden border border-[#333333]">
        <div
          className="bg-emerald-500 h-full transition-all duration-300"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Grid of Question Buttons */}
      <div className="grid grid-cols-5 sm:grid-cols-6 md:grid-cols-11 lg:grid-cols-8 xl:grid-cols-11 gap-2">
        {questions.map((q, idx) => {
          const isCurrent = idx === currentIndex;
          const answered = isQuestionAnswered(q);

          return (
            <button
              key={q.id}
              onClick={() => onSelectQuestion(idx)}
              className={cn(
                "relative flex items-center justify-center h-10 w-full rounded-lg text-sm font-semibold transition-all cursor-pointer border",
                isCurrent && "ring-2 ring-white border-transparent text-white font-bold scale-105 z-10",
                answered
                  ? "bg-emerald-950/70 border-emerald-500/60 text-emerald-300 hover:bg-emerald-900/80"
                  : "bg-[#1A1A1A] border-[#383838] text-[#9CA3AF] hover:text-[#ECECEC] hover:border-[#555555]",
                !isCurrent && answered && "shadow-xs"
              )}
              aria-label={`Jump to question ${idx + 1}`}
            >
              <span>{idx + 1}</span>
              {answered && (
                <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-400" />
              )}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-between mt-4 pt-3 border-t border-[#333333] text-xs text-[#9CA3AF]">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
          <span>Answered</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-[#383838]" />
          <span>Unanswered</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm border-2 border-white bg-transparent" />
          <span>Current</span>
        </div>
      </div>
    </div>
  );
}
