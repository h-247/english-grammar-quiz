"use client";

import React, { useState, useRef } from "react";
import { Upload, X, FileText, CheckCircle2, AlertCircle, Loader2, RefreshCw } from "lucide-react";
import { importQuizFile } from "@/lib/api";
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
  const [file, setFile] = useState<File | null>(null);
  const [overwrite, setOverwrite] = useState<boolean>(false);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [duplicateTitle, setDuplicateTitle] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMessage(null);
    setDuplicateTitle(null);
    if (e.target.files && e.target.files.length > 0) {
      const selected = e.target.files[0];
      if (!selected.name.endsWith(".json")) {
        setErrorMessage("Please select a valid .json file.");
        return;
      }
      setFile(selected);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    setErrorMessage(null);
    setDuplicateTitle(null);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const selected = e.dataTransfer.files[0];
      if (!selected.name.endsWith(".json")) {
        setErrorMessage("Please select a valid .json file.");
        return;
      }
      setFile(selected);
    }
  };

  const handleUpload = async (forceOverwrite?: boolean) => {
    if (!file) {
      setErrorMessage("Please choose a JSON file to upload.");
      return;
    }

    const shouldOverwrite = forceOverwrite ?? overwrite;

    setIsUploading(true);
    setErrorMessage(null);
    setDuplicateTitle(null);

    try {
      const res = await importQuizFile(file, shouldOverwrite, targetCourseId || undefined);
      if (res.is_duplicate) {
        setDuplicateTitle(res.title);
        showToast(`Quiz "${res.title}" is already imported. You can choose to overwrite it.`, "info", 5000);
      } else {
        showToast(
          `Successfully ${shouldOverwrite ? "updated" : "imported"} "${res.title}" (${res.question_count} questions, ${res.blank_count} blanks)!`,
          "success",
          5000
        );
        setFile(null);
        setOverwrite(false);
        onSuccess();
        onClose();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to import JSON quiz file.";
      setErrorMessage(msg);
      showToast(msg, "error", 6000);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className="w-full max-w-lg bg-[#262626] border border-[#383838] rounded-xl p-6 shadow-2xl space-y-6"
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-modal-title"
      >
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#333333] border border-[#383838] flex items-center justify-center text-white">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h3 id="import-modal-title" className="text-lg font-semibold text-[#ECECEC]">
                Import Quiz File
              </h3>
              <p className="text-xs text-[#9CA3AF]">
                Upload a structured JSON quiz file compliant with schema 2.0.0.
              </p>
              {targetQuizTitle && (
                <div className="mt-1 inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  Target: {targetQuizTitle}
                </div>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isUploading}
            className="text-[#9CA3AF] hover:text-[#ECECEC] p-1 rounded-md transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Dropzone */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer ${
            isDragging
              ? "border-white bg-[#333333]/50"
              : file
              ? "border-emerald-500/60 bg-[#1A1A1A]"
              : "border-[#404040] hover:border-[#666666] bg-[#1E1E1E]"
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            onChange={handleFileChange}
            className="hidden"
          />

          {file ? (
            <div className="flex flex-col items-center gap-2 text-emerald-400">
              <CheckCircle2 className="w-8 h-8" />
              <span className="text-sm font-semibold text-[#ECECEC] break-all">{file.name}</span>
              <span className="text-xs text-[#9CA3AF]">{(file.size / 1024).toFixed(1)} KB</span>
              <span className="text-xs text-emerald-400 mt-1">Ready to import (click to change)</span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 text-[#9CA3AF]">
              <div className="w-12 h-12 rounded-full bg-[#262626] border border-[#383838] flex items-center justify-center text-white">
                <FileText className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-[#ECECEC]">
                  Click to select or drag and drop your JSON quiz
                </p>
                <p className="text-xs text-[#9CA3AF] mt-1">Accepts .json files (Schema v2.0.0)</p>
              </div>
            </div>
          )}
        </div>

        {/* Overwrite Option */}
        <div className="flex items-center gap-2.5 px-1">
          <input
            type="checkbox"
            id="overwrite-checkbox"
            checked={overwrite}
            onChange={(e) => setOverwrite(e.target.checked)}
            className="w-4 h-4 rounded border-[#404040] bg-[#1A1A1A] text-white accent-white cursor-pointer"
          />
          <label htmlFor="overwrite-checkbox" className="text-xs text-[#ECECEC] cursor-pointer select-none">
            Overwrite existing quiz if duplicate or revised version
          </label>
        </div>

        {/* Duplicate Notice with Quick Overwrite */}
        {duplicateTitle && (
          <div className="p-3.5 rounded-lg bg-amber-950/40 border border-amber-500/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-200">
            <div>
              <span className="font-semibold block">Quiz already exists</span>
              <span className="text-amber-300/90">&quot;{duplicateTitle}&quot; was previously imported.</span>
            </div>
            <button
              type="button"
              disabled={isUploading}
              onClick={() => handleUpload(true)}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-black font-semibold rounded text-xs transition-colors shrink-0 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Overwrite Now</span>
            </button>
          </div>
        )}

        {/* Error message */}
        {errorMessage && (
          <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-500/50 flex items-start gap-2.5 text-xs text-rose-300">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
            <div className="break-words">{errorMessage}</div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            disabled={isUploading}
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-[#333333] hover:bg-[#404040] text-[#ECECEC] transition-colors border border-[#383838] cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!file || isUploading}
            onClick={() => handleUpload()}
            className="px-5 py-2 rounded-lg text-sm font-semibold bg-white text-black hover:bg-neutral-200 transition-colors shadow-sm flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {isUploading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Importing...</span>
              </>
            ) : (
              <span>Import Quiz</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
