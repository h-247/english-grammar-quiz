"use client";

import React, { useState, useRef, useEffect } from "react";
import { ChevronDown, Check, Circle, Clock, CheckCircle2 } from "lucide-react";
import { LearningStatus } from "@/types/quiz";
import { updateQuiz } from "@/lib/api";
import { cn } from "@/lib/utils";

interface QuizStatusSelectorProps {
  quizId: string;
  status?: LearningStatus;
  onChange?: (newStatus: LearningStatus) => void;
  size?: "sm" | "md";
  className?: string;
  showIconOnly?: boolean;
}

const STATUS_CONFIG: Record<
  LearningStatus,
  {
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    buttonClasses: string;
    badgeClasses: string;
  }
> = {
  to_do: {
    label: "To do",
    icon: Circle,
    buttonClasses: "bg-[#222222] hover:bg-[#2c2c2c] text-gray-300 border-[#3a3a3a]",
    badgeClasses: "bg-[#222222] text-gray-300 border-[#3a3a3a]",
  },
  doing: {
    label: "Doing",
    icon: Clock,
    buttonClasses: "bg-amber-950/40 hover:bg-amber-950/60 text-amber-300 border-amber-700/50",
    badgeClasses: "bg-amber-950/40 text-amber-300 border-amber-700/50",
  },
  done: {
    label: "Done",
    icon: CheckCircle2,
    buttonClasses: "bg-emerald-950/40 hover:bg-emerald-950/60 text-emerald-300 border-emerald-700/50",
    badgeClasses: "bg-emerald-950/40 text-emerald-300 border-emerald-700/50",
  },
};

export function QuizStatusSelector({
  quizId,
  status = "to_do",
  onChange,
  size = "sm",
  className,
}: QuizStatusSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const currentStatus = status || "to_do";
  const config = STATUS_CONFIG[currentStatus] || STATUS_CONFIG.to_do;
  const Icon = config.icon;

  // Handle click outside to close dropdown
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const handleSelect = async (newStatus: LearningStatus) => {
    if (newStatus === currentStatus) {
      setIsOpen(false);
      return;
    }
    setIsOpen(false);
    setIsUpdating(true);

    // Optimistic trigger
    if (onChange) {
      onChange(newStatus);
    }

    try {
      await updateQuiz(quizId, { learning_status: newStatus });
    } catch {
      // Revert if error
      if (onChange) {
        onChange(currentStatus);
      }
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div ref={containerRef} className="relative inline-block text-left">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        disabled={isUpdating}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-lg border font-medium transition-all cursor-pointer shadow-sm disabled:opacity-50",
          size === "sm" ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-xs sm:text-sm",
          config.buttonClasses,
          className
        )}
        title={`Change status (currently ${config.label})`}
      >
        <Icon className={size === "sm" ? "w-3 h-3 shrink-0" : "w-3.5 h-3.5 shrink-0"} />
        <span>{config.label}</span>
        <ChevronDown className={cn("w-3 h-3 text-gray-400 transition-transform", isOpen && "rotate-180")} />
      </button>

      {isOpen && (
        <div
          role="menu"
          className="absolute left-0 mt-1.5 w-36 rounded-xl bg-[#1e1e1e] border border-[#383838] shadow-2xl py-1 z-30 animate-in fade-in zoom-in-95 duration-150"
        >
          <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-gray-500 border-b border-[#2c2c2c]">
            Quiz Status
          </div>
          {(["to_do", "doing", "done"] as LearningStatus[]).map((st) => {
            const itemConfig = STATUS_CONFIG[st];
            const ItemIcon = itemConfig.icon;
            const isSelected = st === currentStatus;

            return (
              <button
                key={st}
                type="button"
                onClick={() => handleSelect(st)}
                className={cn(
                  "w-full flex items-center justify-between px-3 py-1.5 text-xs text-left transition-colors cursor-pointer",
                  isSelected
                    ? "bg-[#282828] text-white font-semibold"
                    : "text-gray-300 hover:bg-[#252525] hover:text-white"
                )}
              >
                <div className="flex items-center gap-2">
                  <ItemIcon className="w-3.5 h-3.5 shrink-0" />
                  <span>{itemConfig.label}</span>
                </div>
                {isSelected && <Check className="w-3 h-3 text-emerald-400" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function QuizStatusBadge({
  status = "to_do",
  className,
}: {
  status?: LearningStatus;
  className?: string;
}) {
  const currentStatus = status || "to_do";
  const config = STATUS_CONFIG[currentStatus] || STATUS_CONFIG.to_do;
  const Icon = config.icon;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border",
        config.badgeClasses,
        className
      )}
    >
      <Icon className="w-3 h-3" />
      <span>{config.label}</span>
    </span>
  );
}
