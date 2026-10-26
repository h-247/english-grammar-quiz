"use client";

import React, { useState } from "react";
import { MessageSquare, Pencil, X, Loader2, AlertCircle } from "lucide-react";
import { updateQuiz } from "@/lib/api";
import { useToast } from "@/components/Toast";

interface ChatGPTLinkActionsProps {
  url?: string | null;
  chapterId?: string;
  chapterTitle?: string;
  onSaved?: (newUrl: string | null) => void;
  onEdit?: () => void;
  className?: string;
}

export function ChatGPTLinkActions({
  url: initialUrl,
  chapterId,
  chapterTitle,
  onSaved,
  onEdit,
  className = "",
}: ChatGPTLinkActionsProps) {
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState(initialUrl || "");
  const [inputVal, setInputVal] = useState(initialUrl || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync if prop changes
  React.useEffect(() => {
    setUrl(initialUrl || "");
  }, [initialUrl]);

  const hasUrl = Boolean(url && url.trim().length > 0);

  const handleOpenModal = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onEdit) {
      onEdit();
      return;
    }
    setInputVal(url || "");
    setError(null);
    setOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = inputVal.trim();

    if (clean) {
      try {
        const parsed = new URL(clean.startsWith("http") ? clean : `https://${clean}`);
        if (!["http:", "https:"].includes(parsed.protocol) || !["chatgpt.com", "chat.openai.com"].includes(parsed.hostname.toLowerCase())) {
          setError("Please enter a valid ChatGPT link from chatgpt.com or chat.openai.com.");
          return;
        }
      } catch {
        setError("Please enter a valid URL (e.g., https://chatgpt.com/c/...).");
        return;
      }
    }

    setBusy(true);
    setError(null);
    const finalUrl = clean
      ? clean.startsWith("http")
        ? clean
        : `https://${clean}`
      : null;

    try {
      if (chapterId) {
        await updateQuiz(chapterId, { chatgpt_url: finalUrl });
      }
      setUrl(finalUrl || "");
      onSaved?.(finalUrl);
      showToast(finalUrl ? "ChatGPT link saved." : "ChatGPT link removed.", "success", 3000);
      setOpen(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save ChatGPT link.");
    } finally {
      setBusy(false);
    }
  };

  const handleClear = async () => {
    setBusy(true);
    setError(null);
    try {
      if (chapterId) {
        await updateQuiz(chapterId, { chatgpt_url: null });
      }
      setUrl("");
      setInputVal("");
      onSaved?.(null);
      showToast("ChatGPT link removed.", "info", 3000);
      setOpen(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to remove ChatGPT link.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div
        onClick={(e) => e.stopPropagation()}
        className={`inline-flex h-7 items-center overflow-hidden rounded-lg border transition-all ${
          hasUrl
            ? "border-emerald-500/60 bg-[#062419] text-emerald-400 hover:border-emerald-400"
            : "border-amber-500/60 bg-[#261c0c] text-amber-400 hover:border-amber-400"
        } ${className}`}
      >
        {hasUrl ? (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            title="Open ChatGPT conversation"
            aria-label="Open ChatGPT conversation"
            className="inline-flex h-7 w-7 items-center justify-center hover:bg-white/10 transition-colors focus-visible:outline-none"
          >
            <MessageSquare className="h-3.5 w-3.5" />
          </a>
        ) : (
          <button
            type="button"
            onClick={handleOpenModal}
            title="Add ChatGPT conversation link"
            aria-label="Add ChatGPT conversation link"
            className="inline-flex h-7 w-7 items-center justify-center hover:bg-white/10 transition-colors cursor-pointer focus-visible:outline-none"
          >
            <MessageSquare className="h-3.5 w-3.5" />
          </button>
        )}

        <button
          type="button"
          onClick={handleOpenModal}
          title="Edit ChatGPT conversation link"
          aria-label="Edit ChatGPT conversation link"
          className={`inline-flex h-7 w-7 items-center justify-center border-l hover:bg-white/10 transition-colors cursor-pointer focus-visible:outline-none ${
            hasUrl ? "border-emerald-500/40" : "border-amber-500/40"
          }`}
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Edit Modal */}
      {open && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150"
          onClick={(e) => {
            if (e.target === e.currentTarget && !busy) setOpen(false);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="chatgpt-link-title"
            className="w-full max-w-lg rounded-2xl border border-[#383838] bg-[#212121] p-6 shadow-2xl text-[#ececec] animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#333333]">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <div>
                  <h2 id="chatgpt-link-title" className="text-base font-bold text-white">
                    ChatGPT Conversation Link
                  </h2>
                  <p className="text-xs text-[#9CA3AF]">
                    {chapterTitle ? `Chapter: ${chapterTitle}` : "Link this chapter to its ChatGPT conversation"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={busy}
                className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="mt-4 space-y-4">
              <div>
                <label htmlFor="chatgpt-url-input" className="block text-xs font-semibold text-[#ECECEC] mb-1.5">
                  ChatGPT Conversation URL
                </label>
                <input
                  id="chatgpt-url-input"
                  type="url"
                  autoFocus
                  value={inputVal}
                  onChange={(e) => setInputVal(e.target.value)}
                  placeholder="https://chatgpt.com/c/..."
                  disabled={busy}
                  className="w-full rounded-xl border border-[#444444] bg-[#141414] px-3.5 py-2.5 text-xs text-white placeholder-gray-500 outline-none focus:border-white transition-colors"
                />
                <p className="mt-1 text-[11px] text-gray-400">
                  Paste the chat URL from chatgpt.com or chat.openai.com.
                </p>
              </div>

              {error && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs rounded-xl flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>{error}</span>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#2e2e2e]">
                {hasUrl ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={handleClear}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium text-rose-400 hover:bg-rose-500/10 border border-rose-900/30 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    Remove Link
                  </button>
                ) : (
                  <div />
                )}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setOpen(false)}
                    className="px-3.5 py-1.5 rounded-lg border border-[#444444] text-xs font-medium hover:bg-[#333333] transition-colors cursor-pointer disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={busy}
                    className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-white text-black text-xs font-semibold hover:bg-neutral-200 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>{busy ? "Saving..." : "Save Link"}</span>
                  </button>
                </div>
              </div>
            </form>
          </section>
        </div>
      )}
    </>
  );
}

export default ChatGPTLinkActions;
