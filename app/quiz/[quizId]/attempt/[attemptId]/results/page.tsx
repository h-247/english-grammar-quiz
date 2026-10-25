"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Trophy,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Layers,
  History,
  AlertTriangle,
  Lightbulb,
  Check,
  X,
  Loader2,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { getAttemptResults, startAttempt, practiceMistakesForAttempt } from "@/lib/api";
import { AttemptResultResponse, QuestionResultReview, TopicMasteryItem } from "@/types/quiz";
import { formatTime, cn } from "@/lib/utils";
import { useToast } from "@/components/Toast";
import { QuizHistoryModal } from "@/components/QuizHistoryModal";

type FilterMode = "incorrect" | "all";

function QuizResultsContent() {
  const params = useParams();
  const router = useRouter();
  const { showToast } = useToast();

  const quizId = params.quizId as string;
  const attemptId = params.attemptId as string;

  const [results, setResults] = useState<AttemptResultResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [filterMode, setFilterMode] = useState<FilterMode>("incorrect");
  const [isRetrying, setIsRetrying] = useState<boolean>(false);
  const [isPracticingMistakes, setIsPracticingMistakes] = useState<boolean>(false);
  const [isQuizHistoryOpen, setIsQuizHistoryOpen] = useState<boolean>(false);

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

  const handlePracticeMistakes = async () => {
    if (!results) return;
    setIsPracticingMistakes(true);
    try {
      const res = await practiceMistakesForAttempt(attemptId);
      showToast(res.message, "success", 4000);
      router.push(`/quiz/${res.quiz_id}/attempt/${res.attempt_id}`);
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : "Failed to start mistakes practice session.";
      showToast(msg, "info", 5000);
    } finally {
      setIsPracticingMistakes(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    async function loadResults() {
      try {
        const res = await getAttemptResults(attemptId);
        if (!isMounted) return;
        setResults(res);

        // If user got 100% correct, default filter to "all"
        if (res.incorrect_blanks === 0) {
          setFilterMode("all");
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Failed to load quiz results.";
        showToast(msg, "error", 6000);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadResults();
    return () => {
      isMounted = false;
    };
  }, [attemptId, showToast]);

  const handleRetry = async () => {
    if (!results) return;
    setIsRetrying(true);
    try {
      // Start a fresh attempt with original duration
      const durationMinutes = Math.round(results.duration_seconds / 60) || 15;
      const newAttempt = await startAttempt(quizId, durationMinutes);
      showToast("Starting new attempt...", "info", 3000);
      router.push(`/quiz/${quizId}/attempt/${newAttempt.id}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to start a new attempt.";
      showToast(msg, "error", 5000);
      setIsRetrying(false);
    }
  };

  if (isLoading || !results) {
    return (
      <div className="min-h-screen flex flex-col bg-[#212121]">
        <Navbar />
        <div className="flex-1 flex flex-col items-center justify-center text-[#9CA3AF]">
          <Loader2 className="w-8 h-8 animate-spin text-white mb-3" />
          <span className="text-sm">Calculating quiz results...</span>
        </div>
      </div>
    );
  }

  // Filter questions based on selected mode
  const filteredQuestions = results.questions.filter((q) => {
    if (filterMode === "all") return true;
    // In "incorrect" mode, include questions that have at least one incorrect/unanswered blank
    return !q.is_fully_correct;
  });

  const isPerfectScore = results.accuracy_percentage === 100 && results.incorrect_blanks === 0;

  return (
    <div className="min-h-screen flex flex-col bg-[#212121]">
      <Navbar />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* Results Header Card */}
        <div className="bg-[#262626] border border-[#383838] rounded-xl p-6 sm:p-8 shadow-md">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 pb-6 border-b border-[#333333]">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="px-2.5 py-0.5 rounded text-xs font-semibold uppercase tracking-wider bg-[#333333] text-[#ECECEC]">
                  {results.completion_status === "timed_out" ? "Timed Out" : "Completed"}
                </span>
                <span className="text-xs text-[#9CA3AF]">
                  via {results.submission_reason === "timeout" ? "Automatic Timeout" : "Manual Submission"}
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-[#ECECEC]">
                {results.quiz_title}
              </h1>
            </div>

            {/* Accuracy Score Display */}
            <div className="flex items-center gap-4 bg-[#1A1A1A] border border-[#383838] rounded-xl px-5 py-4">
              <Trophy className={cn("w-10 h-10", isPerfectScore ? "text-amber-400" : "text-white")} />
              <div>
                <span className="text-3xl sm:text-4xl font-extrabold text-white block">
                  {results.accuracy_percentage}%
                </span>
                <span className="text-xs font-medium text-[#9CA3AF] uppercase tracking-wider">
                  Accuracy Score
                </span>
              </div>
            </div>
          </div>

          {/* Key Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-6">
            <div className="bg-[#1A1A1A] border border-[#333333] rounded-lg p-3 text-center">
              <span className="text-xs text-[#9CA3AF] block mb-1">Total Blanks</span>
              <span className="text-xl font-bold text-white">{results.total_blanks}</span>
            </div>
            <div className="bg-[#1A1A1A] border border-emerald-500/30 rounded-lg p-3 text-center">
              <span className="text-xs text-emerald-400 block mb-1">Correct Blanks</span>
              <span className="text-xl font-bold text-emerald-400">{results.correct_blanks}</span>
            </div>
            <div className="bg-[#1A1A1A] border border-rose-500/30 rounded-lg p-3 text-center">
              <span className="text-xs text-rose-400 block mb-1">Incorrect Blanks</span>
              <span className="text-xl font-bold text-rose-400">{results.incorrect_blanks}</span>
            </div>
            <div className="bg-[#1A1A1A] border border-amber-500/30 rounded-lg p-3 text-center">
              <span className="text-xs text-amber-400 block mb-1">Unanswered</span>
              <span className="text-xl font-bold text-amber-400">{results.unanswered_blanks}</span>
            </div>
            <div className="bg-[#1A1A1A] border border-[#333333] rounded-lg p-3 text-center">
              <span className="text-xs text-[#9CA3AF] block mb-1">Correct Questions</span>
              <span className="text-xl font-bold text-white">
                {results.fully_correct_questions} / {results.total_questions}
              </span>
            </div>
            <div className="bg-[#1A1A1A] border border-[#333333] rounded-lg p-3 text-center">
              <span className="text-xs text-[#9CA3AF] block mb-1">Time Spent</span>
              <span className="text-xl font-bold text-white">{formatTime(results.time_spent_seconds)}</span>
            </div>
          </div>

          {/* Action Row */}
          <div className="flex flex-wrap items-center justify-between gap-4 mt-6 pt-6 border-t border-[#333333]">
            <div className="flex items-center gap-2">
              <Link
                href="/"
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-[#333333] hover:bg-[#404040] text-[#ECECEC] transition-colors border border-[#383838]"
              >
                <Layers className="w-4 h-4" />
                <span>Quiz Library</span>
              </Link>
              <button
                type="button"
                onClick={() => setIsQuizHistoryOpen(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-[#333333] hover:bg-[#404040] text-[#ECECEC] transition-colors border border-[#383838] cursor-pointer"
              >
                <History className="w-4 h-4 text-blue-400" />
                <span>Quiz Attempt History</span>
              </button>
            </div>

            <div className="flex items-center gap-3">
              {results.incorrect_blanks > 0 && (
                <button
                  type="button"
                  onClick={handlePracticeMistakes}
                  disabled={isPracticingMistakes}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/40 transition-all shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {isPracticingMistakes ? (
                    <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                  ) : (
                    <Sparkles className="w-4 h-4 text-amber-400" />
                  )}
                  <span>Practice Mistakes ({results.questions.filter((q) => !q.is_fully_correct).length})</span>
                </button>
              )}

              <button
                onClick={handleRetry}
                disabled={isRetrying}
                className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold bg-white text-black hover:bg-neutral-200 transition-colors shadow-sm cursor-pointer disabled:opacity-50"
              >
                {isRetrying ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Starting...</span>
                  </>
                ) : (
                  <>
                    <RotateCcw className="w-4 h-4" />
                    <span>Retry Quiz</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Topic Mastery Breakdown */}
        {topicMastery.length > 0 && (
          <div className="bg-[#262626] border border-[#383838] rounded-xl p-6 shadow-md space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#333333]">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-bold uppercase tracking-wider text-[#ECECEC]">
                  Grammar Topic Competency
                </h3>
              </div>
              <span className="text-xs text-[#9CA3AF]">
                {topicMastery.length} {topicMastery.length === 1 ? "topic" : "topics"} in this unit
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {topicMastery.map((tm) => (
                <div
                  key={tm.topic}
                  className="p-3.5 rounded-lg bg-[#1f1f1f] border border-[#363636] space-y-2"
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
                  <div className="w-full h-1.5 rounded-full bg-[#141414] overflow-hidden">
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

        {/* Review Section */}
        <div>
          {/* Review Filter Navigation */}
          <div className="flex items-center justify-between gap-4 mb-6">
            <h2 className="text-xl font-bold text-[#ECECEC]">Review Questions</h2>

            <div className="flex items-center gap-2 p-1 bg-[#262626] border border-[#383838] rounded-lg">
              <button
                onClick={() => setFilterMode("incorrect")}
                className={cn(
                  "px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer",
                  filterMode === "incorrect"
                    ? "bg-white text-black shadow-xs"
                    : "text-[#9CA3AF] hover:text-[#ECECEC]"
                )}
              >
                Incorrect Answers ({results.questions.filter((q) => !q.is_fully_correct).length})
              </button>
              <button
                onClick={() => setFilterMode("all")}
                className={cn(
                  "px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer",
                  filterMode === "all"
                    ? "bg-white text-black shadow-xs"
                    : "text-[#9CA3AF] hover:text-[#ECECEC]"
                )}
              >
                All Questions ({results.questions.length})
              </button>
            </div>
          </div>

          {/* Celebratory message if 100% correct */}
          {isPerfectScore && filterMode === "incorrect" && (
            <div className="bg-[#262626] border border-emerald-500/40 rounded-xl p-8 text-center space-y-3 shadow-sm">
              <div className="w-12 h-12 rounded-full bg-emerald-950 border border-emerald-500/50 flex items-center justify-center text-emerald-400 mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-[#ECECEC]">Outstanding Job! All answers are correct!</h3>
              <p className="text-xs text-[#9CA3AF] max-w-md mx-auto">
                You achieved a perfect 100% score with no incorrect blanks. Switch to &quot;All Questions&quot; above to review all solved questions and explanations.
              </p>
            </div>
          )}

          {/* Questions Review List */}
          <div className="space-y-6">
            {filteredQuestions.map((q) => (
              <QuestionReviewCard key={q.question_id} question={q} />
            ))}
          </div>
        </div>
      </main>

      {/* Quiz History & Score Statistics Modal */}
      <QuizHistoryModal
        quizId={quizId}
        quizTitle={results?.quiz_title}
        isOpen={isQuizHistoryOpen}
        onClose={() => setIsQuizHistoryOpen(false)}
        onStartExam={async (qId) => {
          setIsRetrying(true);
          try {
            const att = await startAttempt(qId, 15, "timed");
            router.push(`/quiz/${qId}/attempt/${att.id}`);
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : "Failed to start exam";
            showToast(msg, "error");
            setIsRetrying(false);
          }
        }}
        onStartPractice={async (qId) => {
          setIsRetrying(true);
          try {
            const att = await startAttempt(qId, 30, "practice");
            router.push(`/quiz/${qId}/attempt/${att.id}`);
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : "Failed to start practice";
            showToast(msg, "error");
            setIsRetrying(false);
          }
        }}
      />
    </div>
  );
}

function QuestionReviewCard({ question }: { question: QuestionResultReview }) {
  const lines = question.prompt.split("\n");

  return (
    <div className="bg-[#262626] border border-[#383838] rounded-xl p-6 shadow-sm space-y-6">
      {/* Question Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[#333333]">
        <div className="flex items-center gap-2.5">
          <span className="px-2.5 py-1 rounded bg-[#333333] text-xs font-semibold text-[#ECECEC]">
            Question {question.order_index + 1}
          </span>
          <span className="text-xs font-medium text-[#9CA3AF] bg-[#1A1A1A] border border-[#383838] px-2.5 py-1 rounded">
            {question.topic.replace(/_/g, " ")}
          </span>
          {question.section && (
            <span className="text-xs text-[#9CA3AF] capitalize">
              • {question.section}
            </span>
          )}
        </div>

        <div>
          {question.is_fully_correct ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-950/80 border border-emerald-500/60 text-emerald-300">
              <Check className="w-3.5 h-3.5" />
              <span>Question Correct</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-rose-950/80 border border-rose-500/60 text-rose-300">
              <X className="w-3.5 h-3.5" />
              <span>Needs Review</span>
            </span>
          )}
        </div>
      </div>

      {/* Title */}
      <h3 className="text-base sm:text-lg font-semibold text-[#ECECEC]">
        {question.title}
      </h3>

      {/* Original Question Text */}
      <div className="p-4 bg-[#1A1A1A] border border-[#333333] rounded-lg text-sm sm:text-base leading-relaxed text-[#ECECEC] space-y-2">
        {lines.map((line, lIdx) => (
          <div key={lIdx} className="whitespace-pre-wrap">
            {line}
          </div>
        ))}
      </div>

      {/* Blanks Breakdown */}
      <div className="space-y-3">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-[#9CA3AF]">
          Answers Breakdown
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {question.blanks.map((b) => {
            const hasMultipleAccepted = b.accepted_answers.length > 1;

            return (
              <div
                key={b.blank_identifier}
                className={cn(
                  "p-4 rounded-lg border text-sm space-y-2",
                  b.is_correct
                    ? "bg-[#1f2923]/60 border-emerald-500/40"
                    : b.is_unanswered
                    ? "bg-[#29261f]/60 border-amber-500/40"
                    : "bg-[#291f21]/60 border-rose-500/40"
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-xs text-[#ECECEC]">
                    Blank {b.blank_identifier}
                  </span>
                  {b.is_correct ? (
                    <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Correct
                    </span>
                  ) : b.is_unanswered ? (
                    <span className="text-xs font-semibold text-amber-400 flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" /> Unanswered
                    </span>
                  ) : (
                    <span className="text-xs font-semibold text-rose-400 flex items-center gap-1">
                      <XCircle className="w-3.5 h-3.5" /> Incorrect
                    </span>
                  )}
                </div>

                {/* Submitted answer */}
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#9CA3AF]">Your answer:</span>
                  <span
                    className={cn(
                      "font-mono font-semibold px-2 py-0.5 rounded",
                      b.is_correct
                        ? "bg-emerald-950 text-emerald-300"
                        : b.is_unanswered
                        ? "bg-amber-950 text-amber-300 italic"
                        : "bg-rose-950 text-rose-300 line-through"
                    )}
                  >
                    {b.is_unanswered ? "(empty)" : b.user_answer}
                  </span>
                </div>

                {/* Correct answer */}
                <div className="flex items-center justify-between text-xs pt-1 border-t border-[#383838]">
                  <span className="text-[#9CA3AF]">Correct answer:</span>
                  <span className="font-mono font-semibold text-white px-2 py-0.5 rounded bg-[#1A1A1A] border border-[#383838]">
                    {b.correct_answer}
                  </span>
                </div>

                {/* Other accepted answers if applicable */}
                {hasMultipleAccepted && (
                  <div className="text-[11px] text-[#9CA3AF] pt-1">
                    <span>Other accepted: </span>
                    <span className="font-mono text-[#ECECEC]">
                      {b.accepted_answers.filter((a) => a !== b.correct_answer).join(", ")}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Explanation Box */}
      {question.explanation && (
        <div className="p-4 rounded-lg bg-[#1f2429] border border-blue-500/40 text-sm space-y-1.5">
          <div className="flex items-center gap-2 text-blue-400 font-semibold text-xs uppercase tracking-wider">
            <Lightbulb className="w-4 h-4" />
            <span>Explanation</span>
          </div>
          <p className="text-xs sm:text-sm text-[#ECECEC] leading-relaxed">
            {question.explanation}
          </p>
        </div>
      )}
    </div>
  );
}

export default function QuizResultsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex flex-col bg-[#212121]">
          <Navbar />
          <div className="flex-1 flex flex-col items-center justify-center text-[#9CA3AF]">
            <Loader2 className="w-8 h-8 animate-spin text-white mb-3" />
            <span className="text-sm">Calculating quiz results...</span>
          </div>
        </div>
      }
    >
      <QuizResultsContent />
    </Suspense>
  );
}
