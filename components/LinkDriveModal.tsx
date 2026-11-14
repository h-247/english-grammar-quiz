"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, HardDrive, Loader2, CheckCircle } from "lucide-react";
import { extractDriveFolderId } from "@/lib/course-manifest";
import { getDriveFolderInfo, syncCourseDrive } from "@/lib/api";
import { useToast } from "@/components/Toast";
import { CourseDetail } from "@/types/quiz";

interface LinkDriveModalProps {
  isOpen: boolean;
  onClose: () => void;
  courseId: string;
  courseTitle: string;
  currentDriveUrl?: string | null;
  onSuccess?: (updated: CourseDetail) => void;
}

export function LinkDriveModal({
  isOpen,
  onClose,
  courseId,
  courseTitle,
  currentDriveUrl = "",
  onSuccess,
}: LinkDriveModalProps) {
  const { showToast } = useToast();
  const [mounted, setMounted] = useState(false);
  const [driveUrl, setDriveUrl] = useState(currentDriveUrl || "");
  const [isResolving, setIsResolving] = useState(false);
  const [detectedFolder, setDetectedFolder] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setDriveUrl(currentDriveUrl || "");
      setDetectedFolder(null);
      setError(null);
    }
  }, [isOpen, currentDriveUrl]);

  useEffect(() => {
    const trimmed = driveUrl.trim();
    if (!trimmed) {
      setDetectedFolder(null);
      return;
    }
    const folderId = extractDriveFolderId(trimmed);
    if (!folderId) {
      setDetectedFolder(null);
      return;
    }

    let isCancelled = false;
    setIsResolving(true);
    getDriveFolderInfo(folderId)
      .then((info) => {
        if (!isCancelled && info?.name) {
          setDetectedFolder(info.name);
        }
      })
      .catch(() => {
        if (!isCancelled) setDetectedFolder(null);
      })
      .finally(() => {
        if (!isCancelled) setIsResolving(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [driveUrl]);

  if (!isOpen || !mounted) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = driveUrl.trim();
    if (!trimmed) {
      setError("Please enter a Google Drive folder link or folder ID.");
      return;
    }

    const folderId = extractDriveFolderId(trimmed);
    if (!folderId) {
      setError("Invalid Google Drive folder link or ID.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const updated = await syncCourseDrive(courseId, {
        drive_folder_url: trimmed,
        forceRefresh: true,
      });

      const count =
        updated.total_chapters ||
        updated.total_quizzes ||
        (updated.chapters || []).length ||
        0;

      showToast(
        `Google Drive linked! ${count > 0 ? `(${count} chapters imported)` : ""}`,
        "success",
        5000
      );
      onSuccess?.(updated);
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to import Google Drive link.";
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) onClose();
      }}
    >
      <div className="relative w-full max-w-md bg-[#1c1c1c] border border-[#2e2e2e] rounded-2xl shadow-2xl text-white p-6 space-y-5">
        <div className="flex items-center justify-between border-b border-[#2e2e2e] pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center border border-blue-500/30">
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Import Google Drive Link</h2>
              <p className="text-xs text-gray-400 line-clamp-1">
                For: {courseTitle}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-[#282828] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-red-950/40 border border-red-500/40 text-xs text-red-200">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold uppercase tracking-wider text-blue-400">
                Google Drive Folder Link
              </label>
              {isResolving && (
                <span className="flex items-center gap-1 text-[11px] text-blue-400">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>Checking...</span>
                </span>
              )}
            </div>

            <input
              type="text"
              required
              value={driveUrl}
              onChange={(e) => setDriveUrl(e.target.value)}
              placeholder="https://drive.google.com/drive/folders/..."
              className="w-full bg-[#141414] border border-[#3e3e3e] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-blue-400 transition-colors"
            />

            {detectedFolder && (
              <div className="text-[11px] text-emerald-400 flex items-center gap-1.5 bg-emerald-500/10 px-2.5 py-1.5 rounded-lg border border-emerald-500/20">
                <CheckCircle className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">Folder: {detectedFolder}</span>
              </div>
            )}

            <p className="text-[11px] text-gray-400">
              Paste the Google Drive folder link containing chapter PDFs, manifest.csv, or toc.json to import chapters.
            </p>
          </div>

          <div className="pt-2 border-t border-[#2e2e2e] flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-400 hover:text-white hover:bg-[#282828] transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !driveUrl.trim()}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white transition-all shadow-md cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Importing & Syncing...</span>
                </>
              ) : (
                <>
                  <HardDrive className="w-3.5 h-3.5" />
                  <span>Import & Sync Chapters</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
