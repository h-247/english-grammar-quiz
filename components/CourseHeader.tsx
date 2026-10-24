"use client";

import React, { useState } from "react";
import {
  FolderGit2,
  ExternalLink,
  RefreshCw,
  Upload,
  CheckCircle2,
  Clock,
  Layers,
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

  const completionPct =
    selectedCourse.total_quizzes > 0
      ? Math.round((selectedCourse.ready_quizzes / selectedCourse.total_quizzes) * 100)
      : 0;

  return (
    <div className="bg-[#2a2a2a] border border-[#383838] rounded-2xl p-6 mb-8 shadow-lg shadow-black/20">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        {/* Left: Course Title, Dropdown & Info */}
        <div className="space-y-3 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Active Course
            </span>

            {selectedCourse.drive_folder_id && (
              <div className="inline-flex items-center rounded-full bg-blue-500/10 border border-blue-500/20 p-0.5">
                <a
                  href={selectedCourse.drive_folder_url || `https://drive.google.com/drive/folders/${selectedCourse.drive_folder_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Open Google Drive folder"
                  className="inline-flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors px-2 py-0.5"
                >
                  <FolderGit2 className="w-3.5 h-3.5" />
                  <span>Google Drive Folder</span>
                  <ExternalLink className="w-3 h-3 ml-0.5 opacity-70" />
                </a>
                <CopyDriveLinkButton
                  url={selectedCourse.drive_folder_url}
                  folderId={selectedCourse.drive_folder_id}
                  title="Copy Google Drive folder link"
                  className="p-1 border-l border-blue-500/30 text-blue-400 hover:text-white rounded-full"
                />
              </div>
            )}
          </div>

          <div className="relative">
            {courses.length > 1 ? (
              <div className="relative inline-block">
                <button
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="flex items-center gap-2 text-2xl md:text-3xl font-bold text-white hover:text-gray-200 transition-colors group"
                >
                  <span>{selectedCourse.title}</span>
                  <ChevronDown className="w-6 h-6 text-gray-400 group-hover:text-white transition-colors" />
                </button>

                {isDropdownOpen && (
                  <div className="absolute left-0 top-full mt-2 w-72 bg-[#1e1e1e] border border-[#383838] rounded-xl shadow-2xl z-30 py-2">
                    {courses.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => {
                          onSelectCourse(c);
                          setIsDropdownOpen(false);
                        }}
                        className={`w-full text-left px-4 py-2.5 text-sm transition-colors flex items-center justify-between ${
                          c.id === selectedCourse.id
                            ? "bg-blue-600/20 text-blue-400 font-semibold"
                            : "text-gray-300 hover:bg-[#2e2e2e]"
                        }`}
                      >
                        <span className="truncate">{c.title}</span>
                        <span className="text-xs text-gray-500 ml-2">{c.total_quizzes} quizzes</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
                {selectedCourse.title}
              </h1>
            )}
          </div>

          {selectedCourse.description && (
            <p className="text-sm text-gray-400 max-w-2xl leading-relaxed">
              {selectedCourse.description}
            </p>
          )}

          {/* Metrics Pill Grid */}
          <div className="flex flex-wrap items-center gap-4 pt-2">
            <div className="flex items-center gap-2 text-xs md:text-sm text-gray-300 bg-[#212121] px-3 py-1.5 rounded-lg border border-[#383838]">
              <Layers className="w-4 h-4 text-blue-400" />
              <span>
                <strong>{selectedCourse.total_quizzes}</strong> Quizzes (Units)
              </span>
            </div>

            <div className="flex items-center gap-2 text-xs md:text-sm text-gray-300 bg-[#212121] px-3 py-1.5 rounded-lg border border-[#383838]">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>
                <strong>{selectedCourse.ready_quizzes}</strong> Ready to Play
              </span>
            </div>

            {selectedCourse.pending_quizzes > 0 && (
              <div className="flex items-center gap-2 text-xs md:text-sm text-gray-300 bg-[#212121] px-3 py-1.5 rounded-lg border border-[#383838]">
                <Clock className="w-4 h-4 text-amber-400" />
                <span>
                  <strong>{selectedCourse.pending_quizzes}</strong> Awaiting Questions
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Right: Actions & Readiness Meter */}
        <div className="flex flex-col sm:flex-row lg:flex-col items-start lg:items-end justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={handleSync}
              disabled={isSyncing}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-[#383838] hover:bg-[#454545] text-white transition-all duration-200 border border-gray-600/30 disabled:opacity-50"
              title="Rescan and synchronize Google Drive files for this course"
            >
              <RefreshCw className={`w-4 h-4 text-blue-400 ${isSyncing ? "animate-spin" : ""}`} />
              <span>{isSyncing ? "Syncing Drive..." : "Sync Drive"}</span>
            </button>

            <button
              onClick={onOpenImport}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-600/20 transition-all duration-200"
            >
              <Upload className="w-4 h-4" />
              <span>Import Quiz JSON</span>
            </button>
          </div>

          {/* Course Readiness Meter */}
          <div className="w-full sm:w-48 lg:w-56 text-right">
            <div className="flex items-center justify-between text-xs text-gray-400 mb-1.5">
              <span>Course Content Ready</span>
              <span className="font-semibold text-white">{completionPct}%</span>
            </div>
            <div className="w-full bg-[#1e1e1e] h-2 rounded-full overflow-hidden border border-gray-700/50">
              <div
                className="bg-gradient-to-r from-blue-500 to-emerald-400 h-full rounded-full transition-all duration-500"
                style={{ width: `${completionPct}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
