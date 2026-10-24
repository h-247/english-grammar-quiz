"use client";

import React, { useState } from "react";
import { Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/Toast";

interface CopyDriveLinkButtonProps {
  url?: string | null;
  folderId?: string | null;
  fileId?: string | null;
  variant?: "icon" | "badge" | "button";
  size?: "sm" | "md";
  className?: string;
  label?: string;
  copiedLabel?: string;
  title?: string;
}

export function CopyDriveLinkButton({
  url,
  folderId,
  fileId,
  variant = "icon",
  size = "sm",
  className,
  label = "Copy Link",
  copiedLabel = "Copied!",
  title = "Copy Google Drive link to clipboard",
}: CopyDriveLinkButtonProps) {
  const { showToast } = useToast();
  const [copied, setCopied] = useState(false);

  // Compute final Drive URL
  const resolvedUrl = React.useMemo(() => {
    if (url && (url.startsWith("http://") || url.startsWith("https://"))) {
      return url;
    }
    if (folderId) {
      return `https://drive.google.com/drive/folders/${folderId}`;
    }
    if (fileId) {
      return `https://drive.google.com/file/d/${fileId}/view`;
    }
    return url || "";
  }, [url, folderId, fileId]);

  if (!resolvedUrl) return null;

  const handleCopy = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(resolvedUrl);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = resolvedUrl;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      setCopied(true);
      showToast("Google Drive link copied to clipboard!", "success", 2500);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      showToast("Failed to copy link to clipboard.", "error");
    }
  };

  if (variant === "badge" || variant === "button") {
    return (
      <button
        type="button"
        onClick={handleCopy}
        title={copied ? "Copied!" : title}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-lg font-medium transition-all cursor-pointer select-none",
          size === "sm" ? "px-2 py-1 text-xs" : "px-3 py-1.5 text-xs sm:text-sm",
          copied
            ? "bg-emerald-950/70 border border-emerald-500/50 text-emerald-300"
            : "bg-[#222222] hover:bg-[#2d2d2d] text-blue-400 hover:text-blue-300 border border-blue-900/30",
          className
        )}
      >
        {copied ? (
          <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
        ) : (
          <Copy className="w-3.5 h-3.5 shrink-0" />
        )}
        <span>{copied ? copiedLabel : label}</span>
      </button>
    );
  }

  // variant === "icon"
  return (
    <button
      type="button"
      onClick={handleCopy}
      title={copied ? "Copied link!" : title}
      className={cn(
        "inline-flex items-center justify-center rounded-md transition-all cursor-pointer p-1 text-gray-400 hover:text-white hover:bg-[#2c2c2c]",
        copied && "text-emerald-400 hover:text-emerald-300 bg-emerald-950/40",
        className
      )}
    >
      {copied ? (
        <Check className="w-3.5 h-3.5 text-emerald-400" />
      ) : (
        <Copy className="w-3.5 h-3.5" />
      )}
    </button>
  );
}
