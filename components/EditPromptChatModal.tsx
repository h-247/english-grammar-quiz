"use client";

import React, { useState, useEffect } from "react";
import { X, Sparkles, ExternalLink, RotateCcw, Check, Loader2 } from "lucide-react";
import { DEFAULT_PROMPT_CHAT_URL } from "@/lib/course-manifest";
import { updatePromptChatUrl } from "@/lib/api";
import { useToast } from "@/components/Toast";

interface EditPromptChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUrl: string;
  onSave: (newUrl: string) => void;
}

export function EditPromptChatModal({
  isOpen,
  onClose,
  currentUrl,
  onSave,
}: EditPromptChatModalProps) {
  const { showToast } = useToast();
  const [url, setUrl] = useState(currentUrl || DEFAULT_PROMPT_CHAT_URL);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setUrl(currentUrl || DEFAULT_PROMPT_CHAT_URL);
      setError(null);
    }
  }, [isOpen, currentUrl]);

  if (!isOpen) return null;

  const handleReset = () => {
    setUrl(DEFAULT_PROMPT_CHAT_URL);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = url.trim();

    if (!trimmed) {
      setError("Please provide a valid URL.");
      return;
    }

    const formattedUrl =
      trimmed.startsWith("http://") || trimmed.startsWith("https://")
        ? trimmed
        : `https://${trimmed}`;

    setIsSaving(true);
    setError(null);

    try {
      await updatePromptChatUrl(formattedUrl);
      onSave(formattedUrl);
      showToast("Prompt Chat link updated successfully!", "success", 4000);
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update Prompt Chat URL.";
      setError(msg);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg bg-[#1e1e1e] border border-[#333333] rounded-2xl shadow-2xl overflow-hidden text-[#ececec]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2e2e2e] bg-[#242424]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Edit "Prompt Chat" Link</h3>
              <p className="text-xs text-[#9CA3AF]">
                Set the AI/ChatGPT URL used across all courses and quizzes
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isSaving}
            className="p-1.5 text-[#9CA3AF] hover:text-white rounded-lg hover:bg-[#333333] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor="prompt-chat-input" className="text-xs font-semibold text-gray-300">
                Prompt Chat URL
              </label>
              <button
                type="button"
                onClick={handleReset}
                className="text-[11px] text-gray-400 hover:text-emerald-400 transition-colors flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset to default</span>
              </button>
            </div>

            <div className="relative">
              <input
                id="prompt-chat-input"
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://chatgpt.com"
                className="w-full bg-[#141414] border border-[#383838] rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500 transition-colors font-mono"
              />
            </div>

            <p className="text-[11px] text-[#888888] leading-relaxed">
              You can paste a custom ChatGPT chat URL, custom GPT URL, or leave it as{" "}
              <code className="text-emerald-400 bg-black/40 px-1 py-0.5 rounded">https://chatgpt.com</code>.
            </p>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/40 text-xs text-rose-300">
              {error}
            </div>
          )}

          {/* Test Link Button */}
          {url && (
            <div className="pt-1">
              <a
                href={url.startsWith("http") ? url : `https://${url}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors"
              >
                <span>Test open link in new tab</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#2e2e2e]">
            <button
              type="button"
              disabled={isSaving}
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-400 hover:text-white hover:bg-[#2c2c2c] transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 text-black shadow-lg shadow-emerald-950/20 transition-all cursor-pointer disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>Save Link</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
