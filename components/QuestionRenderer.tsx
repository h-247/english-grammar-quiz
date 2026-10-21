"use client";

import React, { useRef, useEffect } from "react";
import { QuestionPublic, QuestionCheckFeedback } from "@/types/quiz";
import { cn } from "@/lib/utils";
import { Sparkles, Loader2, CheckCircle2, XCircle, Lightbulb } from "lucide-react";

interface QuestionRendererProps {
  question: QuestionPublic;
  questionNumber: number;
  totalQuestions: number;
  answers: Record<string, string>; // blank_identifier -> response
  onAnswerChange: (blankIdentifier: string, value: string) => void;
  disabled?: boolean;
  isPracticeMode?: boolean;
  practiceFeedback?: QuestionCheckFeedback | null;
  onCheckQuestion?: () => void;
  isChecking?: boolean;
}

export function QuestionRenderer({
  question,
  questionNumber,
  totalQuestions,
  answers,
  onAnswerChange,
  disabled = false,
  isPracticeMode = false,
  practiceFeedback,
  onCheckQuestion,
  isChecking = false,
}: QuestionRendererProps) {
  const firstInputRef = useRef<HTMLInputElement>(null);

  // Focus the first empty blank or the first blank on question change
  useEffect(() => {
    if (!disabled && firstInputRef.current) {
      firstInputRef.current.focus();
    }
  }, [question.id, disabled]);

  // Parse prompt preserving lines and placeholders
  const lines = question.prompt.split("\n");

  let inputCounter = 0;

  return (
    <div className="bg-[#262626] border border-[#383838] rounded-xl p-6 sm:p-8 shadow-md">
      {/* Question Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 mb-6 border-b border-[#333333]">
        <div className="flex items-center gap-3">
          <span className="px-2.5 py-1 rounded bg-[#333333] text-xs font-semibold uppercase tracking-wider text-[#ECECEC]">
            Question {questionNumber} of {totalQuestions}
          </span>
          {question.topic && (
            <span className="px-2.5 py-1 rounded bg-[#1a1a1a] border border-[#383838] text-xs font-medium text-[#9CA3AF]">
              {question.topic.replace(/_/g, " ")}
            </span>
          )}
          {question.section && (
            <span className="text-xs text-[#9CA3AF] capitalize">
              • {question.section}
            </span>
          )}
        </div>
        <div className="text-xs text-[#9CA3AF] font-medium">
          {question.blank_count} {question.blank_count === 1 ? "blank" : "blanks"}
        </div>
      </div>

      {/* Question Title */}
      <h2 className="text-lg sm:text-xl font-semibold text-[#ECECEC] mb-6">
        {question.title}
      </h2>

      {/* Render Prompt with inline editable blanks */}
      <div className="space-y-3.5 text-base sm:text-lg leading-relaxed text-[#ECECEC]">
        {lines.map((line, lineIdx) => {
          // Split by {{n}} placeholders
          const segments = line.split(/(\{\{[^}]+\}\})/g);

          return (
            <div key={lineIdx} className="min-h-[1.75rem] flex flex-wrap items-center gap-y-2">
              {segments.map((seg, segIdx) => {
                if (seg.startsWith("{{") && seg.endsWith("}}")) {
                  const blankId = seg.slice(2, -2).trim();
                  const value = answers[blankId] || "";
                  const isFirstInput = inputCounter === 0;
                  inputCounter++;

                  const blankFeedback = practiceFeedback?.blanks?.find(
                    (b) => b.blank_identifier === blankId
                  );

                  return (
                    <span key={`${lineIdx}-${segIdx}-${blankId}`} className="inline-flex items-center gap-1.5 mx-1">
                      <input
                        ref={isFirstInput ? firstInputRef : undefined}
                        type="text"
                        disabled={disabled}
                        value={value}
                        placeholder={`[ ${blankId} ]`}
                        onChange={(e) => onAnswerChange(blankId, e.target.value)}
                        className={cn(
                          "quiz-blank-input text-center placeholder-[#6B7280] transition-colors",
                          value.trim().length > 0 && "filled border-[#4A4A4A] text-white font-medium",
                          blankFeedback &&
                            (blankFeedback.is_correct
                              ? "border-emerald-500 bg-emerald-950/40 text-emerald-200"
                              : "border-rose-500 bg-rose-950/40 text-rose-200"),
                          disabled && "opacity-60 cursor-not-allowed"
                        )}
                        aria-label={`Blank ${blankId}`}
                        autoComplete="off"
                        spellCheck="false"
                      />

                      {/* Practice mode per-blank icons & solution badge */}
                      {blankFeedback && (
                        blankFeedback.is_correct ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs">
                            <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                            {blankFeedback.correct_answer && (
                              <span className="px-1.5 py-0.5 rounded bg-rose-950/60 border border-rose-500/50 text-[11px] font-mono text-rose-200">
                                {blankFeedback.correct_answer}
                              </span>
                            )}
                          </span>
                        )
                      )}
                    </span>
                  );
                }

                // Regular text segment
                return (
                  <span key={segIdx} className="whitespace-pre-wrap">
                    {seg}
                  </span>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Practice Mode: Instant Check and Explanation */}
      {isPracticeMode && (
        <div className="mt-8 pt-6 border-t border-[#333333] space-y-4">
          <div className="flex items-center justify-between gap-4">
            <button
              type="button"
              onClick={onCheckQuestion}
              disabled={disabled || isChecking}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm transition-colors cursor-pointer shadow-sm disabled:opacity-50"
            >
              {isChecking ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Checking...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>{practiceFeedback ? "Re-check Answer" : "Check Answer"}</span>
                </>
              )}
            </button>

            {practiceFeedback && (
              <span className={cn(
                "text-xs font-semibold uppercase tracking-wider",
                practiceFeedback.is_fully_correct ? "text-emerald-400" : "text-amber-400"
              )}>
                {practiceFeedback.is_fully_correct ? "All blanks correct!" : "Review solution above"}
              </span>
            )}
          </div>

          {/* Explanation revealed immediately */}
          {practiceFeedback && practiceFeedback.explanation && (
            <div className="p-4 rounded-xl bg-[#1A1A1A] border border-[#383838] space-y-2 animate-in fade-in duration-200">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-amber-400">
                <Lightbulb className="w-4 h-4" />
                <span>Explanation & Grammar Rule</span>
              </div>
              <p className="text-sm text-[#D1D5DB] leading-relaxed whitespace-pre-line">
                {practiceFeedback.explanation}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
