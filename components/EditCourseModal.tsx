"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  X,
  Loader2,
  BookOpen,
  Check,
  Tag,
} from "lucide-react";
import { CourseSummary, BookTypeItem } from "@/types/quiz";
import { DEFAULT_COURSE_BANNER } from "@/lib/course-manifest";
import { updateCourse, getBookTypes } from "@/lib/api";
import { getBookMainTypes, DEFAULT_REPO_BOOK_TYPES } from "@/lib/utils";
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
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const mainType = selectedTypes[0] || "";
  const [description, setDescription] = useState("");
  const [goodreadsUrl, setGoodreadsUrl] = useState("");
  const [selectedBanner, setSelectedBanner] = useState(DEFAULT_COURSE_BANNER);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [repoTypes, setRepoTypes] = useState<BookTypeItem[]>([]);

  useEffect(() => {
    if (!isOpen) return;
    let isCancelled = false;
    getBookTypes()
      .then((types) => {
        if (!isCancelled && Array.isArray(types)) {
          const filtered = types.filter(
            (t) =>
              t.name.toLowerCase() !== "nonfiction" &&
              t.name.toLowerCase() !== "fiction" &&
              t.name.toLowerCase() !== "non-fiction"
          );
          setRepoTypes(filtered);
        }
      })
      .catch(() => {});
    return () => {
      isCancelled = true;
    };
  }, [isOpen]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (course && isOpen) {
      setTitle(course.title || "");
      setAuthor(course.author || "");
      setAuthorGoodreadsUrl((course as any).author_goodreads_url || (course.author && course.author.toLowerCase().includes('keach') ? 'https://www.goodreads.com/author/show/16995547.Keach_Hagey' : ''));
      const types = getBookMainTypes(course, repoTypes.map((t) => t.name));
      setSelectedTypes(types.length > 0 ? types : [repoTypes[0]?.name || "Biography"]);
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

  const toggleType = (typeName: string) => {
    setSelectedTypes((prev) => {
      const exists = prev.some((t) => t.toLowerCase() === typeName.toLowerCase());
      if (exists) {
        if (prev.length <= 1) return prev;
        return prev.filter((t) => t.toLowerCase() !== typeName.toLowerCase());
      } else {
        return [...prev, typeName];
      }
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedTitle = title.trim();

    if (!trimmedTitle) {
      setError("Book title cannot be empty.");
      return;
    }

    setIsSaving(true);
    setError(null);

    const typesToSave =
      selectedTypes.length > 0 ? selectedTypes : [repoTypes[0]?.name || "Biography"];

    try {
      const updated = await updateCourse(course.id, {
        title: trimmedTitle,
        author: author.trim() || undefined,
        author_goodreads_url: authorGoodreadsUrl.trim() || (author.trim().toLowerCase().includes('keach') ? 'https://www.goodreads.com/author/show/16995547.Keach_Hagey' : undefined),
        main_type: typesToSave.join(" & "),
        genres: typesToSave,
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

          {/* Book Genre (Repo Genres Only) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold uppercase tracking-wider text-[#a3a3a3] block">
                Genres of Book ({selectedTypes.length})
              </label>
            </div>
            <div className="flex flex-wrap gap-1.5 min-h-[38px] p-2 rounded-xl bg-[#161616] border border-[#333333] items-center">
              {selectedTypes.map((tName) => (
                <span
                  key={tName}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-600 text-white border border-purple-400 shadow-sm"
                >
                  <span>{tName}</span>
                  {selectedTypes.length > 1 && (
                    <button
                      type="button"
                      onClick={() => toggleType(tName)}
                      className="text-purple-200 hover:text-white ml-0.5 cursor-pointer"
                      title={`Remove ${tName}`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </span>
              ))}
            </div>
            <div className="space-y-1">
              <span className="text-[10px] text-gray-400 block font-medium">
                Click to select / deselect from repo genres:
              </span>
              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
                {repoTypes.map((t) => {
                  const isSelected = selectedTypes.some(
                    (st) => st.toLowerCase() === t.name.toLowerCase()
                  );
                  return (
                    <button
                      key={t.id || t.name}
                      type="button"
                      onClick={() => toggleType(t.name)}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all cursor-pointer ${
                        isSelected
                          ? "bg-purple-600 text-white border border-purple-400 shadow-sm"
                          : "bg-[#2a2a2a] text-gray-300 border border-white/5 hover:bg-[#333333] hover:text-white"
                      }`}
                    >
                      {isSelected && <Check className="w-3 h-3" />}
                      <span>{t.name}</span>
                    </button>
                  );
                })}
              </div>
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
