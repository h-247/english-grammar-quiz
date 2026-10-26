"use client";

import React from "react";
import { Trophy } from "lucide-react";
import { cn } from "@/lib/utils";

interface QuizScoreBadgeProps {
  score?: number | null;
  size?: "sm" | "md" | "lg";
  prefix?: string;
  className?: string;
}

export function QuizScoreBadge({
  score,
  size = "sm",
  prefix = "Best:",
  className,
}: QuizScoreBadgeProps) {
  const hasScore = score != null && Number.isFinite(score);

  const getScoreStyle = (s: number) => {
    if (s >= 80) {
      return "bg-emerald-950/50 text-emerald-400 border-emerald-600/40";
    }
    if (s >= 50) {
      return "bg-amber-950/50 text-amber-400 border-amber-600/40";
    }
    return "bg-rose-950/50 text-rose-400 border-rose-600/40";
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg border font-semibold tracking-tight shrink-0 transition-colors",
        hasScore
          ? getScoreStyle(score!)
          : "bg-[#202020] text-gray-500 border-[#333333]",
        size === "sm" && "px-2 py-0.5 text-[11px]",
        size === "md" && "px-2.5 py-1 text-xs",
        size === "lg" && "px-3 py-1.5 text-sm",
        className
      )}
      title={hasScore ? `Highest score recorded: ${score}%` : "No attempts completed yet"}
    >
      <Trophy
        className={cn(
          "shrink-0",
          size === "sm" && "w-3 h-3",
          size === "md" && "w-3.5 h-3.5",
          size === "lg" && "w-4 h-4",
          hasScore ? "text-amber-400" : "text-gray-600"
        )}
      />
      <span>
        {prefix} {hasScore ? `${score}%` : "—"}
      </span>
    </span>
  );
}
