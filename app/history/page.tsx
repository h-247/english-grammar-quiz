"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { History, Layers, ArrowRight, Loader2, AlertCircle } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { getAttemptHistory } from "@/lib/api";
import { AttemptHistoryItem } from "@/types/quiz";
import { formatDate, formatTime, cn } from "@/lib/utils";
import { useToast } from "@/components/Toast";

export default function HistoryPage() {
  const { showToast } = useToast();
  const [historyItems, setHistoryItems] = useState<AttemptHistoryItem[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function fetchHistory() {
      try {
        const data = await getAttemptHistory(0, 50);
        if (!isMounted) return;
        setHistoryItems(data.items);
        setTotalCount(data.total);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Failed to load attempt history.";
        setError(msg);
        showToast(msg, "error", 5000);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    fetchHistory();
    return () => {
      isMounted = false;
    };
  }, [showToast]);

  return (
    <div className="min-h-screen flex flex-col bg-[#212121]">
      <Navbar />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 pb-6 mb-8 border-b border-[#383838]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#333333] border border-[#383838] flex items-center justify-center text-white">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-[#ECECEC]">
                Attempt History
              </h1>
              <p className="text-sm text-[#9CA3AF] mt-0.5">
                Review past quiz submissions, score breakdowns, and time spent.
              </p>
            </div>
          </div>
          <span className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-[#262626] border border-[#383838] text-[#9CA3AF]">
            {totalCount} total {totalCount === 1 ? "attempt" : "attempts"}
          </span>
        </div>

        {/* Content */}
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
            {historyItems.map((att) => {
              const accuracy = att.accuracy_percentage ?? 0;
              const isHigh = accuracy >= 80;
              const isMedium = accuracy >= 50 && accuracy < 80;

              return (
                <div
                  key={att.attempt_id}
                  className="bg-[#262626] border border-[#383838] rounded-xl p-5 shadow-sm hover:border-[#555555] transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 group"
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

                  {/* Score & Link */}
                  <div className="flex items-center justify-between sm:justify-end gap-5 pt-3 sm:pt-0 border-t sm:border-t-0 border-[#333333]">
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

                    <Link
                      href={`/quiz/${att.quiz_id}/attempt/${att.attempt_id}/results`}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-[#333333] hover:bg-[#404040] text-white transition-colors border border-[#383838]"
                    >
                      <span>Review</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
