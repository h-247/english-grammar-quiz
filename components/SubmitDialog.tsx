"use client";

import React, { useEffect } from "react";
import { AlertCircle, CheckCircle, Loader2 } from "lucide-react";

interface SubmitDialogProps {
  isOpen: boolean;
  totalBlanks: number;
  unansweredBlanks: number;
  isSubmitting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function SubmitDialog({
  isOpen,
  totalBlanks,
  unansweredBlanks,
  isSubmitting,
  onConfirm,
  onCancel,
}: SubmitDialogProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen || isSubmitting) return;
      if (e.key === "Escape") {
        onCancel();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isSubmitting, onCancel]);

  if (!isOpen) return null;

  const answeredBlanks = totalBlanks - unansweredBlanks;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className="w-full max-w-md bg-[#262626] border border-[#383838] rounded-xl p-6 shadow-2xl space-y-5"
        role="dialog"
        aria-modal="true"
        aria-labelledby="submit-dialog-title"
      >
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-full bg-amber-950/70 border border-amber-500/50 flex items-center justify-center text-amber-400 shrink-0">
            {unansweredBlanks > 0 ? (
              <AlertCircle className="w-5 h-5" />
            ) : (
              <CheckCircle className="w-5 h-5 text-emerald-400" />
            )}
          </div>
          <div>
            <h3 id="submit-dialog-title" className="text-lg font-semibold text-[#ECECEC]">
              Submit Quiz?
            </h3>
            <p className="text-sm text-[#9CA3AF] mt-1">
              Once submitted, your answers will be graded and you will not be able to modify them.
            </p>
          </div>
        </div>

        {/* Stats Summary */}
        <div className="bg-[#1A1A1A] border border-[#383838] rounded-lg p-4 space-y-2 text-sm">
          <div className="flex justify-between items-center text-[#9CA3AF]">
            <span>Answered Blanks</span>
            <span className="font-semibold text-white">{answeredBlanks} / {totalBlanks}</span>
          </div>
          <div className="flex justify-between items-center text-[#9CA3AF]">
            <span>Unanswered Blanks</span>
            <span className={unansweredBlanks > 0 ? "font-semibold text-amber-400" : "font-semibold text-emerald-400"}>
              {unansweredBlanks}
            </span>
          </div>

          {unansweredBlanks > 0 && (
            <div className="pt-2 border-t border-[#333333] text-xs text-amber-400/90 flex items-center gap-1.5">
              <span>⚠️ Unanswered blanks will be graded as incorrect.</span>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            disabled={isSubmitting}
            onClick={onCancel}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-[#333333] hover:bg-[#404040] text-[#ECECEC] transition-colors border border-[#383838] cursor-pointer disabled:opacity-50"
          >
            Cancel and Continue
          </button>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={onConfirm}
            className="px-4 py-2 rounded-lg text-sm font-semibold bg-white text-black hover:bg-neutral-200 transition-colors shadow-sm flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Grading...</span>
              </>
            ) : (
              <span>Confirm & Submit</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
