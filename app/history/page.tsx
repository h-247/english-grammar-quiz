"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  History,
  Layers,
  Loader2,
  AlertCircle,
  TrendingUp,
  Eye,
} from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { AttemptReviewModal } from "@/components/AttemptReviewModal";
import { getAttemptHistory, getTopicMastery } from "@/lib/api";
import { AttemptHistoryItem, TopicMasteryResponse } from "@/types/quiz";
import { formatDate, formatTime, cn } from "@/lib/utils";
import { useToast } from "@/components/Toast";

export default function HistoryPage() {
  const { showToast } = useToast();
  const [historyItems, setHistoryItems] = useState<AttemptHistoryItem[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Topic Mastery
  const [masteryData, setMasteryData] = useState<TopicMasteryResponse | null>(null);

  // Review Modal
  const [reviewAttemptId, setReviewAttemptId] = useState<string | null>(null);
  const [isReviewOpen, setIsReviewOpen] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;
    async function fetchData() {
      try {
        const [historyRes, masteryRes] = await Promise.allSettled([
          getAttemptHistory(0, 50),
          getTopicMastery(),
        ]);

        if (!isMounted) return;

        if (historyRes.status === "fulfilled") {
          setHistoryItems(historyRes.value.items);
          setTotalCount(historyRes.value.total);
        } else {
          const msg =
            historyRes.reason instanceof Error
              ? historyRes.reason.message
              : "Failed to load attempt history.";
          setError(msg);
          showToast(msg, "error", 5000);
        }

        if (masteryRes.status === "fulfilled") {
          setMasteryData(masteryRes.value);
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Failed to load data.";
        setError(msg);
        showToast(msg, "error", 5000);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    fetchData();
    return () => {
      isMounted = false;
    };
  }, [showToast]);

  const handleOpenReview = (attemptId: string) => {
    setReviewAttemptId(attemptId);
    setIsReviewOpen(true);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#212121]">
      <Navbar />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 pb-6 border-b border-[#383838]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#333333] border border-[#383838] flex items-center justify-center text-white">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-[#ECECEC]">
                Attempt History & Mastery
              </h1>
              <p className="text-sm text-[#9CA3AF] mt-0.5">
                Review past quiz submissions, inspect answer explanations, and track grammatical topic competency.
              </p>
            </div>
          </div>
          <span className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-[#262626] border border-[#383838] text-[#9CA3AF]">
            {totalCount} total {totalCount === 1 ? "attempt" : "attempts"}
          </span>
        </div>

        {/* Topic Mastery Breakdown Card (Key Action 3) */}
        {!isLoading && masteryData && masteryData.topics.length > 0 && (
          <section className="p-6 rounded-2xl bg-[#1d1d1d] border border-[#333333] shadow-md space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-[#2a2a2a]">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                <h2 className="text-sm font-bold uppercase tracking-wider text-[#ECECEC]">
                  Grammar Competency by Topic
                </h2>
              </div>
              <div className="flex items-center gap-3 text-xs text-[#9CA3AF]">
                <span>
                  Overall Accuracy:{" "}
                  <strong className="text-white font-bold">
                    {masteryData.overallAccuracy}%
                  </strong>
                </span>
                <span>•</span>
                <span>
                  {masteryData.topics.length} grammar topics evaluated
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-1">
              {masteryData.topics.map((t) => {
                const isGood = t.percentage >= 80;
                const isMedium = t.percentage >= 50 && t.percentage < 80;
                return (
                  <div
                    key={t.topic}
                    className="p-3.5 rounded-xl bg-[#262626] border border-[#363636] space-y-2 hover:border-[#484848] transition-colors"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-neutral-200 truncate max-w-[240px]">
                        {t.topic}
                      </span>
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            "px-1.5 py-0.5 rounded text-[10px] font-bold uppercase",
                            isGood
                              ? "bg-emerald-950/80 text-emerald-300"
                              : isMedium
                              ? "bg-amber-950/80 text-amber-300"
                              : "bg-rose-950/80 text-rose-300"
                          )}
                        >
                          {t.percentage}%
                        </span>
                        <span className="text-[11px] text-[#888888]">
                          ({t.correctBlanks}/{t.totalBlanks})
                        </span>
                      </div>
                    </div>

                    <div className="w-full h-1.5 rounded-full bg-[#181818] overflow-hidden">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all duration-500",
                          isGood
                            ? "bg-emerald-400"
                            : isMedium
                            ? "bg-amber-400"
                            : "bg-rose-500"
                        )}
                        style={{ width: `${t.percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Attempt History List */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 text-[#9CA3AF]">
            <Loader2 className="w-8 h-8 animate-spin text-white mb-3" />
            <span className="text-sm">Loading past attempts...</span>
          </div>
        ) : error ? (
          <div className="max-w-md mx-auto p-6 bg-rose-950/30 border border-rose-500/40 rounded-xl text-center space-y-3">
            <AlertCircle className="w-8 h-8 text-rose-400 mx-auto" />
            <h3 className="text-base font-semibold text-[#ECECEC]">Error loading history</h3>
            <p className="text-xs text-rose-300">{error}</p>
          </div>
        ) : historyItems.length === 0 ? (
          <div className="max-w-md mx-auto py-16 px-6 text-center bg-[#262626] border border-[#383838] rounded-xl shadow-sm space-y-4">
            <div className="w-14 h-14 rounded-full bg-[#1A1A1A] border border-[#383838] flex items-center justify-center text-[#9CA3AF] mx-auto">
              <History className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-[#ECECEC]">No attempts recorded</h3>
              <p className="text-xs text-[#9CA3AF] mt-1.5">
                You haven&apos;t completed any quiz attempts yet. Start one from the library!
              </p>
            </div>
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold bg-white text-black hover:bg-neutral-200 transition-colors shadow-sm"
            >
              <Layers className="w-4 h-4" />
              <span>Go to Quiz Library</span>
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs text-[#9CA3AF] px-1">
              <span>Past Submissions</span>
              <span>Click any card to inspect question explanations</span>
            </div>

            {historyItems.map((att) => {
              const accuracy = att.accuracy_percentage ?? 0;
              const isHigh = accuracy >= 80;
              const isMedium = accuracy >= 50 && accuracy < 80;

              return (
                <div
                  key={att.attempt_id}
                  onClick={() => handleOpenReview(att.attempt_id)}
                  className="bg-[#262626] border border-[#383838] rounded-xl p-5 shadow-sm hover:border-[#666666] transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 group cursor-pointer"
                >
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-[11px] font-semibold uppercase tracking-wider bg-[#333333] text-[#ECECEC]">
                        {att.status === "timed_out" ? "Timed Out" : "Completed"}
                      </span>
                      <span className="text-xs text-[#9CA3AF]">
                        {formatDate(att.started_at)}
                      </span>
                    </div>

                    <h3 className="text-base font-semibold text-[#ECECEC] group-hover:text-white transition-colors">
                      {att.quiz_title}
                    </h3>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#9CA3AF]">
                      <span>
                        Blanks:{" "}
                        <strong className="text-white">
                          {att.correct_blanks ?? 0} / {att.total_blanks ?? 0}
                        </strong>
                      </span>
                      <span>
                        Questions:{" "}
                        <strong className="text-white">
                          {att.fully_correct_questions ?? 0} / {att.total_questions ?? 0}
                        </strong>
                      </span>
                      {att.time_spent_seconds != null && (
                        <span>Time: {formatTime(att.time_spent_seconds)}</span>
                      )}
                    </div>
                  </div>

                  {/* Score & Actions */}
                  <div className="flex items-center justify-between sm:justify-end gap-4 pt-3 sm:pt-0 border-t sm:border-t-0 border-[#333333]">
                    <div className="text-right">
                      <span
                        className={cn(
                          "text-2xl font-extrabold block",
                          isHigh ? "text-emerald-400" : isMedium ? "text-amber-400" : "text-rose-400"
                        )}
                      >
                        {att.accuracy_percentage != null ? `${att.accuracy_percentage}%` : "In Progress"}
                      </span>
                      <span className="text-[10px] text-[#9CA3AF] uppercase tracking-wider">
                        Accuracy
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenReview(att.attempt_id);
                      }}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-[#333333] hover:bg-[#444444] text-white transition-colors border border-[#3e3e3e]"
                    >
                      <Eye className="w-3.5 h-3.5 text-blue-400" />
                      <span>Inspect</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Detailed Attempt Review Modal */}
        <AttemptReviewModal
          attemptId={reviewAttemptId}
          isOpen={isReviewOpen}
          onClose={() => {
            setIsReviewOpen(false);
            setReviewAttemptId(null);
          }}
        />
      </main>
    </div>
  );
}
