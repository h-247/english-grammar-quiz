"use client";

import React, { useState, useEffect } from "react";
import {
  Code2,
  X,
  ClipboardPaste,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RefreshCw,
  Sparkles,
  Info,
} from "lucide-react";
import { importQuizJson } from "@/lib/api";
import { useToast } from "@/components/Toast";

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  targetCourseId?: string | null;
  targetQuizTitle?: string | null;
}

export function ImportModal({
  isOpen,
  onClose,
  onSuccess,
  targetCourseId,
  targetQuizTitle,
}: ImportModalProps) {
  const { showToast } = useToast();
  const [jsonText, setJsonText] = useState<string>("");
  const [overwrite, setOverwrite] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [duplicateTitle, setDuplicateTitle] = useState<string | null>(null);
  const [previewInfo, setPreviewInfo] = useState<{
    unit?: number;
    title?: string;
    questionsCount?: number;
  } | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setJsonText("");
      setErrorMessage(null);
      setDuplicateTitle(null);
      setPreviewInfo(null);
    }
  }, [isOpen]);

  // Quick live validation & extraction
  useEffect(() => {
    const trimmed = jsonText.trim();
    if (!trimmed) {
      setPreviewInfo(null);
      setErrorMessage(null);
      return;
    }

    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === "object") {
        setPreviewInfo({
          unit: parsed.unit?.number,
          title: parsed.unit?.title || parsed.title,
          questionsCount: Array.isArray(parsed.questions) ? parsed.questions.length : undefined,
        });
        setErrorMessage(null);
      }
    } catch (err: unknown) {
      // Don't show error until submit, unless it's obviously bad
      setPreviewInfo(null);
    }
  }, [jsonText]);

  if (!isOpen) return null;

  const handlePasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setJsonText(text);
        setErrorMessage(null);
        showToast("Pasted JSON from clipboard!", "info", 3000);
      }
    } catch {
      showToast("Clipboard access was blocked. Please paste manually into the box.", "info", 4000);
    }
  };

  const handleClear = () => {
    setJsonText("");
    setErrorMessage(null);
    setDuplicateTitle(null);
    setPreviewInfo(null);
  };

  const handleFormatJson = () => {
    try {
      const parsed = JSON.parse(jsonText.trim());
      setJsonText(JSON.stringify(parsed, null, 2));
      showToast("Formatted JSON nicely!", "info", 2000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Invalid JSON syntax.";
      setErrorMessage(`Cannot format invalid JSON: ${msg}`);
    }
  };

  const handleImport = async (forceOverwrite?: boolean) => {
    const trimmed = jsonText.trim();
    if (!trimmed) {
      setErrorMessage("Please paste the JSON content into the box.");
      return;
    }

    // Pre-validate JSON syntax
    try {
      JSON.parse(trimmed);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Invalid JSON syntax.";
      setErrorMessage(`JSON syntax error: ${msg}. Please check the pasted content.`);
      return;
    }

    const shouldOverwrite = forceOverwrite ?? overwrite;

    setIsSubmitting(true);
    setErrorMessage(null);
    setDuplicateTitle(null);

    try {
      const res = await importQuizJson(trimmed, shouldOverwrite, targetCourseId || undefined);
      if (res.is_duplicate) {
        setDuplicateTitle(res.title);
        showToast(`Quiz "${res.title}" is already imported. You can choose to overwrite it.`, "info", 5000);
      } else {
        showToast(
          `Successfully ${shouldOverwrite ? "updated" : "imported"} "${res.title}" (${res.question_count} questions, ${res.blank_count} blanks)!`,
          "success",
          5000
        );
        setJsonText("");
        setOverwrite(false);
        onSuccess();
        onClose();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to import JSON quiz content.";
      setErrorMessage(msg);
      showToast(msg, "error", 6000);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className="w-full max-w-2xl bg-[#1e1e1e] border border-[#333333] rounded-2xl shadow-2xl overflow-hidden flex flex-col text-[#ececec] max-h-[90vh]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="paste-json-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2e2e2e] bg-[#242424]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <Code2 className="w-5 h-5" />
            </div>
            <div>
              <h3 id="paste-json-title" className="text-base font-bold text-white">
                Paste Quiz JSON
              </h3>
              <p className="text-xs text-[#9CA3AF]">
                Paste JSON content generated from ChatGPT or AI to import or update this unit
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1.5 text-[#9CA3AF] hover:text-white rounded-lg hover:bg-[#333333] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Target Quiz Indicator */}
        {targetQuizTitle && (
          <div className="px-6 py-2 bg-blue-950/20 border-b border-blue-900/30 flex items-center gap-2 text-xs text-blue-300">
            <Info className="w-3.5 h-3.5 text-blue-400 shrink-0" />
            <span>Target Unit: <strong className="text-white">{targetQuizTitle}</strong></span>
          </div>
        )}

        {/* Body / Textarea */}
        <div className="p-6 flex-1 overflow-y-auto space-y-4">
          {/* Quick Toolbar above textarea */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="text-xs font-semibold text-gray-300">
              JSON Content
            </span>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handlePasteFromClipboard}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-[#2a2a2a] hover:bg-[#353535] text-white border border-[#3d3d3d] transition-colors cursor-pointer"
              >
                <ClipboardPaste className="w-3.5 h-3.5 text-emerald-400" />
                <span>Paste Clipboard</span>
              </button>

              {jsonText && (
                <>
                  <button
                    type="button"
                    onClick={handleFormatJson}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-[#2a2a2a] hover:bg-[#353535] text-gray-300 hover:text-white border border-[#3d3d3d] transition-colors cursor-pointer"
                  >
                    <Sparkles className="w-3 h-3 text-amber-400" />
                    <span>Format</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleClear}
                    className="p-1 text-gray-400 hover:text-rose-400 rounded transition-colors cursor-pointer"
                    title="Clear text"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Large JSON Textarea */}
          <div className="relative">
            <textarea
              value={jsonText}
              onChange={(e) => setJsonText(e.target.value)}
              placeholder={`Paste your JSON quiz content here...

Example:
{
  "schemaVersion": "2.0.0",
  "quizType": "multi_blank_fill_in_the_blank",
  "language": "en",
  "unit": {
    "number": 2,
    "title": "Past simple, past continuous, used to"
  },
  "questions": [
    ...
  ]
}`}
              rows={12}
              className="w-full bg-[#141414] border border-[#383838] focus:border-white rounded-xl p-3.5 text-xs text-emerald-300/90 font-mono placeholder-gray-600 focus:outline-none transition-colors leading-relaxed resize-y"
            />
          </div>

          {/* Live Detected Preview Pill */}
          {previewInfo && (
            <div className="flex items-center gap-2 p-2.5 rounded-xl bg-emerald-950/20 border border-emerald-500/30 text-xs text-emerald-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                Detected:{" "}
                <strong className="text-white">
                  {previewInfo.unit ? `Unit ${previewInfo.unit}` : ""}{" "}
                  {previewInfo.title || "Quiz"}
                </strong>
                {previewInfo.questionsCount !== undefined && (
                  <span className="text-emerald-400/80">
                    {" "}
                    ({previewInfo.questionsCount} Questions)
                  </span>
                )}
              </span>
            </div>
          )}

          {/* Overwrite Checkbox */}
          <div className="flex items-center gap-2.5 px-1">
            <input
              type="checkbox"
              id="overwrite-checkbox"
              checked={overwrite}
              onChange={(e) => setOverwrite(e.target.checked)}
              className="w-4 h-4 rounded border-[#404040] bg-[#141414] text-white accent-white cursor-pointer"
            />
            <label
              htmlFor="overwrite-checkbox"
              className="text-xs text-gray-300 cursor-pointer select-none"
            >
              Overwrite existing quiz if already imported or updating questions
            </label>
          </div>

          {/* Duplicate Alert with Instant Overwrite Button */}
          {duplicateTitle && (
            <div className="p-3.5 rounded-xl bg-amber-950/40 border border-amber-500/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-200">
              <div>
                <span className="font-semibold block">Quiz already exists</span>
                <span className="text-amber-300/90">
                  &quot;{duplicateTitle}&quot; was previously imported in this course.
                </span>
              </div>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => handleImport(true)}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-black font-semibold rounded-lg text-xs transition-colors shrink-0 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Overwrite Now</span>
              </button>
            </div>
          )}

          {/* Error message */}
          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/50 flex items-start gap-2.5 text-xs text-rose-300">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
              <div className="break-words">{errorMessage}</div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#2e2e2e] bg-[#242424] flex items-center justify-end gap-3">
          <button
            type="button"
            disabled={isSubmitting}
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-400 hover:text-white hover:bg-[#333333] transition-colors cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!jsonText.trim() || isSubmitting}
            onClick={() => handleImport()}
            className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-semibold bg-white text-black hover:bg-neutral-200 transition-all shadow-sm cursor-pointer disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Importing...</span>
              </>
            ) : (
              <>
                <ClipboardPaste className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Import Quiz JSON</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
