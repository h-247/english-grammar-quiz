"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  BookOpen,
  Plus,
  HardDrive,
  LogOut,
  User,
  Settings,
  Search,
  RefreshCw,
  Tag,
  Bookmark,
  X,
  PanelLeft,
  PanelLeftClose,
  Link2,
  ExternalLink,
  Pencil,
  ChevronRight,
  ArrowLeft,
  SquarePen,
} from "lucide-react";
import { DEFAULT_PROMPT_CHAT_URL } from "@/lib/course-manifest";
import { EditPromptChatModal } from "@/components/EditPromptChatModal";
import { SettingsModal } from "@/components/SettingsModal";
import { getSettings } from "@/lib/api";

export interface SidebarProps {
  // Books / Filter controls (moved from Photo 5)
  booksCount?: number;
  searchQuery?: string;
  onSearchChange?: (q: string) => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  onOpenManageGenres?: () => void;
  onOpenImportBook?: () => void;
  onOpenImportCourse?: () => void; // alias
  selectedStatus?: "all" | "To do" | "Doing" | "Done";
  onSelectStatus?: (status: "all" | "To do" | "Doing" | "Done") => void;
  statusCounts?: { all: number; todo: number; doing: number; done: number };
  selectedGenre?: string;
  onSelectGenre?: (genre: string) => void;
  availableGenres?: string[];
  genreCounts?: Record<string, number>;

  // Circle icons data (Photo 3 & 4)
  driveConnected?: boolean;
  userEmail?: string;
  promptChatUrl?: string;
  onPromptChatUrlChange?: (newUrl: string) => void;

  // Sidebar collapse
  isOpen?: boolean;
  onToggle?: () => void;
  isCollapsible?: boolean;
}

export function Sidebar({
  booksCount,
  searchQuery = "",
  onSearchChange,
  onRefresh,
  isRefreshing = false,
  onOpenManageGenres,
  onOpenImportBook,
  onOpenImportCourse,
  selectedStatus = "all",
  onSelectStatus,
  statusCounts = { all: 0, todo: 0, doing: 0, done: 0 },
  selectedGenre = "all",
  onSelectGenre,
  availableGenres = [],
  genreCounts = {},
  driveConnected = true,
  userEmail: propUserEmail,
  promptChatUrl: propPromptChatUrl,
  onPromptChatUrlChange,
  isOpen: propIsOpen,
  onToggle: propOnToggle,
}: SidebarProps) {
  const [internalIsOpen, setInternalIsOpen] = useState<boolean>(true);
  const isOpen = propOnToggle !== undefined ? (propIsOpen ?? true) : internalIsOpen;
  const onToggle = propOnToggle || (() => setInternalIsOpen((prev) => !prev));

  const [currentUserEmail, setCurrentUserEmail] = useState<string>(
    propUserEmail || "local-user@chatgpt.internal"
  );
  const [activePromptChatUrl, setActivePromptChatUrl] = useState<string>(
    propPromptChatUrl || DEFAULT_PROMPT_CHAT_URL
  );
  const [isEditPromptOpen, setIsEditPromptOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [showUserPopover, setShowUserPopover] = useState(false);

  const userPopoverRef = useRef<HTMLDivElement>(null);

  const handleOpenImport = onOpenImportBook || onOpenImportCourse;

  // Compute 2-character avatar initials (matching ChatGPT collapsed style e.g. "LO")
  const userInitial = (
    currentUserEmail.includes("@")
      ? currentUserEmail.split("@")[0]
      : currentUserEmail
  )
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 2)
    .toUpperCase() || "LO";

  // Fetch or sync user email
  useEffect(() => {
    if (propUserEmail) {
      setCurrentUserEmail(propUserEmail);
    } else {
      fetch("/api/auth/me")
        .then((res) => res.json())
        .then((data: any) => {
          if (data?.email) {
            setCurrentUserEmail(data.email);
          } else if (data?.userId) {
            setCurrentUserEmail(data.userId);
          }
        })
        .catch(() => {});
    }
  }, [propUserEmail]);

  // Sync prompt URL
  useEffect(() => {
    if (propPromptChatUrl) {
      setActivePromptChatUrl(propPromptChatUrl);
    }
  }, [propPromptChatUrl]);

  // Load initial prompt url from backend & storage
  useEffect(() => {
    const cached = localStorage.getItem("prompt_chat_url");
    if (cached) {
      setActivePromptChatUrl(cached);
      onPromptChatUrlChange?.(cached);
    }

    getSettings()
      .then((res) => {
        if (res.prompt_chat_url) {
          setActivePromptChatUrl(res.prompt_chat_url);
          localStorage.setItem("prompt_chat_url", res.prompt_chat_url);
          onPromptChatUrlChange?.(res.prompt_chat_url);
        }
      })
      .catch(() => {});
  }, [onPromptChatUrlChange]);

  const handleSavePromptChatUrl = (newUrl: string) => {
    setActivePromptChatUrl(newUrl);
    localStorage.setItem("prompt_chat_url", newUrl);
    onPromptChatUrlChange?.(newUrl);
  };

  // Close popover when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        userPopoverRef.current &&
        !userPopoverRef.current.contains(e.target as Node)
      ) {
        setShowUserPopover(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const isMainDashboard = Boolean(onSelectStatus || onSelectGenre);

  // Common User Menu Popover (Gộp Drive, Prompt Link, Settings, Sign out)
  const renderUserMenuPopover = (isCollapsedMode = false) => (
    <div
      className={`absolute ${
        isCollapsedMode
          ? "bottom-2 left-12 w-72"
          : "bottom-full left-2 right-2 mb-2"
      } p-2 rounded-2xl bg-[#1e1e1e] border border-[#333333] shadow-2xl z-50 animate-in fade-in zoom-in-95 space-y-1.5`}
    >
      {/* Account Header */}
      <div className="flex items-center gap-3 p-2 rounded-xl bg-[#252525] border border-[#333333]">
        <div className="w-8 h-8 rounded-full bg-[#e65100] text-white flex items-center justify-center text-xs font-bold shrink-0 shadow-sm border border-amber-600/50">
          {userInitial}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">
            Account
          </p>
          <p
            className="text-xs font-mono text-white truncate"
            title={currentUserEmail}
          >
            {currentUserEmail}
          </p>
        </div>
      </div>

      {/* Merged Section 1: Google Drive */}
      <button
        type="button"
        onClick={() => {
          setShowUserPopover(false);
          setIsSettingsOpen(true);
        }}
        className="w-full flex items-center justify-between p-2 rounded-xl text-xs text-gray-200 hover:text-white hover:bg-[#282828] transition-colors cursor-pointer group"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-[#252525] flex items-center justify-center text-blue-400 border border-[#383838]">
            <HardDrive className="w-3.5 h-3.5" />
          </div>
          <span className="font-medium">Google Drive</span>
        </div>
        <span className="flex items-center gap-1.5 text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          {driveConnected ? "Connected" : "Offline"}
        </span>
      </button>

      {/* Merged Section 2: ChatGPT Prompt Link */}
      <div className="p-1 rounded-xl bg-[#242424]/80 border border-[#2e2e2e] space-y-1">
        <div className="flex items-center justify-between px-2 pt-1 text-xs font-medium text-emerald-400">
          <span className="flex items-center gap-1.5">
            <Link2 className="w-3.5 h-3.5" />
            <span>Prompt in ChatGPT</span>
          </span>
          <button
            type="button"
            onClick={() => {
              setShowUserPopover(false);
              setIsEditPromptOpen(true);
            }}
            title="Edit Prompt URL"
            className="p-1 text-gray-400 hover:text-amber-300 rounded hover:bg-[#303030] transition-colors cursor-pointer"
          >
            <Pencil className="w-3 h-3" />
          </button>
        </div>
        <a
          href={activePromptChatUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => setShowUserPopover(false)}
          className="flex items-center justify-between px-2 py-1.5 rounded-lg text-xs text-gray-300 hover:text-white hover:bg-[#2c2c2c] transition-colors cursor-pointer"
        >
          <span className="truncate text-[11px] text-gray-400 font-mono">
            {activePromptChatUrl}
          </span>
          <ExternalLink className="w-3 h-3 text-emerald-400 shrink-0 ml-1.5" />
        </a>
      </div>

      {/* Merged Section 3: Settings */}
      <button
        type="button"
        onClick={() => {
          setShowUserPopover(false);
          setIsSettingsOpen(true);
        }}
        className="w-full flex items-center justify-between p-2 rounded-xl text-xs text-gray-200 hover:text-white hover:bg-[#282828] transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-[#252525] flex items-center justify-center text-gray-300 border border-[#383838]">
            <Settings className="w-3.5 h-3.5" />
          </div>
          <span className="font-medium">Settings & Drive Config</span>
        </div>
        <ChevronRight className="w-3.5 h-3.5 text-gray-500" />
      </button>

      {/* Divider */}
      <div className="border-t border-[#2e2e2e] my-1" />

      {/* Merged Section 4: Sign out */}
      <a
        href="/signout-with-chatgpt"
        className="w-full flex items-center gap-2.5 p-2 rounded-xl text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors cursor-pointer"
      >
        <div className="w-7 h-7 rounded-lg bg-red-500/10 flex items-center justify-center text-red-400 border border-red-500/20">
          <LogOut className="w-3.5 h-3.5" />
        </div>
        <span className="font-semibold">Sign out</span>
      </a>
    </div>
  );

  return (
    <>
      {/* Mobile Backdrop when expanded */}
      {isOpen && (
        <div
          onClick={onToggle}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`sticky top-0 left-0 z-50 h-screen bg-[#171717] border-r border-[#262626] flex flex-col justify-between transition-all duration-200 select-none shrink-0 ${
          isOpen ? "w-72 sm:w-68" : "w-14"
        }`}
        suppressHydrationWarning
      >
        {isOpen ? (
          /* ==============================================================
             EXPANDED SIDEBAR (ChatGPT Style)
             ============================================================== */
          <>
            {/* Top & Middle Section */}
            <div className="flex-1 flex flex-col min-h-0 p-3 space-y-3">
              {/* Header Row: Title Books, Count Badge, Refresh, Sidebar Collapse */}
              <div className="flex items-center justify-between pb-1 pt-1 px-1">
                <div className="flex items-center gap-2">
                  <h1 className="text-base font-bold text-white tracking-tight">
                    Books
                  </h1>
                  {booksCount !== undefined && (
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#262626] text-gray-300 border border-[#383838]">
                      {booksCount}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  {onRefresh && (
                    <button
                      type="button"
                      onClick={onRefresh}
                      disabled={isRefreshing}
                      title="Refresh books"
                      className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-[#252525] transition-colors cursor-pointer disabled:opacity-50"
                    >
                      <RefreshCw
                        className={`w-3.5 h-3.5 ${
                          isRefreshing ? "animate-spin text-blue-400" : ""
                        }`}
                      />
                    </button>
                  )}

                  {onToggle && (
                    <button
                      type="button"
                      onClick={onToggle}
                      title="Close sidebar"
                      className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-[#252525] transition-colors cursor-pointer"
                    >
                      <PanelLeftClose className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {isMainDashboard ? (
                <>
                  {/* Primary Action Button: + Import Book (ChatGPT "New chat" style) */}
                  {handleOpenImport && (
                    <button
                      type="button"
                      onClick={handleOpenImport}
                      className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-white text-black font-semibold text-xs hover:bg-neutral-200 transition-all shadow-sm cursor-pointer active:scale-98"
                    >
                      <Plus className="w-4 h-4 text-black stroke-[2.5]" />
                      <span>Import Book</span>
                    </button>
                  )}

                  {/* Search Bar */}
                  {onSearchChange && (
                    <div className="relative w-full">
                      <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => onSearchChange(e.target.value)}
                        placeholder="Search books by title, author..."
                        className="w-full bg-[#1e1e1e] border border-[#303030] rounded-xl pl-8 pr-7 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-white transition-colors"
                      />
                      {searchQuery && (
                        <button
                          type="button"
                          onClick={() => onSearchChange("")}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  )}

                  {/* Genres of Book Management Button */}
                  {onOpenManageGenres && (
                    <button
                      type="button"
                      onClick={onOpenManageGenres}
                      title="CRUD Genres of Books (Add, Edit, Delete genres in repo)"
                      className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold bg-[#222222] text-purple-300 hover:text-white hover:bg-[#2c2c2c] border border-purple-500/25 transition-all cursor-pointer"
                    >
                      <span className="flex items-center gap-2">
                        <Tag className="w-3.5 h-3.5 text-purple-400" />
                        <span>Genres of Book</span>
                      </span>
                      <ChevronRight className="w-3.5 h-3.5 text-purple-400/60" />
                    </button>
                  )}

                  {/* Scrollable Filters Section (Status & Genres) */}
                  <div className="flex-1 overflow-y-auto space-y-4 pr-1 scrollbar-thin">
                    {/* Status Filter */}
                    {onSelectStatus && (
                      <div className="space-y-1.5 pt-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 px-1">
                          Status
                        </span>
                        <div className="space-y-1">
                          {(
                            [
                              {
                                key: "all",
                                label: "All Statuses",
                                count: statusCounts.all,
                              },
                              {
                                key: "To do",
                                label: "To do",
                                count: statusCounts.todo,
                              },
                              {
                                key: "Doing",
                                label: "Doing",
                                count: statusCounts.doing,
                              },
                              {
                                key: "Done",
                                label: "Done",
                                count: statusCounts.done,
                              },
                            ] as const
                          ).map((tab) => (
                            <button
                              key={tab.key}
                              type="button"
                              onClick={() => onSelectStatus(tab.key)}
                              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                                selectedStatus === tab.key
                                  ? "bg-white text-black font-semibold shadow-sm"
                                  : "bg-[#1f1f1f] text-gray-400 hover:text-white hover:bg-[#282828] border border-white/5"
                              }`}
                            >
                              <span>{tab.label}</span>
                              <span
                                className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                                  selectedStatus === tab.key
                                    ? "bg-neutral-200 text-black font-bold"
                                    : "bg-[#2c2c2c] text-gray-400"
                                }`}
                              >
                                {tab.count}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Genre Filter */}
                    {onSelectGenre && (
                      <div className="space-y-1.5 pt-2 border-t border-[#262626]">
                        <div className="flex items-center justify-between px-1">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-purple-300 flex items-center gap-1">
                            <Bookmark className="w-3 h-3 text-purple-400" />
                            <span>Genre</span>
                          </span>
                          {onOpenManageGenres && (
                            <button
                              type="button"
                              onClick={onOpenManageGenres}
                              className="text-[10px] font-semibold text-purple-300 hover:text-white flex items-center gap-0.5 cursor-pointer"
                            >
                              <Plus className="w-2.5 h-2.5" />
                              <span>Add</span>
                            </button>
                          )}
                        </div>

                        <div className="space-y-1">
                          {/* All Genres */}
                          <button
                            type="button"
                            onClick={() => onSelectGenre("all")}
                            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                              selectedGenre === "all"
                                ? "bg-purple-600 text-white font-semibold shadow-sm"
                                : "bg-[#1f1f1f] text-purple-300 hover:text-white hover:bg-[#282828] border border-purple-500/20"
                            }`}
                          >
                            <span>All Genres</span>
                            <span
                              className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                                selectedGenre === "all"
                                  ? "bg-purple-700 text-white font-bold"
                                  : "bg-[#2a2a2a] text-purple-300"
                              }`}
                            >
                              {genreCounts.all || booksCount || 0}
                            </span>
                          </button>

                          {/* Dynamic Available Genres */}
                          {availableGenres.map((genre) => (
                            <button
                              key={genre}
                              type="button"
                              onClick={() =>
                                onSelectGenre(
                                  selectedGenre === genre ? "all" : genre
                                )
                              }
                              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                                selectedGenre === genre
                                  ? "bg-purple-600 text-white font-semibold shadow-sm"
                                  : "bg-[#1f1f1f] text-purple-300 hover:text-white hover:bg-[#282828] border border-purple-500/20"
                              }`}
                            >
                              <span className="truncate">{genre}</span>
                              <span
                                className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                                  selectedGenre === genre
                                    ? "bg-purple-700 text-white font-bold"
                                    : "bg-[#2a2a2a] text-purple-300"
                                }`}
                              >
                                {genreCounts[genre] || 0}
                              </span>
                            </button>
                          ))}

                          {/* + Add / Manage Genres Button */}
                          {onOpenManageGenres && (
                            <button
                              type="button"
                              onClick={onOpenManageGenres}
                              className="w-full flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-lg text-xs font-semibold bg-purple-500/15 text-purple-200 hover:bg-purple-500/25 border border-purple-500/30 transition-colors cursor-pointer mt-1"
                            >
                              <Plus className="w-3 h-3 text-purple-300" />
                              <span>+ Add / Manage Genres</span>
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                /* Subpage Navigation (e.g. Chapter / Quiz pages) */
                <div className="flex-1 flex flex-col justify-start space-y-3 pt-2">
                  <Link
                    href="/"
                    className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold bg-[#222222] text-gray-300 hover:text-white hover:bg-[#2c2c2c] border border-[#333333] transition-colors"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Back to Books</span>
                  </Link>
                </div>
              )}
            </div>

            {/* Bottom Section: Gộp Drive, Prompt Link, Settings into bottom-most User Avatar icon */}
            <div className="p-2.5 border-t border-[#262626] bg-[#141414] relative" ref={userPopoverRef}>
              <button
                type="button"
                onClick={() => setShowUserPopover(!showUserPopover)}
                className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-[#222222] transition-colors cursor-pointer group"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-[#e65100] text-white flex items-center justify-center text-xs font-bold shrink-0 shadow-sm border border-amber-600/50">
                    {userInitial}
                  </div>
                  <div className="min-w-0 flex-1 text-left">
                    <p className="text-xs font-medium text-white truncate" title={currentUserEmail}>
                      {currentUserEmail}
                    </p>
                    <div className="flex items-center gap-1.5 text-[10px] text-gray-400">
                      <span className={`w-1.5 h-1.5 rounded-full ${driveConnected ? "bg-emerald-400 animate-pulse" : "bg-gray-500"}`} />
                      <span>Drive: {driveConnected ? "Connected" : "Offline"}</span>
                    </div>
                  </div>
                </div>
                <Settings className="w-4 h-4 text-gray-500 group-hover:text-gray-300 transition-colors shrink-0" />
              </button>

              {/* Popover Menu containing Drive, Prompt Link, Settings, Sign out */}
              {showUserPopover && renderUserMenuPopover(false)}
            </div>
          </>
        ) : (
          /* ==============================================================
             COLLAPSED SIDEBAR (Narrow Rail matching ChatGPT screenshot)
             ============================================================== */
          <>
            {/* Top Icons in Collapsed Rail */}
            <div className="flex flex-col items-center gap-2 w-full pt-2 px-1">
              {/* Sidebar Open Toggle Button */}
              <button
                type="button"
                onClick={onToggle}
                title="Open sidebar"
                className="w-10 h-10 rounded-xl text-gray-400 hover:text-white hover:bg-[#252525] flex items-center justify-center transition-colors cursor-pointer"
              >
                <PanelLeft className="w-5 h-5" />
              </button>

              {/* Import / New Book (SquarePen icon as in ChatGPT) */}
              {handleOpenImport && (
                <button
                  type="button"
                  onClick={handleOpenImport}
                  title="Import Book"
                  className="w-10 h-10 rounded-xl text-gray-400 hover:text-white hover:bg-[#252525] flex items-center justify-center transition-colors cursor-pointer"
                >
                  <SquarePen className="w-4 h-4" />
                </button>
              )}

              {/* Search Icon (Expands sidebar & focuses search) */}
              {onSearchChange && (
                <button
                  type="button"
                  onClick={onToggle}
                  title="Search books"
                  className="w-10 h-10 rounded-xl text-gray-400 hover:text-white hover:bg-[#252525] flex items-center justify-center transition-colors cursor-pointer"
                >
                  <Search className="w-4 h-4" />
                </button>
              )}

              {/* Genres of Book Icon */}
              {onOpenManageGenres && (
                <button
                  type="button"
                  onClick={onOpenManageGenres}
                  title="CRUD Genres of Books"
                  className="w-10 h-10 rounded-xl text-purple-400 hover:text-purple-300 hover:bg-[#252525] flex items-center justify-center transition-colors cursor-pointer"
                >
                  <Tag className="w-4 h-4" />
                </button>
              )}

              {/* Book Library Link */}
              <Link
                href="/"
                title="Book Library"
                className="w-10 h-10 rounded-xl text-gray-400 hover:text-white hover:bg-[#252525] flex items-center justify-center transition-colors cursor-pointer"
              >
                <BookOpen className="w-4 h-4" />
              </Link>
            </div>

            {/* Bottom Icon in Collapsed Rail: ONLY the User Avatar ("LO")! Gộp all sections into this icon! */}
            <div className="flex flex-col items-center w-full pb-3 px-1 relative" ref={userPopoverRef}>
              <button
                type="button"
                onClick={() => setShowUserPopover(!showUserPopover)}
                title={currentUserEmail}
                className="w-8 h-8 rounded-full bg-[#e65100] hover:bg-[#f57c00] text-white flex items-center justify-center text-[10px] font-bold transition-all cursor-pointer shadow-sm border border-amber-600/50"
              >
                {userInitial}
              </button>

              {/* Popover Menu containing Drive, Prompt Link, Settings, Sign out */}
              {showUserPopover && renderUserMenuPopover(true)}
            </div>
          </>
        )}
      </aside>

      {/* Edit Prompt Chat Link Modal */}
      <EditPromptChatModal
        isOpen={isEditPromptOpen}
        onClose={() => setIsEditPromptOpen(false)}
        currentUrl={activePromptChatUrl}
        onSave={handleSavePromptChatUrl}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onSettingsSaved={() => {
          getSettings()
            .then((s) => {
              if (s.prompt_chat_url) handleSavePromptChatUrl(s.prompt_chat_url);
            })
            .catch(() => {});
        }}
      />
    </>
  );
}
