"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  X,
  Settings,
  HardDrive,
  CheckCircle2,
  AlertCircle,
  Loader2,
  KeyRound,
  Link2,
  ClipboardPaste,
  Trash2,
} from "lucide-react";
import { getSettings, updateSettings, testDriveConnection } from "@/lib/api";
import { AppSettingsResponse } from "@/types/quiz";
import { useToast } from "@/components/Toast";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSettingsSaved?: () => void;
}

export function SettingsModal({
  isOpen,
  onClose,
  onSettingsSaved,
}: SettingsModalProps) {
  const { showToast } = useToast();
  const [mounted, setMounted] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);

  const [settings, setSettings] = useState<AppSettingsResponse | null>(null);
  const [promptChatUrl, setPromptChatUrl] = useState("");
  const [refreshToken, setRefreshToken] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setIsLoading(true);
      setTestResult(null);
      getSettings()
        .then((res) => {
          setSettings(res);
          setPromptChatUrl(res.prompt_chat_url || "");
        })
        .catch((err) => {
          showToast(err.message, "error");
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [isOpen, showToast]);

  if (!isOpen || !mounted) return null;

  const handlePasteJson = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text) {
        showToast("Clipboard is empty.", "warning");
        return;
      }
      const parsed = JSON.parse(text);
      let found = false;

      // Format 1: token.json style
      if (parsed.token?.refresh_token || parsed.token?.access_token) {
        if (parsed.token.refresh_token) setRefreshToken(parsed.token.refresh_token);
        if (parsed.token.access_token) setAccessToken(parsed.token.access_token);
        if (parsed.client_id) setClientId(parsed.client_id);
        if (parsed.client_secret) setClientSecret(parsed.client_secret);
        found = true;
      } else if (parsed.refresh_token || parsed.access_token) {
        // Format 2: raw OAuth payload
        if (parsed.refresh_token) setRefreshToken(parsed.refresh_token);
        if (parsed.access_token) setAccessToken(parsed.access_token);
        if (parsed.client_id) setClientId(parsed.client_id);
        if (parsed.client_secret) setClientSecret(parsed.client_secret);
        found = true;
      }

      if (found) {
        showToast("Google OAuth credentials detected and filled!", "success");
      } else {
        showToast("JSON pasted, but no OAuth token fields were recognized.", "warning");
      }
    } catch {
      showToast("Clipboard does not contain valid JSON.", "error");
    }
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      // First save if any fields are entered
      if (refreshToken || accessToken || clientId || clientSecret) {
        await updateSettings({
          gdrive_refresh_token: refreshToken || undefined,
          gdrive_access_token: accessToken || undefined,
          gdrive_client_id: clientId || undefined,
          gdrive_client_secret: clientSecret || undefined,
        });
      }

      const res = await testDriveConnection();
      if (res.success) {
        setTestResult({
          success: true,
          message: res.message || "Connected to Google Drive successfully!",
        });
        showToast("Drive connection confirmed!", "success");
        // refresh settings
        const fresh = await getSettings();
        setSettings(fresh);
      } else {
        setTestResult({
          success: false,
          message: res.error || "Failed to connect to Google Drive.",
        });
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || "Connection test failed.",
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSaveAll = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await updateSettings({
        prompt_chat_url: promptChatUrl.trim() || undefined,
        gdrive_refresh_token: refreshToken.trim() || undefined,
        gdrive_access_token: accessToken.trim() || undefined,
        gdrive_client_id: clientId.trim() || undefined,
        gdrive_client_secret: clientSecret.trim() || undefined,
      });

      showToast("Settings updated successfully!", "success");
      onSettingsSaved?.();
      onClose();
    } catch (err: any) {
      showToast(err.message || "Failed to save settings.", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleClearDrive = async () => {
    if (!confirm("Are you sure you want to remove configured Google Drive credentials?")) {
      return;
    }
    setIsSaving(true);
    try {
      await updateSettings({ clear_gdrive: true });
      setRefreshToken("");
      setAccessToken("");
      setClientId("");
      setClientSecret("");
      setTestResult(null);
      showToast("Google Drive credentials cleared.", "info");
      const fresh = await getSettings();
      setSettings(fresh);
      onSettingsSaved?.();
    } catch (err: any) {
      showToast(err.message || "Failed to clear credentials.", "error");
    } finally {
      setIsSaving(false);
    }
  };

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div
        className="relative w-full max-w-xl bg-[#1e1e1e] border border-[#383838] rounded-2xl shadow-2xl flex flex-col overflow-hidden max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#333333] bg-[#242424]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-neutral-800 border border-neutral-700 flex items-center justify-center text-white">
              <Settings className="w-5 h-5 text-neutral-300" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#ECECEC]">App Settings</h2>
              <p className="text-xs text-[#9CA3AF]">
                Configure Cloudflare D1 environment, Google Drive sync, and links.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSaveAll} className="flex-1 overflow-y-auto p-6 space-y-6">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 text-[#9CA3AF]">
              <Loader2 className="w-8 h-8 animate-spin text-white mb-2" />
              <span className="text-xs">Loading application settings...</span>
            </div>
          ) : (
            <>
              {/* Google Drive Status Banner */}
              <div className="p-4 rounded-xl bg-[#262626] border border-[#383838] space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <HardDrive className="w-4 h-4 text-blue-400" />
                    <span className="text-sm font-semibold text-[#ECECEC]">
                      Google Drive Cloud Sync
                    </span>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                      settings?.gdrive?.configured
                        ? "bg-emerald-950/60 border border-emerald-600/50 text-emerald-300"
                        : "bg-neutral-800 border border-neutral-700 text-neutral-400"
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        settings?.gdrive?.configured
                          ? "bg-emerald-400 animate-pulse"
                          : "bg-neutral-500"
                      }`}
                    />
                    {settings?.gdrive?.configured ? "Drive Connected" : "Not Configured / Offline"}
                  </span>
                </div>

                <p className="text-xs text-[#9CA3AF] leading-relaxed">
                  In production (Cloudflare Workers / ChatGPT Sites), Drive OAuth credentials are saved in the persistent SQLite <code className="text-neutral-300">appSettings</code> table to sync course quiz units without needing local filesystem access.
                </p>

                {/* Paste JSON shortcut */}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handlePasteJson}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#333333] hover:bg-[#404040] text-emerald-400 border border-emerald-900/40 transition-colors cursor-pointer"
                  >
                    <ClipboardPaste className="w-3.5 h-3.5" />
                    <span>Paste token.json from Clipboard</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleTestConnection}
                    disabled={isTesting}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#333333] hover:bg-[#404040] text-neutral-200 border border-[#444444] transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {isTesting ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-3.5 h-3.5 text-blue-400" />
                    )}
                    <span>Test Drive Connection</span>
                  </button>

                  {settings?.gdrive?.configured && (
                    <button
                      type="button"
                      onClick={handleClearDrive}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-rose-400 hover:text-rose-300 hover:bg-rose-950/30 transition-colors ml-auto cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Clear Tokens</span>
                    </button>
                  )}
                </div>

                {/* Connection Test Result */}
                {testResult && (
                  <div
                    className={`p-3 rounded-lg text-xs flex items-start gap-2 border ${
                      testResult.success
                        ? "bg-emerald-950/40 border-emerald-500/40 text-emerald-300"
                        : "bg-rose-950/40 border-rose-500/40 text-rose-300"
                    }`}
                  >
                    {testResult.success ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    )}
                    <span>{testResult.message}</span>
                  </div>
                )}
              </div>

              {/* OAuth Credentials Form Fields */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-[#ECECEC]">
                  <KeyRound className="w-4 h-4 text-amber-400" />
                  <span>Google OAuth Credentials</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-[#9CA3AF] mb-1">
                      Refresh Token (Recommended)
                    </label>
                    <input
                      type="password"
                      value={refreshToken}
                      onChange={(e) => setRefreshToken(e.target.value)}
                      placeholder={
                        settings?.gdrive?.has_refresh_token
                          ? "•••••••• (Already configured)"
                          : "1//04..."
                      }
                      className="w-full px-3 py-2 text-xs rounded-lg bg-[#2a2a2a] border border-[#3e3e3e] text-[#ECECEC] placeholder-[#666666] focus:outline-none focus:border-blue-500 transition-colors font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-[#9CA3AF] mb-1">
                      Access Token (Optional fallback)
                    </label>
                    <input
                      type="password"
                      value={accessToken}
                      onChange={(e) => setAccessToken(e.target.value)}
                      placeholder={
                        settings?.gdrive?.has_access_token
                          ? "•••••••• (Configured)"
                          : "ya29.a0..."
                      }
                      className="w-full px-3 py-2 text-xs rounded-lg bg-[#2a2a2a] border border-[#3e3e3e] text-[#ECECEC] placeholder-[#666666] focus:outline-none focus:border-blue-500 transition-colors font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-[#9CA3AF] mb-1">
                      Client ID
                    </label>
                    <input
                      type="text"
                      value={clientId}
                      onChange={(e) => setClientId(e.target.value)}
                      placeholder={settings?.gdrive?.client_id || "apps.googleusercontent.com"}
                      className="w-full px-3 py-2 text-xs rounded-lg bg-[#2a2a2a] border border-[#3e3e3e] text-[#ECECEC] placeholder-[#666666] focus:outline-none focus:border-blue-500 transition-colors font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-[#9CA3AF] mb-1">
                      Client Secret
                    </label>
                    <input
                      type="password"
                      value={clientSecret}
                      onChange={(e) => setClientSecret(e.target.value)}
                      placeholder="GOCSPX-..."
                      className="w-full px-3 py-2 text-xs rounded-lg bg-[#2a2a2a] border border-[#3e3e3e] text-[#ECECEC] placeholder-[#666666] focus:outline-none focus:border-blue-500 transition-colors font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Prompt Chat Link */}
              <div className="space-y-2 pt-2 border-t border-[#333333]">
                <div className="flex items-center gap-2 text-xs font-semibold text-[#ECECEC]">
                  <Link2 className="w-4 h-4 text-emerald-400" />
                  <span>Prompt Chat URL (ChatGPT Integration)</span>
                </div>
                <input
                  type="url"
                  value={promptChatUrl}
                  onChange={(e) => setPromptChatUrl(e.target.value)}
                  placeholder="https://chatgpt.com/g/..."
                  className="w-full px-3 py-2 text-xs rounded-lg bg-[#2a2a2a] border border-[#3e3e3e] text-[#ECECEC] placeholder-[#666666] focus:outline-none focus:border-emerald-500 transition-colors font-mono"
                />
              </div>
            </>
          )}

          {/* Footer actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#333333]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-neutral-300 hover:text-white rounded-lg hover:bg-neutral-800 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-white text-black hover:bg-neutral-200 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
            >
              {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>Save Settings</span>
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
