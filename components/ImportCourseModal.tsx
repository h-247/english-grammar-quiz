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
  Plus,
  Edit2,
  Trash2,
  Check,
  Tag,
  Settings2,
} from "lucide-react";
import {
  SAMPLE_BOOK_DRIVE_URL,
  DEFAULT_COURSE_BANNER,
  extractDriveFolderId,
} from "@/lib/course-manifest";
import {
  getDriveFolderInfo,
  fetchGoodreadsInfo,
  getBookTypes,
  createBookType,
  updateBookType,
  deleteBookType,
} from "@/lib/api";
import { GoodreadsBookDetails, BookTypeItem } from "@/types/quiz";
import { getBookMainTypes, DEFAULT_REPO_BOOK_TYPES } from "@/lib/utils";

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
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [authorGoodreadsUrl, setAuthorGoodreadsUrl] = useState("");
  const [mainType1, setMainType1] = useState("Nonfiction");
  const [mainType2, setMainType2] = useState("Biography");
  const [description, setDescription] = useState("");
  const [coverUrl, setCoverUrl] = useState(DEFAULT_COURSE_BANNER);
  const [rating, setRating] = useState<number | undefined>();
  const [pageCount, setPageCount] = useState<number | undefined>();
  const [publishedYear, setPublishedYear] = useState<string | undefined>();
  const [isbn, setIsbn] = useState<string | undefined>();

  // Repo Types of Book state & CRUD
  const [repoTypes, setRepoTypes] = useState<BookTypeItem[]>(() =>
    DEFAULT_REPO_BOOK_TYPES.map((name) => ({
      id: name.toLowerCase().replace(/\s+/g, "-"),
      name,
      category:
        name.toLowerCase() === "nonfiction" || name.toLowerCase() === "fiction"
          ? "broad"
          : "genre",
    }))
  );
  const [showTypeCrud, setShowTypeCrud] = useState(true);
  const [newTypeName, setNewTypeName] = useState("");
  const [isCreatingType, setIsCreatingType] = useState(false);
  const [editingTypeId, setEditingTypeId] = useState<string | null>(null);
  const [editingTypeName, setEditingTypeName] = useState("");

  const [isFetchingGoodreads, setIsFetchingGoodreads] = useState(false);
  const [goodreadsSuccess, setGoodreadsSuccess] = useState(false);
  const [isResolvingDrive, setIsResolvingDrive] = useState(false);
  const [detectedDriveName, setDetectedDriveName] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch types of book from repo on mount / open
  useEffect(() => {
    if (!isOpen) return;
    let isCancelled = false;
    getBookTypes()
      .then((types) => {
        if (!isCancelled && types && types.length > 0) {
          setRepoTypes(types);
        }
      })
      .catch(() => {});
    return () => {
      isCancelled = true;
    };
  }, [isOpen]);

  // Derived repo types: broad and genres
  const broadTypes = repoTypes.filter(
    (t) =>
      t.category === "broad" ||
      t.name.toLowerCase() === "nonfiction" ||
      t.name.toLowerCase() === "fiction"
  );
  const genreTypes = repoTypes.filter(
    (t) =>
      t.category !== "broad" &&
      t.name.toLowerCase() !== "nonfiction" &&
      t.name.toLowerCase() !== "fiction"
  );

  // Set initial default selections if not already set
  useEffect(() => {
    if (isOpen) {
      if (!mainType1) setMainType1("Nonfiction");
      if (!mainType2 && genreTypes.length > 0) {
        setMainType2(genreTypes[0].name);
      }
    }
  }, [isOpen, genreTypes, mainType1, mainType2]);

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

      // Only match types of books that exist in repo types of book
      const repoGenreNames = repoTypes.map((t) => t.name);
      const [broadType, firstGenre] = getBookMainTypes(
        {
          title: data.title,
          genres: data.genres,
          main_type: data.mainType,
        },
        repoGenreNames
      );
      setMainType1(broadType);
      setMainType2(firstGenre);

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
    setGoodreadsUrl("https://www.goodreads.com/book/show/223400731-the-optimist");
    setTitle("The Optimist: Sam Altman, OpenAI, and the Race to Invent the Future");
    setAuthor("Keach Hagey");
    setAuthorGoodreadsUrl("https://www.goodreads.com/author/show/16995547.Keach_Hagey");
    setMainType1("Nonfiction");
    setMainType2("Biography");
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

  // CRUD Handler: Create Book Type in Repo
  const handleCreateType = async () => {
    const trimmed = newTypeName.trim();
    if (!trimmed) return;
    setIsCreatingType(true);
    try {
      const created = await createBookType(trimmed);
      setRepoTypes((prev) => {
        if (prev.some((t) => t.id === created.id || t.name.toLowerCase() === created.name.toLowerCase())) {
          return prev;
        }
        return [...prev, created];
      });
      setMainType2(created.name);
      setNewTypeName("");
    } catch (err: any) {
      setError(err.message || "Failed to create book type");
    } finally {
      setIsCreatingType(false);
    }
  };

  // CRUD Handler: Update Book Type in Repo
  const handleUpdateType = async (typeId: string) => {
    const trimmed = editingTypeName.trim();
    if (!trimmed) return;
    try {
      const updated = await updateBookType(typeId, trimmed);
      setRepoTypes((prev) =>
        prev.map((t) => (t.id === typeId ? { ...t, name: updated.name } : t))
      );
      if (mainType2.toLowerCase() === editingTypeName.toLowerCase() || repoTypes.find(t => t.id === typeId)?.name === mainType2) {
        setMainType2(updated.name);
      }
      setEditingTypeId(null);
    } catch (err: any) {
      setError(err.message || "Failed to update book type");
    }
  };

  // CRUD Handler: Delete Book Type from Repo
  const handleDeleteType = async (typeId: string, typeName: string) => {
    try {
      await deleteBookType(typeId);
      setRepoTypes((prev) => prev.filter((t) => t.id !== typeId));
      if (mainType2.toLowerCase() === typeName.toLowerCase()) {
        const remaining = repoTypes.filter((t) => t.id !== typeId && t.category !== "broad");
        setMainType2(remaining[0]?.name || "Biography");
      }
    } catch (err: any) {
      setError(err.message || "Failed to delete book type");
    }
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
      ? `https://drive.google.com/drive/folders/${folderId}`
      : undefined;

    setIsSubmitting(true);
    try {
      const newBook = await onCreateCourse({
        title: trimmedTitle,
        author: author.trim() || undefined,
        author_goodreads_url: authorGoodreadsUrl.trim() || (author.trim().toLowerCase().includes('keach') ? 'https://www.goodreads.com/author/show/16995547.Keach_Hagey' : undefined),
        main_type: [mainType1.trim(), mainType2.trim()].filter(Boolean).join(" & ") || undefined,
        genres: [mainType1.trim(), mainType2.trim()].filter(Boolean).length > 0 ? [mainType1.trim(), mainType2.trim()].filter(Boolean) : undefined,
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
        if (e.target === e.currentTarget && !isSubmitting) onClose();
      }}
    >
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-[#1b1b1b] border border-[#2f2f2f] rounded-2xl shadow-2xl text-white p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#2e2e2e] pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center border border-purple-500/30">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Import Book into Library</h2>
              <p className="text-xs text-gray-400">
                Add a new book, fetch Goodreads details, and link Google Drive chapters.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-[#282828] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Sample Button */}
        <div className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-purple-950/20 border border-purple-500/30">
          <div className="flex items-center gap-2 text-xs text-purple-200">
            <Sparkles className="w-4 h-4 text-purple-400 shrink-0" />
            <span>Want to test quickly? Fill the sample book data:</span>
          </div>
          <button
            type="button"
            onClick={handleQuickFillOptimistSample}
            className="px-3 py-1 rounded-lg text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-white transition-colors cursor-pointer shrink-0"
          >
            Fill "The Optimist" Sample
          </button>
        </div>

        {/* Book Types Summary & Quick CRUD Toggle */}
        <div className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-[#222222] border border-[#333333]">
          <div className="flex items-center gap-2 text-xs">
            <Tag className="w-4 h-4 text-purple-400 shrink-0" />
            <span className="text-gray-300">Repo Types of Book:</span>
            <span className="font-semibold text-purple-300">
              {repoTypes.length} types in repo
            </span>
            <span className="text-gray-500">•</span>
            <span className="text-gray-400">Current:</span>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-purple-500/20 text-purple-300">
              {mainType1} & {mainType2}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setShowTypeCrud(!showTypeCrud)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 border border-purple-500/40 transition-colors cursor-pointer"
          >
            <Settings2 className="w-3.5 h-3.5" />
            <span>{showTypeCrud ? "Hide CRUD Types" : "CRUD Types of Books"}</span>
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-red-950/40 border border-red-500/40 text-xs text-red-200">
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

              {/* Types of Book Section (Repo Types of Book & CRUD) */}
              <div className="p-3 rounded-xl bg-[#202020] border border-[#303030] space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-purple-400 flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5" />
                    <span>Types of Book (Repo Types)</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowTypeCrud(!showTypeCrud)}
                    className="flex items-center gap-1 text-[11px] font-medium text-purple-300 hover:text-purple-200 hover:underline cursor-pointer"
                  >
                    <Settings2 className="w-3 h-3" />
                    <span>{showTypeCrud ? "Hide Manage Types" : "Manage / CRUD Types"}</span>
                  </button>
                </div>

                {/* 2 Main Types Selectors: Strictly from Repo Types of Book */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-semibold text-gray-300 block mb-1">
                      Main Type 1 (Broad)
                    </label>
                    <select
                      value={mainType1}
                      onChange={(e) => setMainType1(e.target.value)}
                      className="w-full bg-[#161616] border border-[#3e3e3e] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-400 transition-colors cursor-pointer"
                    >
                      {broadTypes.map((t) => (
                        <option key={t.id || t.name} value={t.name}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-gray-300 block mb-1">
                      Main Type 2 (Repo Genre)
                    </label>
                    <select
                      value={mainType2}
                      onChange={(e) => setMainType2(e.target.value)}
                      className="w-full bg-[#161616] border border-[#3e3e3e] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-400 transition-colors cursor-pointer"
                    >
                      {genreTypes.map((t) => (
                        <option key={t.id || t.name} value={t.name}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Quick Genre Selection Pills (Only show types of books in repo types of book) */}
                <div className="space-y-1">
                  <span className="text-[10px] text-gray-400 block font-medium">Select from repo types of book:</span>
                  <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
                    {genreTypes.map((t) => {
                      const isSelected = mainType2.toLowerCase() === t.name.toLowerCase();
                      return (
                        <button
                          key={t.id || t.name}
                          type="button"
                          onClick={() => setMainType2(t.name)}
                          className={`px-2 py-0.5 rounded-full text-[11px] font-medium transition-all cursor-pointer ${
                            isSelected
                              ? "bg-purple-600 text-white border border-purple-400 shadow-sm"
                              : "bg-[#2a2a2a] text-gray-300 border border-white/5 hover:bg-[#333333] hover:text-white"
                          }`}
                        >
                          {t.name}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Collapsible CRUD Panel for Repo Types of Book */}
                {showTypeCrud && (
                  <div className="pt-2 border-t border-[#333333] space-y-3">
                    <div className="flex items-center justify-between text-xs font-semibold text-gray-300">
                      <span>CRUD Types of Book in Repo</span>
                      <span className="text-[10px] text-gray-400">{repoTypes.length} types in repo</span>
                    </div>

                    {/* Create New Type */}
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newTypeName}
                        onChange={(e) => setNewTypeName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleCreateType();
                          }
                        }}
                        placeholder="Add new book type to repo..."
                        className="flex-1 bg-[#161616] border border-[#3e3e3e] rounded-xl px-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-purple-400 transition-colors"
                      />
                      <button
                        type="button"
                        onClick={handleCreateType}
                        disabled={isCreatingType || !newTypeName.trim()}
                        className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-white transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1 shrink-0"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add Type</span>
                      </button>
                    </div>

                    {/* Read, Update & Delete list */}
                    <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                      {repoTypes.map((t) => (
                        <div
                          key={t.id}
                          className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-[#181818] border border-[#2b2b2b] text-xs"
                        >
                          {editingTypeId === t.id ? (
                            <div className="flex items-center gap-1.5 flex-1 mr-2">
                              <input
                                type="text"
                                value={editingTypeName}
                                onChange={(e) => setEditingTypeName(e.target.value)}
                                className="flex-1 bg-[#252525] border border-purple-500 rounded px-2 py-0.5 text-xs text-white focus:outline-none"
                                autoFocus
                              />
                              <button
                                type="button"
                                onClick={() => handleUpdateType(t.id)}
                                className="p-1 text-emerald-400 hover:text-emerald-300 cursor-pointer"
                                title="Save"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingTypeId(null)}
                                className="p-1 text-gray-400 hover:text-white cursor-pointer"
                                title="Cancel"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <>
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-gray-200">{t.name}</span>
                                <span className="text-[9px] uppercase px-1.5 py-0.2 rounded bg-[#2a2a2a] text-gray-400">
                                  {t.category === "broad" ? "broad" : "genre"}
                                </span>
                              </div>
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingTypeId(t.id);
                                    setEditingTypeName(t.name);
                                  }}
                                  className="p-1 text-gray-400 hover:text-white rounded hover:bg-[#2c2c2c] transition-colors cursor-pointer"
                                  title="Edit type name"
                                >
                                  <Edit2 className="w-3 h-3" />
                                </button>
                                {t.name !== "Nonfiction" && t.name !== "Fiction" && (
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteType(t.id, t.name)}
                                    className="p-1 text-red-400 hover:text-red-300 rounded hover:bg-red-500/10 transition-colors cursor-pointer"
                                    title="Delete type from repo"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
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
