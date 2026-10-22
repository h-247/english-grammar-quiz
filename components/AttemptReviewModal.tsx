"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  X,
  CheckCircle2,
  XCircle,
  Sparkles,
  Lightbulb,
  Check,
  Loader2,
  BookOpen,
} from "lucide-react";
import { getAttemptResults, practiceMistakesForAttempt } from "@/lib/api";
import {
  AttemptResultResponse,
  TopicMasteryItem,
} from "@/types/quiz";
import { formatTime, formatDate, cn } from "@/lib/utils";
import { useToast } from "@/components/Toast";

interface AttemptReviewModalProps {
  attemptId: string | null;
  isOpen: boolean;
  onClose: () => void;
}

export function AttemptReviewModal({
  attemptId,
  isOpen,
  onClose,
}: AttemptReviewModalProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const [mounted, setMounted] = useState(false);

  const [isLoading, setIsLoading] = useState(true);
  const [results, setResults] = useState<AttemptResultResponse | null>(null);
  const [filterMode, setFilterMode] = useState<"all" | "incorrect">("all");
  const [isPracticingMistakes, setIsPracticingMistakes] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen && attemptId) {
      setIsLoading(true);
      getAttemptResults(attemptId)
        .then((data) => {
          setResults(data);
          if (data.incorrect_blanks > 0) {
            setFilterMode("incorrect");
          } else {
            setFilterMode("all");
          }
        })
        .catch((err) => {
          showToast(err.message || "Failed to load attempt details.", "error");
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [isOpen, attemptId, showToast]);

  if (!isOpen || !mounted || !attemptId) return null;

  // Calculate topic breakdown for this attempt
  const topicMastery: TopicMasteryItem[] = React.useMemo(() => {
    if (!results?.questions) return [];
    const stats = new Map<string, { total: number; correct: number }>();
    for (const q of results.questions) {
      const topic = (q.topic || "General Grammar").trim();
      if (!stats.has(topic)) stats.set(topic, { total: 0, correct: 0 });
      const item = stats.get(topic)!;
      for (const b of q.blanks || []) {
        item.total++;
        if (b.is_correct) item.correct++;
      }
    }
    const list: TopicMasteryItem[] = [];
    for (const [topic, s] of stats.entries()) {
      const pct = s.total > 0 ? Math.round((s.correct / s.total) * 100) : 0;
      let level: TopicMasteryItem["masteryLevel"] = "needs_practice";
      if (pct >= 90) level = "mastered";
      else if (pct >= 75) level = "proficient";
      else if (pct >= 50) level = "developing";
      list.push({
        topic,
        totalBlanks: s.total,
        correctBlanks: s.correct,
        percentage: pct,
        masteryLevel: level,
      });
    }
    return list.sort((a, b) => a.percentage - b.percentage);
  }, [results]);

  const handleStartMistakesPractice = async () => {
    if (!attemptId) return;
    setIsPracticingMistakes(true);
    try {
      const res = await practiceMistakesForAttempt(attemptId);
      showToast(res.message, "success", 4000);
      onClose();
      router.push(`/quiz/${res.quiz_id}/attempt/${res.attempt_id}`);
    } catch (err: any) {
      showToast(err.message || "Failed to generate mistake review session.", "info");
    } finally {
      setIsPracticingMistakes(false);
    }
  };

  const filteredQuestions =
    results?.questions.filter((q) => {
      if (filterMode === "all") return true;
      return !q.is_fully_correct;
    }) || [];

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div
        className="relative w-full max-w-4xl bg-[#1e1e1e] border border-[#383838] rounded-2xl shadow-2xl flex flex-col overflow-hidden max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#333333] bg-[#242424]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#2e2e2e] border border-[#404040] flex items-center justify-center text-white">
              <BookOpen className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#ECECEC] truncate max-w-md sm:max-w-xl">
                {results?.quiz_title || "Attempt Review"}
              </h2>
              <div className="flex items-center gap-2 text-xs text-[#9CA3AF] mt-0.5">
                <span>
                  {results?.started_at ? formatDate(results.started_at) : ""}
                </span>
                <span>•</span>
                <span className="capitalize text-emerald-400">
                  {results?.completion_status === "timed_out" ? "Timed Out" : "Completed"}
                </span>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {isLoading || !results ? (
            <div className="flex flex-col items-center justify-center py-20 text-[#9CA3AF]">
              <Loader2 className="w-8 h-8 animate-spin text-white mb-2" />
              <span className="text-xs">Loading detailed question responses...</span>
            </div>
          ) : (
            <>
              {/* Score & Summary KPI Banner */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-4 rounded-xl bg-[#262626] border border-[#383838] text-center">
                  <span
                    className={cn(
                      "text-2xl font-black block",
                      results.accuracy_percentage >= 80
                        ? "text-emerald-400"
                        : results.accuracy_percentage >= 50
                        ? "text-amber-400"
                        : "text-rose-400"
                    )}
                  >
                    {results.accuracy_percentage}%
                  </span>
                  <span className="text-[10px] text-[#9CA3AF] uppercase tracking-wider font-semibold">
                    Accuracy
                  </span>
                </div>

                <div className="p-4 rounded-xl bg-[#262626] border border-[#383838] text-center">
                  <span className="text-2xl font-black text-white block">
                    {results.correct_blanks} / {results.total_blanks}
                  </span>
                  <span className="text-[10px] text-[#9CA3AF] uppercase tracking-wider font-semibold">
                    Blanks Correct
                  </span>
                </div>

                <div className="p-4 rounded-xl bg-[#262626] border border-[#383838] text-center">
                  <span className="text-2xl font-black text-white block">
                    {results.fully_correct_questions} / {results.total_questions}
                  </span>
                  <span className="text-[10px] text-[#9CA3AF] uppercase tracking-wider font-semibold">
                    Full Questions
                  </span>
                </div>

                <div className="p-4 rounded-xl bg-[#262626] border border-[#383838] text-center">
                  <span className="text-2xl font-black text-white block">
                    {formatTime(results.time_spent_seconds || 0)}
                  </span>
                  <span className="text-[10px] text-[#9CA3AF] uppercase tracking-wider font-semibold">
                    Time Spent
                  </span>
                </div>
              </div>

              {/* Topic Mastery Breakdown */}
              {topicMastery.length > 0 && (
                <div className="p-4 rounded-xl bg-[#262626] border border-[#383838] space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#ECECEC] uppercase tracking-wider">
                      Grammar Topic Competency
                    </span>
                    <span className="text-xs text-[#9CA3AF]">
                      {topicMastery.length} {topicMastery.length === 1 ? "topic" : "topics"} tested
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {topicMastery.map((tm) => (
                      <div
                        key={tm.topic}
                        className="p-3 rounded-lg bg-[#202020] border border-[#333333] space-y-1.5"
                      >
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-neutral-200 truncate max-w-[200px]">
                            {tm.topic}
                          </span>
                          <span
                            className={cn(
                              "font-bold",
                              tm.percentage >= 80
                                ? "text-emerald-400"
                                : tm.percentage >= 50
                                ? "text-amber-400"
                                : "text-rose-400"
                            )}
                          >
                            {tm.percentage}% ({tm.correctBlanks}/{tm.totalBlanks})
                          </span>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-[#303030] overflow-hidden">
                          <div
                            className={cn(
                              "h-full rounded-full transition-all duration-500",
                              tm.percentage >= 80
                                ? "bg-emerald-400"
                                : tm.percentage >= 50
                                ? "bg-amber-400"
                                : "bg-rose-500"
                            )}
                            style={{ width: `${tm.percentage}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Bar & Question Filter */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <div className="flex items-center gap-1.5 p-1 rounded-lg bg-[#262626] border border-[#383838]">
                  <button
                    type="button"
                    onClick={() => setFilterMode("all")}
                    className={cn(
                      "px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer",
                      filterMode === "all"
                        ? "bg-[#383838] text-white"
                        : "text-[#9CA3AF] hover:text-white"
                    )}
                  >
                    All Questions ({results.questions.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterMode("incorrect")}
                    className={cn(
                      "px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer",
                      filterMode === "incorrect"
                        ? "bg-rose-950/70 border border-rose-800/40 text-rose-300"
                        : "text-[#9CA3AF] hover:text-white"
                    )}
                  >
                    Mistakes Only ({results.questions.filter((q) => !q.is_fully_correct).length})
                  </button>
                </div>

                {/* 1-Click Practice Mistakes Button */}
                {results.incorrect_blanks > 0 && (
                  <button
                    type="button"
                    onClick={handleStartMistakesPractice}
                    disabled={isPracticingMistakes}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/40 transition-all shadow-sm cursor-pointer disabled:opacity-50"
                  >
                    {isPracticingMistakes ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    )}
                    <span>Practice Mistakes Only ({results.questions.filter((q) => !q.is_fully_correct).length})</span>
                  </button>
                )}
              </div>

              {/* Questions List */}
              <div className="space-y-4">
                {filteredQuestions.length === 0 ? (
                  <div className="p-8 text-center rounded-xl bg-[#262626] border border-[#383838] text-[#9CA3AF] space-y-2">
                    <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
                    <p className="text-sm font-semibold text-white">No mistakes in this filter!</p>
                    <p className="text-xs">Switch to &ldquo;All Questions&rdquo; to review everything.</p>
                  </div>
                ) : (
                  filteredQuestions.map((q, idx) => {
                    return (
                      <div
                        key={q.question_id || idx}
                        className={cn(
                          "rounded-xl border p-5 space-y-3 transition-colors",
                          q.is_fully_correct
                            ? "bg-[#232a24] border-emerald-900/40"
                            : "bg-[#2c2223] border-rose-900/40"
                        )}
                      >
                        {/* Question Title & Topic */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-2">
                            {q.is_fully_correct ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                            ) : (
                              <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                            )}
                            <span className="text-xs font-bold text-white uppercase tracking-wider">
                              Question {q.order_index}
                            </span>
                            {q.topic && (
                              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-[#1e1e1e] border border-[#444444] text-[#a3a3a3]">
                                {q.topic}
                              </span>
                            )}
                          </div>
                          <span
                            className={cn(
                              "text-[11px] font-bold px-2 py-0.5 rounded",
                              q.is_fully_correct
                                ? "bg-emerald-950/80 text-emerald-300"
                                : "bg-rose-950/80 text-rose-300"
                            )}
                          >
                            {q.is_fully_correct ? "Correct" : "Incorrect"}
                          </span>
                        </div>

                        {/* Prompt */}
                        <div className="text-sm text-[#ECECEC] font-medium leading-relaxed bg-[#1a1a1a]/70 p-3.5 rounded-lg border border-[#383838]">
                          {q.prompt}
                        </div>

                        {/* Blanks Breakdown */}
                        <div className="space-y-2 pt-1">
                          {q.blanks?.map((b) => (
                            <div
                              key={b.blank_identifier}
                              className={cn(
                                "flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded-lg text-xs border",
                                b.is_correct
                                  ? "bg-emerald-950/20 border-emerald-900/30 text-emerald-300"
                                  : "bg-rose-950/30 border-rose-900/40 text-rose-300"
                              )}
                            >
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-bold text-[11px] px-1.5 py-0.5 rounded bg-black/40 text-white">
                                  {b.blank_identifier}
                                </span>
                                <span>
                                  Your Answer:{" "}
                                  <strong className={b.is_correct ? "text-emerald-300" : "text-rose-400 line-through"}>
                                    {b.user_answer ? `"${b.user_answer}"` : "(unanswered)"}
                                  </strong>
                                </span>
                              </div>

                              <div className="flex items-center gap-2">
                                <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                <span>
                                  Accepted:{" "}
                                  <strong className="text-emerald-300">
                                    {b.accepted_answers?.join(" / ") || b.correct_answer}
                                  </strong>
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Grammatical Explanation */}
                        {q.explanation && (
                          <div className="p-3 rounded-lg bg-[#20252a] border border-blue-900/30 flex items-start gap-2.5 text-xs text-blue-200">
                            <Lightbulb className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                            <div className="space-y-0.5">
                              <span className="font-semibold text-blue-300 block">Grammar Explanation:</span>
                              <p className="leading-relaxed text-blue-100/90">{q.explanation}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-6 py-3.5 border-t border-[#333333] bg-[#242424]">
          <span className="text-xs text-[#9CA3AF]">
            Review mode • Read-only inspection
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold bg-white text-black hover:bg-neutral-200 rounded-lg transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
