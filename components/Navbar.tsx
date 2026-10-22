"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  GraduationCap,
  History,
  Plus,
  HardDrive,
  LogOut,
  User,
  ClipboardPaste,
  Sparkles,
  ExternalLink,
  Pencil,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { DEFAULT_PROMPT_CHAT_URL } from "@/lib/course-manifest";
import { EditPromptChatModal } from "@/components/EditPromptChatModal";
import { getSettings } from "@/lib/api";

interface NavbarProps {
  onOpenImportCourse?: () => void;
  onOpenImportQuiz?: () => void;
  userEmail?: string;
  driveConnected?: boolean;
  promptChatUrl?: string;
  onPromptChatUrlChange?: (newUrl: string) => void;
}

function NavLinks({
  onOpenImportCourse,
  onOpenImportQuiz,
  userEmail: propUserEmail,
  driveConnected = true,
  promptChatUrl: propPromptChatUrl,
  onPromptChatUrlChange,
}: NavbarProps) {
  const pathname = usePathname();
  const [currentUserEmail, setCurrentUserEmail] = useState<string>(
    propUserEmail || "local-user"
  );
  const [activePromptChatUrl, setActivePromptChatUrl] = useState<string>(
    propPromptChatUrl || DEFAULT_PROMPT_CHAT_URL
  );
  const [isEditPromptOpen, setIsEditPromptOpen] = useState(false);

  // Sync user email or fetch from /api/auth/me
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

  // Sync with prop if it changes
  useEffect(() => {
    if (propPromptChatUrl) {
      setActivePromptChatUrl(propPromptChatUrl);
    }
  }, [propPromptChatUrl]);

  // Fetch initial setting from backend & localStorage
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

  return (
    <div className="flex items-center gap-2.5 sm:gap-3" suppressHydrationWarning>
      {/* Prompt Chat Link with Edit Button (For all courses) */}
      <div className="flex items-center rounded-xl bg-[#1a291e] border border-emerald-900/40 p-0.5 shadow-sm">
        <a
          href={activePromptChatUrl}
          target="_blank"
          rel="noreferrer"
          title="Open ChatGPT Prompt Chat (for all courses)"
          className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition-colors"
        >
          <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
          <span className="inline">Prompt Chat</span>
          <ExternalLink className="w-3 h-3 text-emerald-500/70" />
        </a>

        {/* Edit Prompt Chat Link Button */}
        <button
          type="button"
          onClick={() => setIsEditPromptOpen(true)}
          title="Edit Prompt Chat URL"
          className="p-1.5 text-emerald-500/70 hover:text-emerald-300 hover:bg-[#223627] rounded-lg transition-colors cursor-pointer border-l border-emerald-900/40"
        >
          <Pencil className="w-3 h-3" />
        </button>
      </div>

      {/* Drive Status Indicator */}
      <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#1e1e1e] text-[#a3a3a3] border border-[#333333]">
        <HardDrive className="w-3.5 h-3.5 text-blue-400" />
        <span>Drive:</span>
        <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          {driveConnected ? "Connected" : "Offline"}
        </span>
      </div>

      {/* History Link */}
      <Link
        href="/history"
        className={cn(
          "flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
          pathname === "/history"
            ? "bg-[#2b2b2b] text-[#ECECEC] border border-[#3e3e3e]"
            : "text-[#9CA3AF] hover:text-[#ECECEC] hover:bg-[#262626]/70"
        )}
      >
        <History className="w-4 h-4" />
        <span className="hidden md:inline">History</span>
      </Link>

      {/* Optional Paste Quiz Button */}
      {onOpenImportQuiz && (
        <button
          onClick={onOpenImportQuiz}
          className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#2a2a2a] text-[#ECECEC] border border-[#3a3a3a] hover:bg-[#333333] transition-colors cursor-pointer"
        >
          <ClipboardPaste className="w-3.5 h-3.5 text-emerald-400" />
          <span>Paste Quiz</span>
        </button>
      )}

      {/* + Import Course (White prominent button) */}
      {onOpenImportCourse && (
        <button
          onClick={onOpenImportCourse}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm font-semibold bg-white text-black hover:bg-neutral-200 transition-all shadow-sm cursor-pointer active:scale-95"
        >
          <Plus className="w-4 h-4 text-black stroke-[2.5]" />
          <span>Import Course</span>
        </button>
      )}

      {/* User email pill */}
      <div className="flex items-center gap-2 pl-2 border-l border-[#333333]">
        <div className="flex items-center gap-1.5 text-xs text-[#9CA3AF] hover:text-[#ECECEC] transition-colors py-1 px-1.5 rounded-md">
          <User className="w-3.5 h-3.5 text-gray-400" />
          <span className="hidden xl:inline font-mono">{currentUserEmail}</span>
          <a
            href="/signout-with-chatgpt"
            title="Sign out"
            className="flex items-center"
          >
            <LogOut className="w-3.5 h-3.5 ml-0.5 text-gray-500 hover:text-red-400 cursor-pointer" />
          </a>
        </div>
      </div>

      {/* Edit Prompt Chat Link Modal */}
      <EditPromptChatModal
        isOpen={isEditPromptOpen}
        onClose={() => setIsEditPromptOpen(false)}
        currentUrl={activePromptChatUrl}
        onSave={handleSavePromptChatUrl}
      />
    </div>
  );
}

export function Navbar(props: NavbarProps) {
  return (
    <header
      className="sticky top-0 z-40 w-full border-b border-[#2e2e2e] bg-[#1a1a1a]/95 backdrop-blur-md"
      suppressHydrationWarning
    >
      <div
        className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between"
        suppressHydrationWarning
      >
        {/* Brand */}
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-9 h-9 rounded-lg bg-white flex items-center justify-center text-black shadow-md transition-transform group-hover:scale-105">
            <GraduationCap className="w-5 h-5 text-black" />
          </div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-base tracking-tight text-[#ECECEC] block">
              English Grammar Quiz
            </span>
            <span className="text-[10px] text-neutral-400 bg-[#262626] px-2 py-0.5 rounded-full border border-neutral-700/60 font-medium">
              Personal Edition
            </span>
          </div>
        </Link>

        {/* Navigation items */}
        <NavLinks {...props} />
      </div>
    </header>
  );
}
