"use client";

import React, { useState } from "react";
import {
  ExternalLink,
  RefreshCw,
  Plus,
  ChevronDown,
} from "lucide-react";
import { CourseSummary } from "@/types/quiz";
import { CopyDriveLinkButton } from "@/components/CopyDriveLinkButton";

interface CourseHeaderProps {
  courses: CourseSummary[];
  selectedCourse: CourseSummary | null;
  onSelectCourse: (course: CourseSummary) => void;
  onSyncDrive: () => Promise<void>;
  onOpenImport: () => void;
}

export function CourseHeader({
  courses,
  selectedCourse,
  onSelectCourse,
  onSyncDrive,
  onOpenImport,
}: CourseHeaderProps) {
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false);

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      await onSyncDrive();
    } finally {
      setIsSyncing(false);
    }
  };

  if (!selectedCourse) {
    return null;
  }

  const total = selectedCourse.total_chapters || selectedCourse.total_quizzes || 0;
  const done = selectedCourse.done_chapters || selectedCourse.completed_quizzes || 0;
  const _completionPct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div className="bg-[#2a2a2a] border border-[#383838] rounded-2xl p-6 mb-8 shadow-lg shadow-black/20">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        {/* Left: Book Title, Dropdown & Info */}
        <div className="space-y-3 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Active Book
            </span>

            {selectedCourse.drive_folder_url && (
              <div className="flex items-center gap-1 bg-[#212121] border border-[#383838] rounded-full py-0.5 px-2.5">
                <a
                  href={selectedCourse.drive_folder_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1"
                >
                  <span>Drive Folder</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
                <CopyDriveLinkButton
                  url={selectedCourse.drive_folder_url}
                  folderId={selectedCourse.drive_folder_id}
                  title="Copy Google Drive folder link"
                />
              </div>
            )}
          </div>

          {/* Book Selector Dropdown */}
          <div className="relative inline-block text-left">
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="flex items-center gap-2 text-2xl font-bold text-white hover:text-gray-200 transition-colors group cursor-pointer text-left"
            >
              <span>{selectedCourse.title}</span>
              <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${isDropdownOpen ? "rotate-180" : ""}`} />
            </button>

            {isDropdownOpen && (
              <div className="absolute left-0 mt-2 w-80 rounded-xl bg-[#212121] border border-[#383838] shadow-2xl py-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                <div className="px-3 py-1.5 text-xs font-semibold text-gray-400 border-b border-[#303030]">
                  Select Book
                </div>
                <div className="max-h-60 overflow-y-auto">
                  {courses.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => {
                        onSelectCourse(c);
                        setIsDropdownOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 text-sm transition-colors hover:bg-[#2e2e2e] flex items-center justify-between ${
                        c.id === selectedCourse.id ? "text-white font-semibold bg-[#2a2a2a]" : "text-gray-300"
                      }`}
                    >
                      <span className="truncate">{c.title}</span>
                      <span className="text-xs text-gray-500 shrink-0 ml-2">
                        {c.total_chapters || c.total_quizzes} ch.
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <p className="text-sm text-gray-400 line-clamp-2 max-w-2xl">
            {selectedCourse.description || "Reading chapters and learning progress."}
          </p>
        </div>

        {/* Right: Actions */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
          <button
            onClick={handleSync}
            disabled={isSyncing}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#242424] hover:bg-[#2f2f2f] text-gray-200 border border-[#383838] transition-colors text-xs font-semibold cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isSyncing ? "animate-spin text-blue-400" : ""}`} />
            <span>{isSyncing ? "Syncing..." : "Sync Drive Chapters"}</span>
          </button>

          <button
            onClick={onOpenImport}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white text-black hover:bg-neutral-200 transition-colors text-xs font-semibold shadow-sm cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Import Book</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export const BookHeader = CourseHeader;
