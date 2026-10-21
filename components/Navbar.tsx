"use client";

import React, { Suspense } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  GraduationCap,
  History,
  Plus,
  HardDrive,
  LogOut,
  User,
  Upload,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NavbarProps {
  onOpenImportCourse?: () => void;
  onOpenImportQuiz?: () => void;
  userEmail?: string;
  driveConnected?: boolean;
}

function NavLinks({
  onOpenImportCourse,
  onOpenImportQuiz,
  userEmail = "toan.vuduc247@gmail.com",
  driveConnected = true,
}: NavbarProps) {
  const pathname = usePathname();

  return (
    <div className="flex items-center gap-3">
      {/* Drive Status Indicator (as in screenshot) */}
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

      {/* Optional Import Quiz Button */}
      {onOpenImportQuiz && (
        <button
          onClick={onOpenImportQuiz}
          className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#2a2a2a] text-[#ECECEC] border border-[#3a3a3a] hover:bg-[#333333] transition-colors cursor-pointer"
        >
          <Upload className="w-3.5 h-3.5 text-gray-300" />
          <span>Upload Quiz</span>
        </button>
      )}

      {/* + Import Course (White prominent button as in screenshot) */}
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
          <span className="hidden xl:inline font-mono">{userEmail}</span>
          <LogOut className="w-3.5 h-3.5 ml-0.5 text-gray-500 hover:text-red-400 cursor-pointer" />
        </div>
      </div>
    </div>
  );
}

export function Navbar({
  onOpenImportCourse,
  onOpenImportQuiz,
  userEmail,
  driveConnected = true,
}: NavbarProps) {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-[#2e2e2e] bg-[#1a1a1a]/95 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
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

        {/* Navigation items wrapped in Suspense for Next.js prerender safety */}
        <Suspense fallback={<div className="h-8 w-28 bg-[#262626] rounded-md animate-pulse" />}>
          <NavLinks
            onOpenImportCourse={onOpenImportCourse}
            onOpenImportQuiz={onOpenImportQuiz}
            userEmail={userEmail}
            driveConnected={driveConnected}
          />
        </Suspense>
      </div>
    </header>
  );
}
