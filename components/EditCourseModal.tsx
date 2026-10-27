"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  X,
  Loader2,
  BookOpen,
} from "lucide-react";
import { CourseSummary } from "@/types/quiz";
import { DEFAULT_COURSE_BANNER } from "@/lib/course-manifest";
import { updateCourse } from "@/lib/api";
import { getBookMainTypes } from "@/lib/utils";
import { useToast } from "@/components/Toast";

interface EditCourseModalProps {
  isOpen: boolean;
  onClose: () => void;
  course: CourseSummary | null;
  onSave?: (updated: CourseSummary) => void;
  onSuccess?: () => void;
}

export function EditCourseModal({
  isOpen,
  onClose,
  course,
  onSave,
  onSuccess,
}: EditCourseModalProps) {
  const { showToast } = useToast();
  const [mounted, setMounted] = useState(false);
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [authorGoodreadsUrl, setAuthorGoodreadsUrl] = useState("");
  const [mainType1, setMainType1] = useState("");
  const [mainType2, setMainType2] = useState("");
  const [description, setDescription] = useState("");
  const [goodreadsUrl, setGoodreadsUrl] = useState("");
  const [selectedBanner, setSelectedBanner] = useState(DEFAULT_COURSE_BANNER);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (course && isOpen) {
      setTitle(course.title || "");
      setAuthor(course.author || "");
      setAuthorGoodreadsUrl((course as any).author_goodreads_url || (course.author && course.author.toLowerCase().includes('keach') ? 'https://www.goodreads.com/author/show/16995547.Keach_Hagey' : ''));
      const [t1, t2] = getBookMainTypes(course);
      setMainType1(t1 || "");
      setMainType2(t2 || "");
      setDescription(course.description || "");
      setGoodreadsUrl(course.goodreads_url || "");
      setSelectedBanner(course.cover_url || course.banner_url || DEFAULT_COURSE_BANNER);
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
      setError("Book title cannot be empty.");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const updated = await updateCourse(course.id, {
        title: trimmedTitle,
        author: author.trim() || undefined,
        author_goodreads_url: authorGoodreadsUrl.trim() || (author.trim().toLowerCase().includes('keach') ? 'https://www.goodreads.com/author/show/16995547.Keach_Hagey' : undefined),
        main_type: [mainType1.trim(), mainType2.trim()].filter(Boolean).join(" & ") || undefined,
        genres: [mainType1.trim(), mainType2.trim()].filter(Boolean).length > 0 ? [mainType1.trim(), mainType2.trim()].filter(Boolean) : undefined,
        description: description.trim() || undefined,
        goodreads_url: goodreadsUrl.trim() || undefined,
        cover_url: selectedBanner,
        banner_url: selectedBanner,
      });

      onSave?.(updated);
      onSuccess?.();
      showToast(`Book "${updated.title}" updated successfully!`, "success", 4000);
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update book.";
      setError(msg);
    } finally {
      setIsSaving(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSaving) {
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
            <div className="p-2 rounded-lg bg-white/10 text-white border border-white/20">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Edit Book Details</h3>
              <p className="text-xs text-[#9CA3AF]">
                Update title, author, description, and cover image
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

          {/* Title Field */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-[#a3a3a3] block mb-1.5">
              Book Title <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. The Optimist"
              className="w-full bg-[#161616] border border-[#333333] rounded-xl px-3.5 py-2.5 text-sm text-[#ececec] placeholder-gray-500 focus:outline-none focus:border-white transition-colors"
            />
          </div>

          {/* Author Field */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-[#a3a3a3] block mb-1.5">
              Author
            </label>
            <input
              type="text"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              placeholder="e.g. Keach Hagey"
              className="w-full bg-[#161616] border border-[#333333] rounded-xl px-3.5 py-2.5 text-sm text-[#ececec] placeholder-gray-500 focus:outline-none focus:border-white transition-colors"
            />
          </div>

          {/* 2 Main Types */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-[#a3a3a3] block mb-1.5">
                Main Type 1 (Nonfiction / Fiction)
              </label>
              <input
                type="text"
                value={mainType1}
                onChange={(e) => setMainType1(e.target.value)}
                placeholder="e.g. Nonfiction"
                className="w-full bg-[#161616] border border-[#333333] rounded-xl px-3.5 py-2 text-sm text-[#ececec] placeholder-gray-500 focus:outline-none focus:border-white transition-colors"
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-[#a3a3a3] block mb-1.5">
                Main Type 2 (Goodreads Genre)
              </label>
              <input
                type="text"
                value={mainType2}
                onChange={(e) => setMainType2(e.target.value)}
                placeholder="e.g. Business"
                className="w-full bg-[#161616] border border-[#333333] rounded-xl px-3.5 py-2 text-sm text-[#ececec] placeholder-gray-500 focus:outline-none focus:border-white transition-colors"
              />
            </div>
          </div>

          {/* Goodreads URL */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-[#a3a3a3] block mb-1.5">
              Goodreads Link
            </label>
            <input
              type="url"
              value={goodreadsUrl}
              onChange={(e) => setGoodreadsUrl(e.target.value)}
              placeholder="https://www.goodreads.com/book/show/..."
              className="w-full bg-[#161616] border border-[#333333] rounded-xl px-3.5 py-2 text-sm text-[#ececec] placeholder-gray-500 focus:outline-none focus:border-white transition-colors"
            />
          </div>

          {/* Description Field */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-[#a3a3a3] block mb-1.5">
              Description / Synopsis
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of the book..."
              className="w-full bg-[#161616] border border-[#333333] rounded-xl p-3 text-xs text-[#ececec] placeholder-gray-500 focus:outline-none focus:border-white transition-colors resize-none"
            />
          </div>

          {/* Cover Image URL */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-[#a3a3a3] block mb-1.5">
              Cover Image URL
            </label>
            <input
              type="url"
              value={selectedBanner}
              onChange={(e) => setSelectedBanner(e.target.value)}
              placeholder="https://..."
              className="w-full bg-[#161616] border border-[#333333] rounded-xl px-3.5 py-2 text-xs text-[#ececec] placeholder-gray-500 focus:outline-none focus:border-white transition-colors"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#2e2e2e]">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-[#a3a3a3] hover:text-white hover:bg-[#282828] transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving || !title.trim()}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-white text-black hover:bg-neutral-200 transition-all shadow-sm cursor-pointer disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <span>Save Changes</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}

export const EditBookModal = EditCourseModal;
