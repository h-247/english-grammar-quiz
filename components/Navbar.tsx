"use client";

import React, { Suspense } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, History, Upload, Layers } from "lucide-react";
import { cn } from "@/lib/utils";

interface NavbarProps {
  onOpenImport?: () => void;
}

function NavLinks({ onOpenImport }: { onOpenImport?: () => void }) {
  const pathname = usePathname();

  return (
    <div className="flex items-center gap-3">
      <Link
        href="/"
        className={cn(
          "flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
          pathname === "/"
            ? "bg-[#262626] text-[#ECECEC] border border-[#383838]"
            : "text-[#9CA3AF] hover:text-[#ECECEC] hover:bg-[#262626]/60"
        )}
      >
        <Layers className="w-4 h-4" />
        <span className="hidden sm:inline">Library</span>
      </Link>

      <Link
        href="/history"
        className={cn(
          "flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
          pathname === "/history"
            ? "bg-[#262626] text-[#ECECEC] border border-[#383838]"
            : "text-[#9CA3AF] hover:text-[#ECECEC] hover:bg-[#262626]/60"
        )}
      >
        <History className="w-4 h-4" />
        <span className="hidden sm:inline">History</span>
      </Link>

      {onOpenImport && (
        <button
          onClick={onOpenImport}
          className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-semibold bg-white text-black hover:bg-neutral-200 transition-colors shadow-sm ml-2 cursor-pointer"
        >
          <Upload className="w-4 h-4" />
          <span>Import Quiz</span>
        </button>
      )}
    </div>
  );
}

export function Navbar({ onOpenImport }: NavbarProps) {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-[#383838] bg-[#212121]/95 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Brand */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-9 h-9 rounded-lg bg-white flex items-center justify-center text-black shadow-md transition-transform group-hover:scale-105">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <span className="font-semibold text-base tracking-tight text-[#ECECEC] block">
              English Grammar Quiz
            </span>
            <span className="text-xs text-[#9CA3AF] -mt-0.5 block">
              Timed Mastery System
            </span>
          </div>
        </Link>

        {/* Navigation items wrapped in Suspense for Next.js prerender safety */}
        <Suspense fallback={<div className="h-8 w-28 bg-[#262626] rounded-md animate-pulse" />}>
          <NavLinks onOpenImport={onOpenImport} />
        </Suspense>
      </div>
    </header>
  );
}
