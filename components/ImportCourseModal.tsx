"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  X,
  HardDrive,
  FolderGit2,
  Image as ImageIcon,
  Loader2,
  Sparkles,
  CheckCircle,
} from "lucide-react";
import {
  DEFAULT_DRIVE_URL,
  DEFAULT_COURSE_TITLE,
  DEFAULT_COURSE_DESC,
  PRESET_COURSE_BANNERS,
  DEFAULT_COURSE_BANNER,
  extractDriveFolderId,
} from "@/lib/course-manifest";
import { getDriveFolderInfo } from "@/lib/api";

interface ImportCourseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess: (courseId: string) => void;
  onCreateCourse: (data: {
    title: string;
    description?: string;
    drive_folder_url?: string;
    banner_url?: string;
  }) => Promise<any>;
}

export function ImportCourseModal({
  isOpen,
  onClose,
  onImportSuccess,
  onCreateCourse,
}: ImportCourseModalProps) {
  const [mounted, setMounted] = useState(false);
  const [driveUrl, setDriveUrl] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedBanner, setSelectedBanner] = useState(DEFAULT_COURSE_BANNER);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detectedName, setDetectedName] = useState<string | null>(null);
  const [isResolvingName, setIsResolvingName] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Auto-detect Google Drive folder name when link changes
  useEffect(() => {
    const trimmed = driveUrl.trim();
    if (!trimmed) {
      setDetectedName(null);
      return;
    }
    const folderId = extractDriveFolderId(trimmed);
    if (!folderId) {
      setDetectedName(null);
      return;
    }

    let isCurrent = true;
    setIsResolvingName(true);
    getDriveFolderInfo(folderId)
      .then((res) => {
        if (isCurrent && res?.name) {
          setDetectedName(res.name);
          setTitle((prev) => (!prev || prev === DEFAULT_COURSE_TITLE || prev === "d" ? (res.name || prev) : prev));
        }
      })
      .catch(() => {})
      .finally(() => {
        if (isCurrent) setIsResolvingName(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [driveUrl]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen && !isSubmitting) {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, isSubmitting, onClose]);

  if (!isOpen || !mounted) return null;

  const handleQuickFillDestinationB1 = () => {
    setDriveUrl(DEFAULT_DRIVE_URL);
    if (!title) setTitle(DEFAULT_COURSE_TITLE);
    if (!description) setDescription(DEFAULT_COURSE_DESC);
    setSelectedBanner(PRESET_COURSE_BANNERS[0].url);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedUrl = driveUrl.trim();
    if (!trimmedUrl) {
      setError("Please provide a Google Drive folder link or folder ID.");
      return;
    }

    const folderId = extractDriveFolderId(trimmedUrl);
    if (!folderId) {
      setError("Invalid Google Drive folder link or ID format.");
      return;
    }

    const courseTitle =
      title.trim() || detectedName || `Course (${folderId.slice(0, 8)}...)`;

    setIsSubmitting(true);
    try {
      const newCourse = await onCreateCourse({
        title: courseTitle,
        description: description.trim() || undefined,
        drive_folder_url: trimmedUrl.startsWith("http")
          ? trimmedUrl
          : `https://drive.google.com/drive/folders/${folderId}`,
        banner_url: selectedBanner,
      });

      onImportSuccess(newCourse.id);
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to import course from Google Drive.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) {
          onClose();
        }
      }}
    >
      <div
        className="relative w-full max-w-xl bg-[#1e1e1e] border border-[#333333] rounded-2xl shadow-2xl overflow-hidden text-[#ececec] my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2e2e2e] bg-[#242424]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Import Course from Google Drive</h3>
              <p className="text-xs text-[#9CA3AF]">
                Paste a Google Drive folder URL to automatically map units and quizzes
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 text-xs text-red-300 bg-red-950/40 border border-red-800/60 rounded-xl">
              {error}
            </div>
          )}

          {/* Drive URL Field */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-[#a3a3a3]">
                Google Drive Folder Link / ID <span className="text-red-400">*</span>
              </label>
              <button
                type="button"
                onClick={handleQuickFillDestinationB1}
                className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors font-medium cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Fill Destination B1 Sample</span>
              </button>
            </div>
            <input
              type="text"
              required
              placeholder="https://drive.google.com/drive/folders/1wqG3TMDqwYCQv5eQ9eDyFKdy8X9lJWTd"
              value={driveUrl}
              onChange={(e) => {
                setDriveUrl(e.target.value);
                setError(null);
              }}
              className="w-full px-3.5 py-2.5 bg-[#141414] border border-[#333333] focus:border-white focus:ring-1 focus:ring-white rounded-xl text-sm text-[#ececec] placeholder-[#666666] outline-none transition-all font-mono"
            />
            {isResolvingName && (
              <div className="flex items-center gap-1.5 mt-1.5 text-xs text-blue-400">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Checking Google Drive folder name...</span>
              </div>
            )}
            {detectedName && (
              <div className="flex items-center justify-between gap-2 mt-2 px-3 py-1.5 bg-blue-950/30 border border-blue-800/40 rounded-xl text-xs text-blue-300">
                <span className="flex items-center gap-1.5">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>
                    Drive Folder Name: <strong className="text-white">"{detectedName}"</strong>
                  </span>
                </span>
                {title !== detectedName && (
                  <button
                    type="button"
                    onClick={() => setTitle(detectedName)}
                    className="text-[11px] underline text-blue-400 hover:text-white cursor-pointer"
                  >
                    Use as title
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Course Title Field */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-[#a3a3a3]">
                Course Title
              </label>
              {detectedName && title !== detectedName && (
                <button
                  type="button"
                  onClick={() => setTitle(detectedName)}
                  className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1 cursor-pointer"
                >
                  <Sparkles className="w-3 h-3" />
                  <span>Set from Drive: "{detectedName}"</span>
                </button>
              )}
            </div>
            <input
              type="text"
              placeholder={detectedName || "e.g. Destination B1: English Grammar"}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-[#141414] border border-[#333333] focus:border-white focus:ring-1 focus:ring-white rounded-xl text-sm text-[#ececec] placeholder-[#666666] outline-none transition-all"
            />
          </div>

          {/* Description Field */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#a3a3a3] mb-1.5">
              Description (Optional)
            </label>
            <textarea
              rows={2}
              placeholder="Brief overview of curriculum and grammar concepts..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3.5 py-2 bg-[#141414] border border-[#333333] focus:border-white focus:ring-1 focus:ring-white rounded-xl text-sm text-[#ececec] placeholder-[#666666] outline-none transition-all resize-none"
            />
          </div>

          {/* Cover Banner Selection */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#a3a3a3] mb-2 flex items-center gap-1.5">
              <ImageIcon className="w-3.5 h-3.5" />
              <span>Course Cover Image</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {PRESET_COURSE_BANNERS.map((preset) => {
                const isSelected = selectedBanner === preset.url;
                return (
                  <div
                    key={preset.id}
                    onClick={() => setSelectedBanner(preset.url)}
                    className={`relative cursor-pointer rounded-xl overflow-hidden border-2 transition-all group ${
                      isSelected
                        ? "border-blue-500 scale-[1.02] shadow-lg shadow-blue-500/20"
                        : "border-[#333333] hover:border-[#555555] opacity-75 hover:opacity-100"
                    }`}
                  >
                    <img
                      src={preset.url}
                      alt={preset.title}
                      className="w-full h-16 object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex items-end p-1.5">
                      <span className="text-[10px] font-medium text-white truncate">
                        {preset.title}
                      </span>
                    </div>
                    {isSelected && (
                      <div className="absolute top-1 right-1 bg-blue-500 text-white rounded-full p-0.5">
                        <CheckCircle className="w-3 h-3" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#2e2e2e]">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-[#9CA3AF] hover:text-white hover:bg-[#2b2b2b] rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 px-5 py-2 text-sm font-semibold bg-white text-black hover:bg-neutral-200 rounded-xl transition-all shadow-md cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-black" />
                  <span>Importing & Syncing...</span>
                </>
              ) : (
                <>
                  <HardDrive className="w-4 h-4 text-black" />
                  <span>Import Course</span>
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
