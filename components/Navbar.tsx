"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  History,
  Plus,
  HardDrive,
  LogOut,
  User,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { DEFAULT_PROMPT_CHAT_URL } from "@/lib/course-manifest";
import { EditPromptChatModal } from "@/components/EditPromptChatModal";
import { SettingsModal } from "@/components/SettingsModal";
import { SharedPromptLinkSettings } from "@/components/SharedPromptLinkSettings";
import { getSettings } from "@/lib/api";

interface NavbarProps {
  onOpenImportCourse?: () => void;
  onOpenImportBook?: () => void;
  userEmail?: string;
  driveConnected?: boolean;
  promptChatUrl?: string;
  onPromptChatUrlChange?: (newUrl: string) => void;
}

function NavLinks({
  onOpenImportCourse,
  onOpenImportBook,
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
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const handleOpenImport = onOpenImportBook || onOpenImportCourse;

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
      {/* Drive Status Indicator */}
      <button
        type="button"
        onClick={() => setIsSettingsOpen(true)}
        title="Google Drive sync settings"
        className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#1e1e1e] hover:bg-[#282828] text-[#a3a3a3] hover:text-white border border-[#333333] transition-colors cursor-pointer"
      >
        <HardDrive className="w-3.5 h-3.5 text-blue-400" />
        <span>Drive:</span>
        <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          {driveConnected ? "Connected" : "Offline"}
        </span>
      </button>

      {/* Shared Prompt Link Settings Pill (Editable in Navbar) */}
      <SharedPromptLinkSettings compact canEdit={true} />

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

      {/* + Import Book (White prominent button) */}
      {handleOpenImport && (
        <button
          onClick={handleOpenImport}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm font-semibold bg-white text-black hover:bg-neutral-200 transition-all shadow-sm cursor-pointer active:scale-95"
        >
          <Plus className="w-4 h-4 text-black stroke-[2.5]" />
          <span>Import Book</span>
        </button>
      )}

      {/* Settings Button */}
      <button
        type="button"
        onClick={() => setIsSettingsOpen(true)}
        title="Application Settings & Drive Config"
        className="p-2 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition-colors cursor-pointer border border-transparent hover:border-[#383838]"
      >
        <Settings className="w-4 h-4" />
      </button>

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

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onSettingsSaved={() => {
          getSettings().then((s) => {
            if (s.prompt_chat_url) handleSavePromptChatUrl(s.prompt_chat_url);
          }).catch(() => {});
        }}
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
            <BookOpen className="w-5 h-5 text-black" />
          </div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-base tracking-tight text-[#ECECEC] block">
              Book Manager
            </span>
            <span className="text-[10px] text-neutral-400 bg-[#262626] px-2 py-0.5 rounded-full border border-neutral-700/60 font-medium">
              Goodreads & Drive
            </span>
          </div>
        </Link>

        {/* Navigation items */}
        <NavLinks {...props} />
      </div>
    </header>
  );
}
