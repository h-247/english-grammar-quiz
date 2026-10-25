"use client";

import React, { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  X,
  History,
  Trophy,
  Zap,
  Target,
  Clock,
  Layers,
  Play,
  BookOpen,
  Eye,
  Loader2,
  AlertCircle,
  RefreshCw,
  TrendingUp,
} from "lucide-react";
import { getQuizHistory } from "@/lib/api";
import { QuizHistoryResponse } from "@/types/quiz";
import { formatDate, formatTime, cn } from "@/lib/utils";
import { AttemptReviewModal } from "@/components/AttemptReviewModal";

interface QuizHistoryModalProps {
  quizId: string | null;
  quizTitle?: string;
  isOpen: boolean;
  onClose: () => void;
  onStartExam?: (quizId: string) => void;
  onStartPractice?: (quizId: string) => void;
}

export function QuizHistoryModal({
  quizId,
  quizTitle,
  isOpen,
  onClose,
  onStartExam,
  onStartPractice,
}: QuizHistoryModalProps) {
  const [mounted, setMounted] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [data, setData] = useState<QuizHistoryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Attempt Inspection
  const [reviewAttemptId, setReviewAttemptId] = useState<string | null>(null);
  const [isReviewOpen, setIsReviewOpen] = useState<boolean>(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const loadHistory = useCallback(
    async (isSilent = false) => {
      if (!quizId) return;
      if (!isSilent) setIsLoading(true);
      else setIsRefreshing(true);
      setError(null);

      try {
        const res = await getQuizHistory(quizId);
        setData(res);
      } catch (err: unknown) {
        const msg =
          err instanceof Error
            ? err.message
            : "Không thể tải lịch sử làm bài của quiz này.";
        setError(msg);
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [quizId]
  );

  useEffect(() => {
    if (isOpen && quizId) {
      loadHistory();
    } else {
      setData(null);
      setError(null);
    }
  }, [isOpen, quizId, loadHistory]);

  // Handle ESC key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isReviewOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isReviewOpen, onClose]);

  if (!mounted || !isOpen || !quizId) return null;

  const stats = data?.stats;
  const attempts = data?.attempts || [];
  const title = data?.quiz_title || quizTitle || "Quiz History";
  const unitNumber = data?.unit_number;

  const handleOpenReview = (attemptId: string) => {
    setReviewAttemptId(attemptId);
    setIsReviewOpen(true);
  };

  const getScoreColor = (score: number | null | undefined) => {
    if (score == null) return "text-gray-400";
    if (score >= 80) return "text-emerald-400";
    if (score >= 50) return "text-amber-400";
    return "text-rose-400";
  };

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isReviewOpen) {
          onClose();
        }
      }}
    >
      <div
        className="relative w-full max-w-4xl bg-[#1e1e1e] border border-[#383838] rounded-2xl shadow-2xl flex flex-col overflow-hidden max-h-[92vh] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#333333] bg-[#242424]/90 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-blue-950/40 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
              <History className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                {unitNumber != null && (
                  <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-[#333333] text-gray-300 border border-[#444]">
                    Unit {unitNumber}
                  </span>
                )}
                <h2 className="text-base sm:text-lg font-bold text-white truncate">
                  {title}
                </h2>
              </div>
              <p className="text-xs text-[#9CA3AF] mt-0.5">
                Lịch sử làm bài & Thống kê điểm số tương ứng
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => loadHistory(true)}
              disabled={isRefreshing || isLoading}
              title="Làm mới dữ liệu"
              className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-[#333333] transition-colors cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={cn("w-4 h-4", isRefreshing && "animate-spin text-blue-400")} />
            </button>
            <button
              onClick={onClose}
              title="Đóng modal"
              className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-[#333333] transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 text-[#9CA3AF]">
              <Loader2 className="w-8 h-8 animate-spin text-blue-400 mb-3" />
              <span className="text-sm">Đang tải lịch sử & thống kê điểm...</span>
            </div>
          ) : error ? (
            <div className="p-6 bg-rose-950/30 border border-rose-500/40 rounded-xl text-center space-y-3">
              <AlertCircle className="w-8 h-8 text-rose-400 mx-auto" />
              <h3 className="text-base font-semibold text-white">Lỗi tải dữ liệu</h3>
              <p className="text-xs text-rose-300">{error}</p>
              <button
                onClick={() => loadHistory()}
                className="px-4 py-2 rounded-lg text-xs font-semibold bg-[#2e2e2e] hover:bg-[#3e3e3e] text-white transition-colors cursor-pointer"
              >
                Thử lại
              </button>
            </div>
          ) : stats ? (
            <>
              {/* Score Statistics Cards */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
                    <TrendingUp className="w-3.5 h-3.5 text-blue-400" />
                    <span>Thống kê điểm số</span>
                  </h3>
                  <span className="text-xs text-gray-400">
                    {stats.completed_attempts} / {stats.total_attempts} lần hoàn thành
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                  {/* Highest Score */}
                  <div className="p-3.5 rounded-xl bg-[#252525] border border-[#353535] relative overflow-hidden group hover:border-[#454545] transition-colors">
                    <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
                      <span>Điểm cao nhất</span>
                      <Trophy className="w-3.5 h-3.5 text-amber-400" />
                    </div>
                    <div className={cn("text-2xl font-extrabold", getScoreColor(stats.completed_attempts > 0 ? stats.highest_score : null))}>
                      {stats.completed_attempts > 0 ? `${stats.highest_score}%` : "—"}
                    </div>
                    <div className="text-[11px] text-gray-500 mt-1 truncate">
                      {stats.completed_attempts > 0
                        ? `${stats.highest_correct_blanks}/${stats.total_blanks} blanks`
                        : "Chưa có điểm"}
                    </div>
                  </div>

                  {/* Latest Score */}
                  <div className="p-3.5 rounded-xl bg-[#252525] border border-[#353535] group hover:border-[#454545] transition-colors">
                    <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
                      <span>Điểm gần nhất</span>
                      <Zap className="w-3.5 h-3.5 text-blue-400" />
                    </div>
                    <div className={cn("text-2xl font-extrabold", getScoreColor(stats.latest_score))}>
                      {stats.latest_score != null ? `${stats.latest_score}%` : "—"}
                    </div>
                    <div className="text-[11px] text-gray-500 mt-1 truncate">
                      {attempts.length > 0 ? "Lần làm mới nhất" : "Chưa có điểm"}
                    </div>
                  </div>

                  {/* Average Score */}
                  <div className="p-3.5 rounded-xl bg-[#252525] border border-[#353535] group hover:border-[#454545] transition-colors">
                    <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
                      <span>Điểm trung bình</span>
                      <Target className="w-3.5 h-3.5 text-emerald-400" />
                    </div>
                    <div className={cn("text-2xl font-extrabold", getScoreColor(stats.completed_attempts > 0 ? stats.average_score : null))}>
                      {stats.completed_attempts > 0 ? `${stats.average_score}%` : "—"}
                    </div>
                    <div className="text-[11px] text-gray-500 mt-1 truncate">
                      {stats.completed_attempts > 0 ? `Qua ${stats.completed_attempts} bài thi` : "Chưa có"}
                    </div>
                  </div>

                  {/* Total Attempts */}
                  <div className="p-3.5 rounded-xl bg-[#252525] border border-[#353535] group hover:border-[#454545] transition-colors">
                    <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
                      <span>Số lần làm</span>
                      <Layers className="w-3.5 h-3.5 text-purple-400" />
                    </div>
                    <div className="text-2xl font-extrabold text-white">
                      {stats.total_attempts}
                    </div>
                    <div className="text-[11px] text-gray-500 mt-1 truncate">
                      Lượt thi & luyện tập
                    </div>
                  </div>

                  {/* Average Time */}
                  <div className="p-3.5 rounded-xl bg-[#252525] border border-[#353535] col-span-2 sm:col-span-1 group hover:border-[#454545] transition-colors">
                    <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
                      <span>Thời gian TB</span>
                      <Clock className="w-3.5 h-3.5 text-cyan-400" />
                    </div>
                    <div className="text-2xl font-extrabold text-white">
                      {stats.average_time_spent_seconds > 0
                        ? formatTime(stats.average_time_spent_seconds)
                        : "—"}
                    </div>
                    <div className="text-[11px] text-gray-500 mt-1 truncate">
                      Mỗi lần nộp bài
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons: Practice or Retake Exam */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl bg-[#252525]/70 border border-[#333333]">
                <div className="text-xs text-gray-300">
                  <span className="font-semibold text-white">Muốn cải thiện điểm số?</span> Chọn chế độ phù hợp để làm lại quiz này:
                </div>
                <div className="flex items-center gap-2">
                  {onStartPractice && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onStartPractice(quizId);
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#333333] hover:bg-[#3f3f3f] text-gray-200 border border-[#444] transition-colors cursor-pointer"
                    >
                      <BookOpen className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Luyện tập tự do</span>
                    </button>
                  )}
                  {onStartExam && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onStartExam(quizId);
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white text-black hover:bg-neutral-200 transition-colors shadow-sm cursor-pointer"
                    >
                      <Play className="w-3 h-3 fill-black text-black" />
                      <span>Thi lại (Exam)</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Attempt History List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs text-gray-400 px-1">
                  <span className="font-bold uppercase tracking-wider">
                    Lịch sử các lần làm bài ({attempts.length})
                  </span>
                  <span>Bấm nút "Xem chi tiết" để xem lại câu hỏi & lời giải</span>
                </div>

                {attempts.length === 0 ? (
                  <div className="py-12 px-6 text-center bg-[#252525]/60 border border-[#333333] rounded-xl space-y-3">
                    <div className="w-12 h-12 rounded-full bg-[#1e1e1e] border border-[#383838] flex items-center justify-center text-gray-400 mx-auto">
                      <History className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-white">Chưa có lượt làm bài nào</h4>
                      <p className="text-xs text-gray-400 mt-1">
                        Bạn chưa làm bài quiz này. Hãy bắt đầu ngay để ghi nhận điểm số!
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {attempts.map((att, idx) => {
                      const isComplete = att.status === "completed" || att.accuracy_percentage != null;
                      const isPractice = att.mode === "practice";

                      return (
                        <div
                          key={att.attempt_id}
                          className="p-4 rounded-xl bg-[#252525] border border-[#353535] hover:border-[#484848] transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 group"
                        >
                          {/* Left: Attempt Info */}
                          <div className="space-y-1.5 min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-xs font-mono font-bold text-gray-400">
                                #{attempts.length - idx}
                              </span>

                              {/* Mode Badge */}
                              <span
                                className={cn(
                                  "px-2 py-0.5 rounded text-[11px] font-semibold flex items-center gap-1",
                                  isPractice
                                    ? "bg-purple-950/60 border border-purple-500/30 text-purple-300"
                                    : "bg-blue-950/60 border border-blue-500/30 text-blue-300"
                                )}
                              >
                                {isPractice ? (
                                  <>
                                    <BookOpen className="w-3 h-3" />
                                    <span>Luyện tập</span>
                                  </>
                                ) : (
                                  <>
                                    <Clock className="w-3 h-3" />
                                    <span>Thi bấm giờ</span>
                                  </>
                                )}
                              </span>

                              {/* Status Badge */}
                              <span
                                className={cn(
                                  "px-2 py-0.5 rounded text-[11px] font-medium",
                                  att.status === "completed"
                                    ? "bg-emerald-950/50 text-emerald-400 border border-emerald-500/20"
                                    : att.status === "timed_out"
                                    ? "bg-amber-950/50 text-amber-400 border border-amber-500/20"
                                    : "bg-gray-800 text-gray-400 border border-gray-700"
                                )}
                              >
                                {att.status === "completed"
                                  ? "Hoàn thành"
                                  : att.status === "timed_out"
                                  ? "Hết giờ"
                                  : "Đang làm"}
                              </span>

                              <span className="text-xs text-gray-400">
                                {formatDate(att.started_at)}
                              </span>
                            </div>

                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-400">
                              <span>
                                Điểm blanks:{" "}
                                <strong className="text-white font-semibold">
                                  {att.correct_blanks ?? 0} / {att.total_blanks ?? stats.total_blanks}
                                </strong>
                              </span>
                              <span>
                                Câu đúng tuyệt đối:{" "}
                                <strong className="text-white font-semibold">
                                  {att.fully_correct_questions ?? 0} / {att.total_questions ?? stats.total_questions}
                                </strong>
                              </span>
                              {att.time_spent_seconds != null && att.time_spent_seconds > 0 && (
                                <span>
                                  Thời gian:{" "}
                                  <strong className="text-gray-300">
                                    {formatTime(att.time_spent_seconds)}
                                  </strong>
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Right: Score & Inspect Button */}
                          <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-[#303030]">
                            <div className="text-right">
                              <span
                                className={cn(
                                  "text-2xl font-black block leading-tight",
                                  getScoreColor(att.accuracy_percentage)
                                )}
                              >
                                {att.accuracy_percentage != null
                                  ? `${att.accuracy_percentage}%`
                                  : "—"}
                              </span>
                              <span className="text-[10px] text-gray-400 uppercase tracking-wider block">
                                Độ chính xác
                              </span>
                            </div>

                            {isComplete && (
                              <button
                                type="button"
                                onClick={() => handleOpenReview(att.attempt_id)}
                                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-[#333333] hover:bg-[#404040] text-white border border-[#444] transition-colors cursor-pointer"
                              >
                                <Eye className="w-3.5 h-3.5 text-blue-400" />
                                <span>Xem chi tiết</span>
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          ) : null}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end px-6 py-3.5 border-t border-[#333333] bg-[#242424] shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#333333] hover:bg-[#404040] text-gray-200 transition-colors cursor-pointer"
          >
            Đóng
          </button>
        </div>
      </div>

      {/* Embedded Question-by-Question Review Modal */}
      <AttemptReviewModal
        attemptId={reviewAttemptId}
        isOpen={isReviewOpen}
        onClose={() => {
          setIsReviewOpen(false);
          setReviewAttemptId(null);
        }}
      />
    </div>,
    document.body
  );
}
