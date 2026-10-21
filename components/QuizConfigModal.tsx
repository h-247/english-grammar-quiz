"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Clock, BookOpen, X, Play, Loader2, Sparkles, CheckCircle2 } from "lucide-react";
import { QuizSummary } from "@/types/quiz";
import { cn } from "@/lib/utils";

interface QuizConfigModalProps {
  quiz: QuizSummary | null;
  isOpen: boolean;
  isStarting: boolean;
  onClose: () => void;
  onStart: (durationMinutes: number, mode: "timed" | "practice") => void;
}

const PRESET_DURATIONS = [5, 10, 15, 30, 45, 60];

export function QuizConfigModal({
  quiz,
  isOpen,
  isStarting,
  onClose,
  onStart,
}: QuizConfigModalProps) {
  const [mounted, setMounted] = useState(false);
  const [mode, setMode] = useState<"timed" | "practice">("timed");
  const [selectedDuration, setSelectedDuration] = useState<number>(15);
  const [isCustom, setIsCustom] = useState<boolean>(false);
  const [customMinutes, setCustomMinutes] = useState<string>("20");

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen && !isStarting) {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, isStarting, onClose]);

  if (!isOpen || !mounted || !quiz) return null;

  const handleStart = () => {
    let finalDuration = selectedDuration;
    if (mode === "timed" && isCustom) {
      const parsed = parseInt(customMinutes, 10);
      if (isNaN(parsed) || parsed <= 0) {
        return;
      }
      finalDuration = Math.min(360, Math.max(1, parsed));
    }
    onStart(mode === "practice" ? 0 : finalDuration, mode);
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isStarting) {
          onClose();
        }
      }}
    >
      <div
        className="w-full max-w-lg bg-[#262626] border border-[#383838] rounded-xl p-6 shadow-2xl space-y-6 my-auto"
        role="dialog"
        aria-modal="true"
        aria-labelledby="quiz-config-title"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#333333] border border-[#383838] flex items-center justify-center text-white">
              {mode === "timed" ? <Clock className="w-5 h-5" /> : <BookOpen className="w-5 h-5 text-emerald-400" />}
            </div>
            <div>
              <h3 id="quiz-config-title" className="text-lg font-semibold text-[#ECECEC]">
                Start Quiz Attempt
              </h3>
              <p className="text-xs text-[#9CA3AF]">
                Choose your preferred mode and settings.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isStarting}
            className="text-[#9CA3AF] hover:text-[#ECECEC] p-1 rounded-md transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quiz Summary Info */}
        <div className="bg-[#1A1A1A] border border-[#383838] rounded-lg p-4 space-y-2 text-sm">
          <div className="font-medium text-[#ECECEC] text-base">{quiz.title}</div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#9CA3AF] pt-1">
            {quiz.unit_number && <span>Unit {quiz.unit_number}</span>}
            <span>• {quiz.question_count} questions</span>
            <span>• {quiz.blank_count} answer blanks</span>
          </div>
        </div>

        {/* Mode Selector */}
        <div>
          <label className="block text-xs font-semibold text-[#9CA3AF] uppercase tracking-wider mb-2.5">
            Select Mode
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setMode("timed")}
              className={cn(
                "p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between",
                mode === "timed"
                  ? "bg-white text-black border-white shadow-md"
                  : "bg-[#1A1A1A] border-[#383838] text-[#ECECEC] hover:border-[#555555]"
              )}
            >
              <div className="flex items-center justify-between mb-2">
                <Clock className="w-5 h-5" />
                {mode === "timed" && <CheckCircle2 className="w-4 h-4 text-black fill-current" />}
              </div>
              <div>
                <div className="font-semibold text-sm">Timed Exam</div>
                <div className={cn("text-xs mt-0.5", mode === "timed" ? "text-neutral-700" : "text-[#9CA3AF]")}>
                  Strict countdown timer with official submission deadline.
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setMode("practice")}
              className={cn(
                "p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between",
                mode === "practice"
                  ? "bg-white text-black border-white shadow-md"
                  : "bg-[#1A1A1A] border-[#383838] text-[#ECECEC] hover:border-[#555555]"
              )}
            >
              <div className="flex items-center justify-between mb-2">
                <Sparkles className="w-5 h-5" />
                {mode === "practice" && <CheckCircle2 className="w-4 h-4 text-black fill-current" />}
              </div>
              <div>
                <div className="font-semibold text-sm">Self-Paced Practice</div>
                <div className={cn("text-xs mt-0.5", mode === "practice" ? "text-neutral-700" : "text-[#9CA3AF]")}>
                  Untimed. Instant feedback per blank and instant explanations.
                </div>
              </div>
            </button>
          </div>
        </div>

        {/* Time Limit Presets (only shown in timed mode) */}
        {mode === "timed" ? (
          <div>
            <label className="block text-xs font-semibold text-[#9CA3AF] uppercase tracking-wider mb-2.5">
              Select Time Limit
            </label>
            <div className="grid grid-cols-3 gap-2.5">
              {PRESET_DURATIONS.map((mins) => {
                const isSelected = !isCustom && selectedDuration === mins;
                return (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => {
                      setSelectedDuration(mins);
                      setIsCustom(false);
                    }}
                    className={cn(
                      "py-2.5 px-3 rounded-lg text-sm font-semibold border transition-all text-center cursor-pointer",
                      isSelected
                        ? "bg-white text-black border-white shadow-sm"
                        : "bg-[#1A1A1A] border-[#383838] text-[#ECECEC] hover:border-[#555555]"
                    )}
                  >
                    {mins} min{mins > 1 ? "s" : ""}
                  </button>
                );
              })}
            </div>

            {/* Custom Duration Option */}
            <div className="mt-3">
              <button
                type="button"
                onClick={() => setIsCustom(true)}
                className={cn(
                  "w-full py-2.5 px-3 rounded-lg text-sm font-semibold border transition-all text-center cursor-pointer mb-2",
                  isCustom
                    ? "bg-white text-black border-white shadow-sm"
                    : "bg-[#1A1A1A] border-[#383838] text-[#ECECEC] hover:border-[#555555]"
                )}
              >
                Custom Duration
              </button>

              {isCustom && (
                <div className="flex items-center gap-2 mt-2 p-2 bg-[#1A1A1A] rounded-lg border border-[#383838]">
                  <input
                    type="number"
                    min="1"
                    max="360"
                    value={customMinutes}
                    onChange={(e) => setCustomMinutes(e.target.value)}
                    className="bg-[#262626] border border-[#383838] rounded px-3 py-1.5 text-sm text-[#ECECEC] w-24 text-center focus:outline-none focus:border-white"
                    placeholder="Minutes"
                  />
                  <span className="text-sm text-[#9CA3AF]">minutes (between 1 and 360)</span>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="p-3.5 rounded-lg bg-emerald-950/30 border border-emerald-500/40 text-xs text-emerald-300 space-y-1">
            <span className="font-semibold block text-emerald-200">Practice Mode Active</span>
            <p>
              Take all the time you need. Each question includes a &quot;Check Answer&quot; button that immediately evaluates your answers and reveals grammatical explanations.
            </p>
          </div>
        )}

        {/* Start Button */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            disabled={isStarting}
            onClick={onClose}
            className="px-4 py-2.5 rounded-lg text-sm font-medium bg-[#333333] hover:bg-[#404040] text-[#ECECEC] transition-colors border border-[#383838] cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isStarting}
            onClick={handleStart}
            className="px-5 py-2.5 rounded-lg text-sm font-semibold bg-white text-black hover:bg-neutral-200 transition-colors shadow-sm flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {isStarting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Starting...</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-current" />
                <span>Start {mode === "timed" ? "Exam" : "Practice"}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
