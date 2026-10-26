"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  X,
  BookOpen,
  HardDrive,
  Sparkles,
  Loader2,
  CheckCircle,
  Star,
  Bookmark,
} from "lucide-react";
import {
  SAMPLE_BOOK_DRIVE_URL,
  DEFAULT_COURSE_BANNER,
  extractDriveFolderId,
} from "@/lib/course-manifest";
import { getDriveFolderInfo, fetchGoodreadsInfo } from "@/lib/api";
import { GoodreadsBookDetails } from "@/types/quiz";

interface ImportCourseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess: (courseId: string) => void;
  onCreateCourse: (data: {
    title: string;
    description?: string;
    author?: string;
    goodreads_url?: string;
    cover_url?: string;
    rating?: number;
    rating_count?: number;
    page_count?: number;
    isbn?: string;
    published_year?: string;
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
  const [goodreadsUrl, setGoodreadsUrl] = useState("");
  const [driveUrl, setDriveUrl] = useState("");
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [description, setDescription] = useState("");
  const [coverUrl, setCoverUrl] = useState(DEFAULT_COURSE_BANNER);
  const [rating, setRating] = useState<number | undefined>();
  const [pageCount, setPageCount] = useState<number | undefined>();
  const [publishedYear, setPublishedYear] = useState<string | undefined>();
  const [isbn, setIsbn] = useState<string | undefined>();

  const [isFetchingGoodreads, setIsFetchingGoodreads] = useState(false);
  const [goodreadsSuccess, setGoodreadsSuccess] = useState(false);
  const [isResolvingDrive, setIsResolvingDrive] = useState(false);
  const [detectedDriveName, setDetectedDriveName] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Keyboard navigation
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

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setError(null);
    }
  }, [isOpen]);

  // Handle Google Drive folder auto-resolve
  useEffect(() => {
    const trimmed = driveUrl.trim();
    if (!trimmed) {
      setDetectedDriveName(null);
      return;
    }
    const folderId = extractDriveFolderId(trimmed);
    if (!folderId) {
      setDetectedDriveName(null);
      return;
    }

    let isCurrent = true;
    setIsResolvingDrive(true);
    getDriveFolderInfo(folderId)
      .then((res) => {
        if (isCurrent && res && typeof res.name === "string") {
          const folderName = res.name;
          setDetectedDriveName(folderName);
          // If no title yet, infer from drive folder name
          setTitle((prev) => {
            if (!prev) {
              const cleaned = folderName
                .replace(/\.pdf$/i, "")
                .replace(/[_-]+/g, " ")
                .trim();
              return cleaned || folderName;
            }
            return prev;
          });
        }
      })
      .catch(() => {})
      .finally(() => {
        if (isCurrent) setIsResolvingDrive(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [driveUrl]);

  // Fetch Goodreads metadata
  const handleFetchGoodreads = async (urlToFetch?: string) => {
    const targetUrl = (urlToFetch || goodreadsUrl).trim();
    if (!targetUrl) {
      setError("Please paste a Goodreads book link first.");
      return;
    }

    setError(null);
    setIsFetchingGoodreads(true);
    setGoodreadsSuccess(false);

    try {
      const data: GoodreadsBookDetails = await fetchGoodreadsInfo(targetUrl);
      if (data.title) setTitle(data.title);
      if (data.author) setAuthor(data.author);
      if (data.description) setDescription(data.description);
      if (data.coverUrl) setCoverUrl(data.coverUrl);
      if (data.rating) setRating(data.rating);
      if (data.pageCount) setPageCount(data.pageCount);
      if (data.publishedYear) setPublishedYear(data.publishedYear);
      if (data.isbn) setIsbn(data.isbn);

      setGoodreadsSuccess(true);
    } catch (err: any) {
      setError(err.message || "Failed to fetch metadata from Goodreads.");
    } finally {
      setIsFetchingGoodreads(false);
    }
  };

  // Quick fill sample book: The Optimist
  const handleQuickFillOptimistSample = () => {
    const sampleDrive = SAMPLE_BOOK_DRIVE_URL;
    setDriveUrl(sampleDrive);
    setGoodreadsUrl("https://www.goodreads.com/book/show/214138402");
    setTitle("The Optimist: Sam Altman, OpenAI, and the Race to Invent the Future");
    setAuthor("Keach Hagey");
    setDescription(
      "The definitive, behind-the-scenes account of the high-stakes drama, secret deals, and personal rivalries inside OpenAI and the race to build superhuman artificial intelligence, from veteran Wall Street Journal tech reporter Keach Hagey."
    );
    setCoverUrl("https://images.unsplash.com/photo-1516321318423-f06f85e504b3?q=80&w=800&auto=format&fit=crop");
    setRating(4.25);
    setPageCount(354);
    setPublishedYear("2025");
    setGoodreadsSuccess(true);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError("Please provide a Book Title or Goodreads link.");
      return;
    }

    const trimmedDrive = driveUrl.trim();
    const folderId = trimmedDrive ? extractDriveFolderId(trimmedDrive) : undefined;
    const finalDriveUrl = folderId
      ? trimmedDrive.startsWith("http")
        ? trimmedDrive
        : `https://drive.google.com/drive/folders/${folderId}`
      : undefined;

    setIsSubmitting(true);
    try {
      const newBook = await onCreateCourse({
        title: trimmedTitle,
        author: author.trim() || undefined,
        description: description.trim() || undefined,
        goodreads_url: goodreadsUrl.trim() || undefined,
        cover_url: coverUrl,
        banner_url: coverUrl,
        rating,
        page_count: pageCount,
        published_year: publishedYear,
        isbn,
        drive_folder_url: finalDriveUrl,
      });

      onImportSuccess(newBook.id);
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to create book.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen || !mounted) return null;

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
        className="relative w-full max-w-2xl bg-[#1e1e1e] border border-[#333333] rounded-2xl shadow-2xl overflow-hidden text-[#ececec] my-auto max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2e2e2e] bg-[#242424] shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Import Book</h3>
              <p className="text-xs text-[#9CA3AF]">
                Import via Goodreads metadata & Google Drive chapter files
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleQuickFillOptimistSample}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25 border border-emerald-500/30 transition-colors cursor-pointer"
              title="Fill sample book: The Optimist & Google Drive folder"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Fill Sample Book</span>
            </button>

            <button
              onClick={onClose}
              disabled={isSubmitting}
              className="p-1.5 text-[#9CA3AF] hover:text-white rounded-lg hover:bg-[#333333] transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Form Body (Scrollable) */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
          {error && (
            <div className="p-3 text-xs text-red-300 bg-red-950/40 border border-red-800/60 rounded-xl">
              {error}
            </div>
          )}

          {/* Section 1: Goodreads Link */}
          <div className="p-4 rounded-xl bg-[#252525] border border-[#363636] space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                <Bookmark className="w-3.5 h-3.5" />
                <span>Goodreads Book Link</span>
              </label>
              {goodreadsSuccess && (
                <span className="flex items-center gap-1 text-[11px] text-emerald-400 font-medium">
                  <CheckCircle className="w-3.5 h-3.5" />
                  <span>Metadata Loaded</span>
                </span>
              )}
            </div>

            <div className="flex gap-2">
              <input
                type="url"
                value={goodreadsUrl}
                onChange={(e) => setGoodreadsUrl(e.target.value)}
                onBlur={() => {
                  if (goodreadsUrl.includes("goodreads.com") && !title) {
                    handleFetchGoodreads();
                  }
                }}
                placeholder="https://www.goodreads.com/book/show/..."
                className="flex-1 bg-[#1a1a1a] border border-[#3e3e3e] rounded-xl px-3.5 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-amber-400 transition-colors"
              />
              <button
                type="button"
                onClick={() => handleFetchGoodreads()}
                disabled={isFetchingGoodreads || !goodreadsUrl.trim()}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/40 transition-colors cursor-pointer disabled:opacity-50 shrink-0 flex items-center gap-1.5"
              >
                {isFetchingGoodreads ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Fetching...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Fetch Details</span>
                  </>
                )}
              </button>
            </div>
            <p className="text-[11px] text-gray-400">
              Paste a Goodreads link to automatically fetch book title, author, cover, rating, and synopsis.
            </p>
          </div>

          {/* Section 2: Google Drive Folder Link */}
          <div className="p-4 rounded-xl bg-[#252525] border border-[#363636] space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-blue-400 flex items-center gap-1.5">
                <HardDrive className="w-3.5 h-3.5" />
                <span>Google Drive Folder Link (Chapters)</span>
              </label>
              {isResolvingDrive && (
                <span className="flex items-center gap-1 text-[11px] text-blue-400">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>Checking Drive...</span>
                </span>
              )}
            </div>

            <input
              type="text"
              value={driveUrl}
              onChange={(e) => setDriveUrl(e.target.value)}
              placeholder="https://drive.google.com/drive/folders/13_vo8ifAR_FS8jPYGKxyW_nYSlGoNYbT"
              className="w-full bg-[#1a1a1a] border border-[#3e3e3e] rounded-xl px-3.5 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-blue-400 transition-colors"
            />

            {detectedDriveName && (
              <div className="text-[11px] text-emerald-400 flex items-center gap-1">
                <CheckCircle className="w-3 h-3" />
                <span className="truncate">Folder: {detectedDriveName}</span>
              </div>
            )}

            <p className="text-[11px] text-gray-400">
              Supports folders with chapter PDFs, manifest.csv, or toc.json to automatically generate chapters.
            </p>
          </div>

          {/* Section 3: Book Details & Preview */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
            {/* Cover Preview */}
            <div className="md:col-span-1 space-y-2">
              <label className="text-xs font-semibold text-gray-400 block">Cover Preview</label>
              <div className="relative aspect-[2/3] w-full rounded-xl overflow-hidden bg-black/60 border border-[#333333] shadow-md flex items-center justify-center">
                {coverUrl ? (
                  <img
                    src={coverUrl}
                    alt={title || "Book Cover"}
                    className="w-full h-full object-cover"
                    onError={() => setCoverUrl(DEFAULT_COURSE_BANNER)}
                  />
                ) : (
                  <BookOpen className="w-10 h-10 text-gray-600" />
                )}
                {rating && (
                  <div className="absolute bottom-2 left-2 flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-black/80 backdrop-blur text-amber-300 border border-amber-500/30">
                    <Star className="w-3 h-3 fill-amber-300 text-amber-300" />
                    <span>{rating.toFixed(2)}</span>
                  </div>
                )}
              </div>

              {pageCount && (
                <div className="text-[11px] text-gray-400 text-center">
                  {pageCount} pages {publishedYear ? `• ${publishedYear}` : ""}
                </div>
              )}
            </div>

            {/* Editable Fields */}
            <div className="md:col-span-2 space-y-3">
              <div>
                <label className="text-xs font-semibold text-gray-300 block mb-1">
                  Book Title <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Project Hail Mary"
                  className="w-full bg-[#1b1b1b] border border-[#333333] rounded-xl px-3.5 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-white transition-colors"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-300 block mb-1">Author</label>
                <input
                  type="text"
                  value={author}
                  onChange={(e) => setAuthor(e.target.value)}
                  placeholder="e.g. Andy Weir"
                  className="w-full bg-[#1b1b1b] border border-[#333333] rounded-xl px-3.5 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-white transition-colors"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-300 block mb-1">Description / Synopsis</label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Book summary or key themes..."
                  className="w-full bg-[#1b1b1b] border border-[#333333] rounded-xl p-3 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-white transition-colors resize-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-300 block mb-1">Cover Image URL</label>
                <input
                  type="url"
                  value={coverUrl}
                  onChange={(e) => setCoverUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full bg-[#1b1b1b] border border-[#333333] rounded-xl px-3.5 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-white transition-colors"
                />
              </div>
            </div>
          </div>

          {/* Modal Footer Actions */}
          <div className="pt-4 border-t border-[#2e2e2e] flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-300 hover:text-white hover:bg-[#282828] transition-colors cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isSubmitting || !title.trim()}
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-bold bg-white text-black hover:bg-neutral-200 transition-all shadow-md cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Importing Book & Chapters...</span>
                </>
              ) : (
                <>
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>Create Book & Import Chapters</span>
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

export const ImportBookModal = ImportCourseModal;
