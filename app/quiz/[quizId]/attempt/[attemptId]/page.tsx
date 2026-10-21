"use client";

import React, { useEffect, useState, useRef, useCallback, Suspense } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  Send,
  Loader2,
  CheckCircle2,
  AlertCircle,
  BookOpen,
} from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { CountdownTimer } from "@/components/CountdownTimer";
import { QuestionRenderer } from "@/components/QuestionRenderer";
import { QuestionPalette } from "@/components/QuestionPalette";
import { SubmitDialog } from "@/components/SubmitDialog";
import { getAttempt, saveAnswers, submitAttempt, checkQuestionAnswers } from "@/lib/api";
import { AttemptState, QuestionPublic, QuestionCheckFeedback } from "@/types/quiz";
import { useToast } from "@/components/Toast";
import { cn } from "@/lib/utils";

type SaveStatus = "saved" | "saving" | "error";

function QuizSessionContent() {
  const params = useParams();
  const router = useRouter();
  const { showToast } = useToast();

  const quizId = params.quizId as string;
  const attemptId = params.attemptId as string;

  const [attemptState, setAttemptState] = useState<AttemptState | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState<number>(0);

  // User responses dictionary: question_id -> { blank_id: answer_text }
  const [answers, setAnswers] = useState<Record<string, Record<string, string>>>({});
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");

  // Practice mode feedback state: question_id -> QuestionCheckFeedback
  const [practiceFeedback, setPracticeFeedback] = useState<Record<string, QuestionCheckFeedback>>({});
  const [isCheckingQuestion, setIsCheckingQuestion] = useState<boolean>(false);

  const [isSubmitOpen, setIsSubmitOpen] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const latestAnswersRef = useRef<Record<string, Record<string, string>>>({});

  // Sync latest answers in effect to adhere to React render purity rules
  useEffect(() => {
    latestAnswersRef.current = answers;
  }, [answers]);

  // Load attempt state on mount
  useEffect(() => {
    let isMounted = true;

    async function loadAttempt() {
      try {
        const state = await getAttempt(attemptId);
        if (!isMounted) return;

        // If attempt is already finished, redirect to results
        if (state.status === "completed" || state.status === "timed_out") {
          router.replace(`/quiz/${quizId}/attempt/${attemptId}/results`);
          return;
        }

        setAttemptState(state);
        setAnswers(state.saved_answers || {});
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Failed to load quiz session.";
        showToast(msg, "error", 6000);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadAttempt();

    return () => {
      isMounted = false;
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [attemptId, quizId, router, showToast]);

  // Execute autosave to backend
  const triggerSave = useCallback(
    async (answersToSave: Record<string, Record<string, string>>) => {
      setSaveStatus("saving");
      try {
        const res = await saveAnswers(attemptId, answersToSave);
        if (res.is_expired) {
          showToast("Time is up! Your quiz has been submitted automatically.", "warning", 6000);
          router.replace(`/quiz/${quizId}/attempt/${attemptId}/results`);
          return;
        }
        setSaveStatus("saved");
      } catch {
        setSaveStatus("error");
      }
    },
    [attemptId, quizId, router, showToast]
  );

  // Handle blank input change with 1.2s debounced autosave
  const handleAnswerChange = (blankId: string, value: string) => {
    if (!attemptState) return;

    const currentQuestion = attemptState.questions[currentQuestionIndex];
    if (!currentQuestion) return;

    const qId = currentQuestion.id;
    const updated = {
      ...answers,
      [qId]: {
        ...(answers[qId] || {}),
        [blankId]: value,
      },
    };

    setAnswers(updated);
    setSaveStatus("saving");

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      triggerSave(updated);
    }, 1200);
  };

  // Immediate save when changing questions
  const navigateToQuestion = (newIndex: number) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      triggerSave(latestAnswersRef.current);
    }
    setCurrentQuestionIndex(newIndex);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Instant feedback evaluation in Practice Mode
  const handleCheckQuestion = async () => {
    if (!attemptState) return;
    const currentQuestion = attemptState.questions[currentQuestionIndex];
    if (!currentQuestion) return;

    setIsCheckingQuestion(true);
    try {
      const currentAnswers = answers[currentQuestion.id] || {};
      const feedback = await checkQuestionAnswers(attemptId, currentQuestion.id, currentAnswers);
      setPracticeFeedback((prev) => ({
        ...prev,
        [currentQuestion.id]: feedback,
      }));
      setSaveStatus("saved");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to check question answers.";
      showToast(msg, "error", 4000);
    } finally {
      setIsCheckingQuestion(false);
    }
  };

  // Timeout handler triggered by countdown
  const handleTimeout = useCallback(async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await submitAttempt(attemptId, latestAnswersRef.current);
      showToast("Time is up! Your quiz has been submitted automatically.", "warning", 6000);
      router.replace(`/quiz/${quizId}/attempt/${attemptId}/results`);
    } catch {
      router.replace(`/quiz/${quizId}/attempt/${attemptId}/results`);
    }
  }, [attemptId, isSubmitting, quizId, router, showToast]);

  // Manual submission confirmation
  const handleManualSubmit = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      await submitAttempt(attemptId, latestAnswersRef.current);
      showToast(
        attemptState?.mode === "practice"
          ? "Practice session completed!"
          : "Quiz submitted successfully!",
        "success",
        4000
      );
      setIsSubmitOpen(false);
      router.replace(`/quiz/${quizId}/attempt/${attemptId}/results`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to submit quiz.";
      showToast(msg, "error", 5000);
      setIsSubmitting(false);
    }
  };

  if (isLoading || !attemptState) {
    return (
      <div className="min-h-screen flex flex-col bg-[#212121]">
        <Navbar />
        <div className="flex-1 flex flex-col items-center justify-center text-[#9CA3AF]">
          <Loader2 className="w-8 h-8 animate-spin text-white mb-3" />
          <span className="text-sm">Preparing quiz session...</span>
        </div>
      </div>
    );
  }

  const questions = attemptState.questions;
  const currentQuestion: QuestionPublic = questions[currentQuestionIndex];
  const currentQAnswers = answers[currentQuestion?.id] || {};
  const isPractice = attemptState.mode === "practice";

  // Count total unanswered blanks
  let totalBlanksCount = 0;
  let unansweredBlanksCount = 0;

  for (const q of questions) {
    totalBlanksCount += q.blanks.length;
    const qAnswers = answers[q.id] || {};
    for (const b of q.blanks) {
      const val = qAnswers[b.blank_identifier];
      if (!val || val.trim().length === 0) {
        unansweredBlanksCount++;
      }
    }
  }

  const isFirst = currentQuestionIndex === 0;
  const isLast = currentQuestionIndex === questions.length - 1;

  return (
    <div className="min-h-screen flex flex-col bg-[#212121]">
      {/* Quiz Top Action Bar */}
      <header className="sticky top-0 z-40 w-full border-b border-[#383838] bg-[#212121]/95 backdrop-blur-md px-4 sm:px-6 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          {/* Quiz Title & Question Index */}
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-semibold text-[#ECECEC] truncate">
                {attemptState.quiz_title}
              </h1>
              {isPractice && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-500/40 text-[11px] font-semibold text-emerald-300 shrink-0">
                  <BookOpen className="w-3 h-3" />
                  <span>Practice Mode</span>
                </span>
              )}
            </div>
            <div className="text-xs text-[#9CA3AF] flex items-center gap-2 mt-0.5">
              <span>Question {currentQuestionIndex + 1} of {questions.length}</span>
              <span>•</span>
              {/* Autosave status indicator */}
              <span className="flex items-center gap-1">
                {saveStatus === "saving" && (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin text-[#9CA3AF]" />
                    <span>Saving...</span>
                  </>
                )}
                {saveStatus === "saved" && (
                  <>
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    <span className="text-emerald-400/90">Saved</span>
                  </>
                )}
                {saveStatus === "error" && (
                  <>
                    <AlertCircle className="w-3 h-3 text-rose-400" />
                    <span className="text-rose-400">Save failed</span>
                  </>
                )}
              </span>
            </div>
          </div>

          {/* Timer and Submit Action */}
          <div className="flex items-center gap-3 shrink-0">
            <CountdownTimer
              deadlineAt={attemptState.deadline_at}
              startedAt={attemptState.started_at}
              serverNow={attemptState.server_now}
              mode={attemptState.mode || "timed"}
              onExpire={handleTimeout}
            />

            <button
              onClick={() => setIsSubmitOpen(true)}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-semibold bg-white text-black hover:bg-neutral-200 transition-colors shadow-sm cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">
                {isPractice ? "Finish Practice" : "Submit Quiz"}
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Quiz View */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Active Question */}
        <div className="lg:col-span-8 space-y-6">
          {currentQuestion && (
            <QuestionRenderer
              question={currentQuestion}
              questionNumber={currentQuestionIndex + 1}
              totalQuestions={questions.length}
              answers={currentQAnswers}
              onAnswerChange={handleAnswerChange}
              isPracticeMode={isPractice}
              practiceFeedback={practiceFeedback[currentQuestion.id] || null}
              onCheckQuestion={handleCheckQuestion}
              isChecking={isCheckingQuestion}
            />
          )}

          {/* Navigation Controls */}
          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              disabled={isFirst}
              onClick={() => navigateToQuestion(currentQuestionIndex - 1)}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium border transition-colors cursor-pointer",
                isFirst
                  ? "bg-[#1A1A1A] border-[#333333] text-[#6B7280] opacity-50 cursor-not-allowed"
                  : "bg-[#262626] border-[#383838] text-[#ECECEC] hover:bg-[#333333]"
              )}
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Previous Question</span>
            </button>

            {isLast ? (
              <button
                type="button"
                onClick={() => setIsSubmitOpen(true)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold bg-white text-black hover:bg-neutral-200 transition-colors shadow-sm cursor-pointer"
              >
                <span>{isPractice ? "Review & Finish" : "Review & Submit"}</span>
                <Send className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => navigateToQuestion(currentQuestionIndex + 1)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold bg-white text-black hover:bg-neutral-200 transition-colors shadow-sm cursor-pointer"
              >
                <span>Next Question</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Right Column: Question Palette Navigation */}
        <div className="lg:col-span-4 sticky top-24">
          <QuestionPalette
            questions={questions}
            currentIndex={currentQuestionIndex}
            userAnswers={answers}
            onSelectQuestion={navigateToQuestion}
          />
        </div>
      </main>

      {/* Submit Confirmation Dialog */}
      <SubmitDialog
        isOpen={isSubmitOpen}
        totalBlanks={totalBlanksCount}
        unansweredBlanks={unansweredBlanksCount}
        isSubmitting={isSubmitting}
        onConfirm={handleManualSubmit}
        onCancel={() => setIsSubmitOpen(false)}
      />
    </div>
  );
}

export default function QuizSessionPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex flex-col bg-[#212121]">
          <Navbar />
          <div className="flex-1 flex flex-col items-center justify-center text-[#9CA3AF]">
            <Loader2 className="w-8 h-8 animate-spin text-white mb-3" />
            <span className="text-sm">Preparing quiz session...</span>
          </div>
        </div>
      }
    >
      <QuizSessionContent />
    </Suspense>
  );
}
