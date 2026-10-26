"use client";

import React, { FormEvent, useState, useEffect, useCallback } from "react";
import { Link2, Pencil, X, Sparkles, Loader2, AlertCircle } from "lucide-react";
import { getSettings, updatePromptChatUrl } from "@/lib/api";
import { DEFAULT_PROMPT_CHAT_URL } from "@/lib/course-manifest";
import { useToast } from "@/components/Toast";

interface SharedPromptLinkSettingsProps {
  compact?: boolean;
  canEdit?: boolean;
  className?: string;
}

export function SharedPromptLinkSettings({
  compact: _compact = true,
  canEdit = false,
  className = "",
}: SharedPromptLinkSettingsProps) {
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState<string>("");
  const [inputVal, setInputVal] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync state from localStorage & API
  const refreshUrl = useCallback(async () => {
    if (typeof window === "undefined") return;
    const cached = localStorage.getItem("prompt_chat_url");
    if (cached !== null) {
      setUrl(cached);
    }
    try {
      const res = await getSettings();
      if (res.prompt_chat_url) {
        setUrl(res.prompt_chat_url);
        localStorage.setItem("prompt_chat_url", res.prompt_chat_url);
      }
    } catch {}
  }, []);

  useEffect(() => {
    refreshUrl();

    const handleStorage = () => refreshUrl();
    window.addEventListener("prompt_chat_url_changed", handleStorage);
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener("prompt_chat_url_changed", handleStorage);
      window.removeEventListener("storage", handleStorage);
    };
  }, [refreshUrl]);

  function show(e?: React.MouseEvent) {
    if (e) e.stopPropagation();
    if (!canEdit) return; // Prompt links can only be edited in Navbar
    setInputVal(url || DEFAULT_PROMPT_CHAT_URL);
    setError(null);
    setOpen(true);
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!canEdit) return;

    const clean = inputVal.trim();
    if (clean) {
      try {
        const parsed = new URL(clean.startsWith("http") ? clean : `https://${clean}`);
        if (!["http:", "https:"].includes(parsed.protocol) || !parsed.hostname) throw new Error();
      } catch {
        setError("Enter a valid HTTP or HTTPS URL.");
        return;
      }
    }

    setBusy(true);
    setError(null);
    const finalUrl = clean
      ? clean.startsWith("http")
        ? clean
        : `https://${clean}`
      : "";

    try {
      await updatePromptChatUrl(finalUrl);
      setUrl(finalUrl);
      if (finalUrl) {
        localStorage.setItem("prompt_chat_url", finalUrl);
      } else {
        localStorage.removeItem("prompt_chat_url");
      }
      window.dispatchEvent(new Event("prompt_chat_url_changed"));
      showToast(finalUrl ? "Prompt link saved." : "Prompt link cleared.", "success", 3000);
      setOpen(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not save prompt link.");
    } finally {
      setBusy(false);
    }
  }

  const hasUrl = Boolean(url && url.trim().length > 0);

  return (
    <>
      {canEdit ? (
        // Editable mode (ONLY in Navbar): Dual pill with Link2 and Pencil icons [ 🔗 | ✏️ ]
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
              title="Open shared Prompt link"
              aria-label="Open shared Prompt link"
              className="inline-flex h-7 w-7 items-center justify-center hover:bg-white/10 transition-colors focus-visible:outline-none"
            >
              <Link2 className="h-3.5 w-3.5" />
            </a>
          ) : (
            <button
              type="button"
              onClick={show}
              title="Add shared Prompt link"
              aria-label="Add shared Prompt link"
              className="inline-flex h-7 w-7 items-center justify-center hover:bg-white/10 transition-colors cursor-pointer focus-visible:outline-none"
            >
              <Link2 className="h-3.5 w-3.5" />
            </button>
          )}

          <button
            type="button"
            onClick={show}
            title="Edit the shared Prompt link"
            aria-label="Edit the shared Prompt link"
            className={`inline-flex h-7 w-7 items-center justify-center border-l hover:bg-white/10 transition-colors cursor-pointer focus-visible:outline-none ${
              hasUrl ? "border-emerald-500/40" : "border-amber-500/40"
            }`}
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        // Non-editable mode (Outside Navbar): ONLY the Link2 button to open prompt link
        hasUrl ? (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            title="Open shared Prompt link"
            aria-label="Open shared Prompt link"
            className={`inline-flex h-7 w-7 items-center justify-center rounded-lg border transition-all border-emerald-500/60 bg-[#062419] text-emerald-400 hover:border-emerald-400 hover:bg-white/10 focus-visible:outline-none ${className}`}
          >
            <Link2 className="h-3.5 w-3.5" />
          </a>
        ) : (
          <span
            onClick={(e) => e.stopPropagation()}
            title="Prompt link can only be edited in Navbar"
            aria-label="Prompt link can only be edited in Navbar"
            className={`inline-flex h-7 w-7 items-center justify-center rounded-lg border border-amber-500/60 bg-[#261c0c] text-amber-400/60 cursor-default opacity-80 ${className}`}
          >
            <Link2 className="h-3.5 w-3.5" />
          </span>
        )
      )}

      {/* Edit Modal (ONLY rendered when canEdit is true) */}
      {canEdit && open && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150"
          onClick={(e) => {
            if (e.target === e.currentTarget && !busy) setOpen(false);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="shared-prompt-title"
            className="w-full max-w-lg rounded-2xl border border-[#383838] bg-[#212121] p-6 shadow-2xl text-[#ececec] animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#333333]">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h2 id="shared-prompt-title" className="text-base font-bold text-white">
                    Shared Prompt Link
                  </h2>
                  <p className="text-xs text-[#9CA3AF]">
                    One link shared across your books and chapters.
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

            <form onSubmit={save} className="mt-4 space-y-4">
              <div>
                <label htmlFor="shared-prompt-url" className="block text-xs font-semibold text-[#ECECEC] mb-1.5">
                  Prompt Chat URL (ChatGPT Integration)
                </label>
                <input
                  id="shared-prompt-url"
                  type="url"
                  autoFocus
                  value={inputVal}
                  onChange={(event) => setInputVal(event.target.value)}
                  placeholder="https://chatgpt.com/g/..."
                  disabled={busy}
                  className="w-full rounded-xl border border-[#444444] bg-[#141414] px-3.5 py-2.5 text-xs text-white placeholder-gray-500 outline-none focus:border-white transition-colors"
                />
                <p className="mt-1 text-[11px] text-gray-400">
                  Enter your custom GPT or shared ChatGPT chat link.
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
                    onClick={() => setInputVal("")}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium text-rose-400 hover:bg-rose-500/10 border border-rose-900/30 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    Clear Link
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
                    <span>{busy ? "Saving..." : "Save"}</span>
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

export default SharedPromptLinkSettings;
