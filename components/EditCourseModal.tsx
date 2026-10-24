"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  X,
  Pencil,
  Image as ImageIcon,
  Loader2,
  Check,
  CheckCircle,
  ExternalLink,
  HardDrive,
} from "lucide-react";
import { CourseSummary } from "@/types/quiz";
import { PRESET_COURSE_BANNERS, DEFAULT_COURSE_BANNER } from "@/lib/course-manifest";
import { updateCourse } from "@/lib/api";
import { useToast } from "@/components/Toast";
import { CopyDriveLinkButton } from "@/components/CopyDriveLinkButton";

interface EditCourseModalProps {
  isOpen: boolean;
  onClose: () => void;
  course: CourseSummary | null;
  onSave: (updated: CourseSummary) => void;
}

export function EditCourseModal({
  isOpen,
  onClose,
  course,
  onSave,
}: EditCourseModalProps) {
  const { showToast } = useToast();
  const [mounted, setMounted] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedBanner, setSelectedBanner] = useState(DEFAULT_COURSE_BANNER);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (course && isOpen) {
      setTitle(course.title || "");
      setDescription(course.description || "");
      setSelectedBanner(course.banner_url || DEFAULT_COURSE_BANNER);
      setError(null);
    }
  }, [course, isOpen]);

  // Handle Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen && !isSaving) {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, isSaving, onClose]);

  if (!isOpen || !mounted || !course) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedTitle = title.trim();

    if (!trimmedTitle) {
      setError("Course title cannot be empty.");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const updated = await updateCourse(course.id, {
        title: trimmedTitle,
        description: description.trim() || undefined,
        banner_url: selectedBanner,
      });

      onSave(updated);
      showToast(`Course renamed to "${updated.title}" successfully!`, "success", 4000);
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update course.";
      setError(msg);
    } finally {
      setIsSaving(false);
    }
  };

  const modalContent = (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSaving) {
          onClose();
        }
      }}
    >
      <div
        className="relative w-full max-w-lg bg-[#1e1e1e] border border-[#333333] rounded-2xl shadow-2xl overflow-hidden text-[#ececec] my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2e2e2e] bg-[#242424]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <Pencil className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Edit Course</h3>
              <p className="text-xs text-[#9CA3AF]">
                Update course name, description, and cover image
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isSaving}
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

          {/* Course Title Field */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#a3a3a3]">
              Course Title <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Destination B1: English Grammar"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-[#141414] border border-[#383838] focus:border-white focus:ring-1 focus:ring-white rounded-xl text-sm text-[#ececec] placeholder-[#666666] outline-none transition-all"
            />
          </div>

          {/* Description Field */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#a3a3a3]">
              Description (Optional)
            </label>
            <textarea
              rows={2}
              placeholder="Brief overview of curriculum and grammar concepts..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3.5 py-2 bg-[#141414] border border-[#383838] focus:border-white focus:ring-1 focus:ring-white rounded-xl text-sm text-[#ececec] placeholder-[#666666] outline-none transition-all resize-none"
            />
          </div>

          {/* Google Drive Folder Link */}
          {course.drive_folder_id && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-[#a3a3a3] flex items-center gap-1.5">
                <HardDrive className="w-3.5 h-3.5 text-blue-400" />
                <span>Google Drive Folder Link</span>
              </label>
              <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-[#141414] border border-[#383838] text-xs">
                <span className="text-neutral-300 font-mono truncate text-[11px]">
                  {course.drive_folder_url || `https://drive.google.com/drive/folders/${course.drive_folder_id}`}
                </span>
                <div className="flex items-center gap-1 shrink-0">
                  <CopyDriveLinkButton
                    url={course.drive_folder_url}
                    folderId={course.drive_folder_id}
                    variant="badge"
                    size="sm"
                    label="Copy Link"
                  />
                  <a
                    href={course.drive_folder_url || `https://drive.google.com/drive/folders/${course.drive_folder_id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition-colors"
                    title="Open in Google Drive"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* Banner Selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-[#a3a3a3] flex items-center gap-1.5">
              <ImageIcon className="w-3.5 h-3.5 text-purple-400" />
              <span>Select Cover Banner</span>
            </label>
            <div className="grid grid-cols-4 gap-2">
              {PRESET_COURSE_BANNERS.map((banner, idx) => {
                const isSelected = selectedBanner === banner.url;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setSelectedBanner(banner.url)}
                    className={`relative rounded-lg overflow-hidden border-2 transition-all aspect-video cursor-pointer ${
                      isSelected
                        ? "border-emerald-400 ring-2 ring-emerald-400/40"
                        : "border-[#383838] opacity-60 hover:opacity-100"
                    }`}
                  >
                    <img
                      src={banner.url}
                      alt={banner.title}
                      className="w-full h-full object-cover"
                    />
                    {isSelected && (
                      <div className="absolute top-1 right-1 bg-emerald-500 text-black rounded-full p-0.5">
                        <CheckCircle className="w-3 h-3" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#2e2e2e]">
            <button
              type="button"
              disabled={isSaving}
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-gray-400 hover:text-white hover:bg-[#2c2c2c] rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving || !title.trim()}
              className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 text-black shadow-lg shadow-emerald-950/20 transition-all cursor-pointer disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>Save Changes</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
