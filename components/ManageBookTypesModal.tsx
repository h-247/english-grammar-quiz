"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  X,
  Plus,
  Edit2,
  Trash2,
  Check,
  Tag,
  Loader2,
  BookOpen,
} from "lucide-react";
import { BookTypeItem } from "@/types/quiz";
import { getBookTypes, createBookType, updateBookType, deleteBookType } from "@/lib/api";
import { DEFAULT_REPO_BOOK_TYPES } from "@/lib/utils";

interface ManageBookTypesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTypesChange?: (types: BookTypeItem[]) => void;
}

export function ManageBookTypesModal({
  isOpen,
  onClose,
  onTypesChange,
}: ManageBookTypesModalProps) {
  const [mounted, setMounted] = useState(false);
  const [types, setTypes] = useState<BookTypeItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [newTypeName, setNewTypeName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingTypeId, setEditingTypeId] = useState<string | null>(null);
  const [editingTypeName, setEditingTypeName] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const loadTypes = async () => {
    setIsLoading(true);
    try {
      const data = await getBookTypes();
      if (Array.isArray(data)) {
        setTypes(data);
        onTypesChange?.(data);
      }
    } catch (err: any) {
      console.error("Failed to load book types:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadTypes();
      setError(null);
      setEditingTypeId(null);
      setNewTypeName("");
    }
  }, [isOpen]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen && !isSubmitting) {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, isSubmitting, onClose]);

  const handleCreate = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = newTypeName.trim();
    if (!trimmed) return;

    setIsSubmitting(true);
    setError(null);
    try {
      const created = await createBookType(trimmed, "genre");
      const updated = types.some((t) => t.id === created.id)
        ? types
        : [...types, created];
      setTypes(updated);
      onTypesChange?.(updated);
      setNewTypeName("");
    } catch (err: any) {
      setError(err.message || "Failed to create book genre");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdate = async (typeId: string) => {
    const trimmed = editingTypeName.trim();
    if (!trimmed) return;

    try {
      const updated = await updateBookType(typeId, trimmed);
      const updatedList = types.map((t) =>
        t.id === typeId ? { ...t, name: updated.name } : t
      );
      setTypes(updatedList);
      onTypesChange?.(updatedList);
      setEditingTypeId(null);
    } catch (err: any) {
      setError(err.message || "Failed to update book genre");
    }
  };

  const handleDelete = async (typeId: string) => {
    try {
      await deleteBookType(typeId);
      const updatedList = types.filter((t) => t.id !== typeId);
      setTypes(updatedList);
      onTypesChange?.(updatedList);
    } catch (err: any) {
      setError(err.message || "Failed to delete book genre");
    }
  };

  if (!isOpen || !mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) onClose();
      }}
    >
      <div className="relative w-full max-w-lg max-h-[85vh] overflow-hidden bg-[#1b1b1b] border border-[#2f2f2f] rounded-2xl shadow-2xl text-white flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[#2e2e2e]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center border border-purple-500/30">
              <Tag className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">CRUD Genres of Books</h2>
              <p className="text-xs text-gray-400">
                Manage genres in repo genres of book (Create, Read, Update, Delete)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-[#282828] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content body */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {error && (
            <div className="p-3 rounded-xl bg-red-950/40 border border-red-500/40 text-xs text-red-200">
              {error}
            </div>
          )}

          {/* Create New Genre Form */}
          <form onSubmit={handleCreate} className="p-3.5 rounded-xl bg-[#222222] border border-[#333333] space-y-2.5">
            <label className="text-xs font-bold uppercase tracking-wider text-purple-300 block">
              + Add New Genre to Repo
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={newTypeName}
                onChange={(e) => setNewTypeName(e.target.value)}
                placeholder="e.g. Science Fiction, Self Help, Mystery..."
                className="flex-1 bg-[#161616] border border-[#3e3e3e] rounded-xl px-3.5 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-purple-400 transition-colors"
              />
              <button
                type="submit"
                disabled={isSubmitting || !newTypeName.trim()}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-white transition-colors cursor-pointer disabled:opacity-50 shrink-0 flex items-center gap-1.5 shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Genre</span>
              </button>
            </div>
          </form>

          {/* List of Genres in Repo */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-gray-400 px-1">
              <span>Repo Genres of Book ({types.length})</span>
              {isLoading && <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-400" />}
            </div>

            <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
              {types.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-[#222222] border border-[#2f2f2f] hover:border-[#3d3d3d] transition-all"
                >
                  {editingTypeId === t.id ? (
                    <div className="flex items-center gap-2 flex-1 mr-2">
                      <input
                        type="text"
                        value={editingTypeName}
                        onChange={(e) => setEditingTypeName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleUpdate(t.id);
                          if (e.key === "Escape") setEditingTypeId(null);
                        }}
                        className="flex-1 bg-[#161616] border border-purple-500 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => handleUpdate(t.id)}
                        className="p-1 text-emerald-400 hover:text-emerald-300 cursor-pointer"
                        title="Save genre name"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingTypeId(null)}
                        className="p-1 text-gray-400 hover:text-white cursor-pointer"
                        title="Cancel"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-2.5">
                        <span className="font-semibold text-xs text-gray-100">{t.name}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingTypeId(t.id);
                            setEditingTypeName(t.name);
                          }}
                          className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-[#2c2c2c] transition-colors cursor-pointer"
                          title="Edit genre name (Update)"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(t.id)}
                          className="p-1.5 text-red-400 hover:text-red-300 rounded-lg hover:bg-red-500/10 transition-colors cursor-pointer"
                          title="Delete genre from repo"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#2e2e2e] flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-white text-black hover:bg-neutral-200 transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
