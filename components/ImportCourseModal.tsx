"use client";

import React, { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  X,
  BookOpen,
  HardDrive,
  Sparkles,
  Loader2,
  CheckCircle,
  Bookmark,
} from "lucide-react";
import {
  DEFAULT_COURSE_BANNER,
  extractDriveFolderId,
} from "@/lib/course-manifest";
import {
  getDriveFolderInfo,
  fetchGoodreadsInfo,
  getBookTypes,
} from "@/lib/api";
import { GoodreadsBookDetails, BookTypeItem } from "@/types/quiz";
import { getBookMainTypes } from "@/lib/utils";

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
    main_type?: string;
    author_goodreads_url?: string;
    genres?: string[];
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

  // Fetched metadata cache
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [authorGoodreadsUrl, setAuthorGoodreadsUrl] = useState("");
  const [goodreadsGenres, setGoodreadsGenres] = useState<string[]>([]);
  const [description, setDescription] = useState("");
  const [coverUrl, setCoverUrl] = useState(DEFAULT_COURSE_BANNER);
  const [rating, setRating] = useState<number | undefined>();
  const [pageCount, setPageCount] = useState<number | undefined>();
  const [publishedYear, setPublishedYear] = useState<string | undefined>();
  const [isbn, setIsbn] = useState<string | undefined>();

  // Repo genres for auto-matching
  const [repoTypes, setRepoTypes] = useState<BookTypeItem[]>([]);

  const [isFetchingGoodreads, setIsFetchingGoodreads] = useState(false);
  const [goodreadsSuccess, setGoodreadsSuccess] = useState(false);
  const [isResolvingDrive, setIsResolvingDrive] = useState(false);
  const [detectedDriveName, setDetectedDriveName] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const resetForm = useCallback(() => {
    setGoodreadsUrl("");
    setDriveUrl("");
    setTitle("");
    setAuthor("");
    setAuthorGoodreadsUrl("");
    setGoodreadsGenres([]);
    setDescription("");
    setCoverUrl(DEFAULT_COURSE_BANNER);
    setRating(undefined);
    setPageCount(undefined);
    setPublishedYear(undefined);
    setIsbn(undefined);
    setGoodreadsSuccess(false);
    setIsFetchingGoodreads(false);
    setIsResolvingDrive(false);
    setDetectedDriveName(null);
    setError(null);
  }, []);

  const handleClose = useCallback(() => {
    if (isSubmitting) return;
    resetForm();
    onClose();
  }, [isSubmitting, onClose, resetForm]);

  // Reset form whenever modal opens
  useEffect(() => {
    if (isOpen) {
      resetForm();
    }
  }, [isOpen, resetForm]);

  // Fetch repo book genres for auto-matching Goodreads genres
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

  // Keyboard navigation: Escape to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen && !isSubmitting) {
        handleClose();
      }
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, isSubmitting, handleClose]);

  // Auto-resolve Google Drive folder name when user pastes Drive URL
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

    let isCancelled = false;
    setIsResolvingDrive(true);

    getDriveFolderInfo(folderId)
      .then((info) => {
        if (!isCancelled && info) {
          setDetectedDriveName(info.name || null);
          if (info.name && !title) {
            setTitle(info.name);
          }
        }
      })
      .catch(() => {
        if (!isCancelled) setDetectedDriveName(null);
      })
      .finally(() => {
        if (!isCancelled) setIsResolvingDrive(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [driveUrl, title]);

  // Handle Fetch Details from Goodreads
  const handleFetchGoodreads = async (overrideUrl?: string) => {
    const targetUrl = (overrideUrl || goodreadsUrl).trim();
    if (!targetUrl) return;

    setError(null);
    setIsFetchingGoodreads(true);
    setGoodreadsSuccess(false);

    try {
      const data: GoodreadsBookDetails = await fetchGoodreadsInfo(targetUrl);
      if (data.title) setTitle(data.title);
      if (data.author) setAuthor(data.author);
      if (data.authorGoodreadsUrl) setAuthorGoodreadsUrl(data.authorGoodreadsUrl);

      const rawGdGenres = data.genres || [];
      if (data.mainType && !rawGdGenres.includes(data.mainType)) {
        rawGdGenres.unshift(data.mainType);
      }
      setGoodreadsGenres(rawGdGenres);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedGd = goodreadsUrl.trim();
    const trimmedDrive = driveUrl.trim();

    if (!trimmedGd && !trimmedDrive) {
      setError("Please provide a Goodreads Book Link or Google Drive Folder Link.");
      return;
    }

    setIsSubmitting(true);
    try {
      let bookTitle = title.trim();
      let bookAuthor = author.trim();
      let bookAuthorGd = authorGoodreadsUrl.trim();
      let bookGenres: string[] = [];
      let bookDesc = description.trim();
      let bookCover = coverUrl || DEFAULT_COURSE_BANNER;
      let bookRating = rating;
      let bookPageCount = pageCount;
      let bookPublishedYear = publishedYear;
      let bookIsbn = isbn;

      // Automatically fetch Goodreads metadata if not yet fetched
      if (trimmedGd && (!bookTitle || !goodreadsSuccess)) {
        try {
          const data: GoodreadsBookDetails = await fetchGoodreadsInfo(trimmedGd);
          if (data.title) bookTitle = data.title;
          if (data.author) bookAuthor = data.author;
          if (data.authorGoodreadsUrl) bookAuthorGd = data.authorGoodreadsUrl;
          if (data.description) bookDesc = data.description;
          if (data.coverUrl) bookCover = data.coverUrl;
          if (data.rating) bookRating = data.rating;
          if (data.pageCount) bookPageCount = data.pageCount;
          if (data.publishedYear) bookPublishedYear = data.publishedYear;
          if (data.isbn) bookIsbn = data.isbn;

          const rawGdGenres = data.genres || [];
          if (data.mainType && !rawGdGenres.includes(data.mainType)) {
            rawGdGenres.unshift(data.mainType);
          }
          if (repoTypes.length > 0) {
            const matched = getBookMainTypes(
              { title: bookTitle, genres: rawGdGenres },
              repoTypes.map((t) => t.name)
            );
            if (matched && matched.length > 0) {
              bookGenres = matched;
            }
          }
        } catch (fetchErr: any) {
          console.warn("Auto-fetch goodreads details failed:", fetchErr);
        }
      } else if (goodreadsGenres.length > 0 && repoTypes.length > 0) {
        const matched = getBookMainTypes(
          { title: bookTitle, genres: goodreadsGenres },
          repoTypes.map((t) => t.name)
        );
        if (matched && matched.length > 0) {
          bookGenres = matched;
        }
      }

      // If still no title and drive folder link is provided, attempt to use Drive folder name
      if (!bookTitle && trimmedDrive) {
        const folderId = extractDriveFolderId(trimmedDrive);
        if (folderId) {
          try {
            const info = await getDriveFolderInfo(folderId);
            if (info?.name) bookTitle = info.name;
          } catch {}
        }
      }

      if (!bookTitle) {
        bookTitle = "Untitled Book";
      }

      if (bookGenres.length === 0) {
        bookGenres = [repoTypes[0]?.name || "Biography"];
      }

      const folderId = trimmedDrive ? extractDriveFolderId(trimmedDrive) : undefined;
      const finalDriveUrl = folderId
        ? `https://drive.google.com/drive/folders/${folderId}`
        : undefined;

      const finalMainType = bookGenres.join(" & ");

      const newBook = await onCreateCourse({
        title: bookTitle,
        author: bookAuthor || undefined,
        author_goodreads_url:
          bookAuthorGd ||
          (bookAuthor.toLowerCase().includes("keach")
            ? "https://www.goodreads.com/author/show/16995547.Keach_Hagey"
            : undefined),
        main_type: finalMainType,
        genres: bookGenres,
        description: bookDesc || undefined,
        goodreads_url: trimmedGd || undefined,
        cover_url: bookCover,
        banner_url: bookCover,
        rating: bookRating,
        page_count: bookPageCount,
        published_year: bookPublishedYear,
        isbn: bookIsbn,
        drive_folder_url: finalDriveUrl,
      });

      resetForm();
      onImportSuccess(newBook.id);
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to import book.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen || !mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) handleClose();
      }}
    >
      <div className="relative w-full max-w-lg bg-[#1b1b1b] border border-[#2f2f2f] rounded-2xl shadow-2xl text-white p-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#2e2e2e] pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center border border-purple-500/30">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Import Book into Library</h2>
              <p className="text-xs text-gray-400">
                Link Goodreads and Google Drive to import your book.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={isSubmitting}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-[#282828] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body - Only contains Goodreads Book Link & Google Drive Folder Link */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-red-950/40 border border-red-500/40 text-xs text-red-200">
              {error}
            </div>
          )}

          {/* Section 1: Goodreads Book Link */}
          <div className="p-4 rounded-xl bg-[#252525] border border-[#363636] space-y-2.5">
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

            {goodreadsSuccess && title && (
              <div className="text-[11px] text-emerald-400 flex items-center gap-1.5 bg-emerald-500/10 px-2.5 py-1.5 rounded-lg border border-emerald-500/20">
                <CheckCircle className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">
                  {title} {author ? `by ${author}` : ""}
                </span>
              </div>
            )}

            <p className="text-[11px] text-gray-400">
              Paste a Goodreads link to automatically fetch book title, author, cover, and genres.
            </p>
          </div>

          {/* Section 2: Google Drive Folder Link (Chapters) */}
          <div className="p-4 rounded-xl bg-[#252525] border border-[#363636] space-y-2.5">
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
              placeholder="https://drive.google.com/drive/folders/..."
              className="w-full bg-[#1a1a1a] border border-[#3e3e3e] rounded-xl px-3.5 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-blue-400 transition-colors"
            />

            {detectedDriveName && (
              <div className="text-[11px] text-emerald-400 flex items-center gap-1.5 bg-emerald-500/10 px-2.5 py-1.5 rounded-lg border border-emerald-500/20">
                <CheckCircle className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">Folder: {detectedDriveName}</span>
              </div>
            )}

            <p className="text-[11px] text-gray-400">
              Supports folders with chapter PDFs, manifest.csv, or toc.json to automatically generate chapters.
            </p>
          </div>

          {/* Modal Footer Actions */}
          <div className="pt-3 border-t border-[#2e2e2e] flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={handleClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-300 hover:text-white hover:bg-[#282828] transition-colors cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isSubmitting || (!goodreadsUrl.trim() && !driveUrl.trim())}
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
                  <span>Import Book</span>
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
