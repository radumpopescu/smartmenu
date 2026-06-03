"use client";

import type { Category, MenuItem } from "@/db/schema";
import { formatPrice, parseTags } from "@/lib/utils";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import {
  X,
  Upload,
  ImagePlus,
  Copy,
  Check,
  ExternalLink,
  Sparkles,
  Trash2,
} from "lucide-react";

function leiFromCents(cents: number | null): string {
  if (cents == null) return "";
  return (cents / 100).toFixed(2).replace(".", ",");
}

function centsFromLeiInput(value: string): number | null {
  const normalized = value.trim().replace(",", ".");
  if (!normalized) return null;
  const n = parseFloat(normalized);
  if (Number.isNaN(n)) return null;
  return Math.round(n * 100);
}

type Props = {
  item: MenuItem;
  categories: Category[];
  currency: string;
  dishEnhancementPrompt: string;
  apiMode: boolean;
  provider: "nano-banana" | "openai";
  copied: boolean;
  enhancing: boolean;
  uploadingEnhanced: boolean;
  saving: boolean;
  onClose: () => void;
  onSave: (data: {
    name: string;
    description: string | null;
    categoryId: string | null;
    priceCents: number | null;
    priceLabel: string | null;
    tags: string[];
    published: boolean;
    sortOrder: number;
  }) => void;
  onUploadPhoto: (file: File) => void;
  onUploadEnhanced: (file: File) => void;
  onClearEnhanced: () => void;
  onEnhance: () => void;
  onDelete: () => void;
  onCopyPrompt: () => void;
};

export function ProductEditModal({
  item,
  categories,
  currency,
  dishEnhancementPrompt,
  apiMode,
  copied,
  enhancing,
  uploadingEnhanced,
  saving,
  onClose,
  onSave,
  onUploadPhoto,
  onUploadEnhanced,
  onClearEnhanced,
  onEnhance,
  onDelete,
  onCopyPrompt,
}: Props) {
  const [name, setName] = useState(item.name);
  const [description, setDescription] = useState(item.description ?? "");
  const [categoryId, setCategoryId] = useState(item.categoryId ?? "");
  const [usePriceLabel, setUsePriceLabel] = useState(!!item.priceLabel);
  const [priceLei, setPriceLei] = useState(leiFromCents(item.priceCents));
  const [priceLabel, setPriceLabel] = useState(item.priceLabel ?? "");
  const [tagsInput, setTagsInput] = useState(parseTags(item.tags).join(", "));
  const [published, setPublished] = useState(item.published);
  const [sortOrder, setSortOrder] = useState(String(item.sortOrder));

  const uploadOriginalRef = useRef<HTMLInputElement>(null);
  const uploadEnhancedRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setName(item.name);
    setDescription(item.description ?? "");
    setCategoryId(item.categoryId ?? "");
    setUsePriceLabel(!!item.priceLabel);
    setPriceLei(leiFromCents(item.priceCents));
    setPriceLabel(item.priceLabel ?? "");
    setTagsInput(parseTags(item.tags).join(", "));
    setPublished(item.published);
    setSortOrder(String(item.sortOrder));
  }, [item]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const tags = tagsInput
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    onSave({
      name: name.trim(),
      description: description.trim() || null,
      categoryId: categoryId || null,
      priceCents: usePriceLabel ? null : centsFromLeiInput(priceLei),
      priceLabel: usePriceLabel ? priceLabel.trim() || null : null,
      tags,
      published,
      sortOrder: parseInt(sortOrder, 10) || 0,
    });
  }

  const displayUrl = item.enhancedImageUrl ?? item.originalImageUrl;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="product-edit-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        aria-label="Close"
      />
      <div className="relative w-full sm:max-w-lg max-h-[92vh] sm:max-h-[90vh] bg-white rounded-t-2xl sm:rounded-2xl border border-[#e8e2d9] shadow-xl flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#f0ebe3] shrink-0">
          <h2
            id="product-edit-title"
            className="font-[family-name:var(--font-display)] text-xl text-[#1a1612]"
          >
            Edit product
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-[#f8f6f3] text-[#5c534a]"
          >
            <X size={20} />
          </button>
        </div>

        <form
          id="product-edit-form"
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto px-5 py-4 space-y-5"
        >
          <div className="flex gap-4">
            <div className="relative w-24 h-24 shrink-0 rounded-lg overflow-hidden bg-[#f0ebe3]">
              {displayUrl ? (
                <Image
                  src={displayUrl}
                  alt={item.name}
                  fill
                  className="object-cover"
                  unoptimized
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-xs text-[#9a8f82]">
                  No photo
                </div>
              )}
            </div>
            <div className="flex-1 space-y-2">
              <p className="text-xs font-medium text-[#5c534a]">Photos</p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => uploadOriginalRef.current?.click()}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs border border-[#e8e2d9] rounded-lg hover:bg-[#f8f6f3]"
                >
                  <Upload size={12} />
                  Original
                </button>
                <button
                  type="button"
                  onClick={() => uploadEnhancedRef.current?.click()}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs bg-[#c9a962]/20 border border-[#c9a962]/40 rounded-lg"
                >
                  <ImagePlus size={12} />
                  {uploadingEnhanced ? "…" : "Enhanced"}
                </button>
                <button
                  type="button"
                  onClick={onCopyPrompt}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs border rounded-lg"
                >
                  {copied ? <Check size={12} /> : <Copy size={12} />}
                  Prompt
                </button>
                {item.originalImageUrl && (
                  <a
                    href={item.originalImageUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs border rounded-lg"
                  >
                    <ExternalLink size={12} />
                    Open
                  </a>
                )}
                {item.enhancedImageUrl && (
                  <button
                    type="button"
                    onClick={onClearEnhanced}
                    className="text-xs text-[#9a8f82] hover:text-red-600 px-1"
                  >
                    Clear enhanced
                  </button>
                )}
                {apiMode && item.originalImageUrl && (
                  <button
                    type="button"
                    onClick={onEnhance}
                    disabled={enhancing}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs bg-[#1a1612] text-white rounded-lg disabled:opacity-50"
                  >
                    <Sparkles size={12} />
                    {enhancing ? "…" : "API"}
                  </button>
                )}
              </div>
              <input
                ref={uploadOriginalRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onUploadPhoto(f);
                  e.target.value = "";
                }}
              />
              <input
                ref={uploadEnhancedRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onUploadEnhanced(f);
                  e.target.value = "";
                }}
              />
            </div>
          </div>

          <Field label="Name">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className={inputClass}
            />
          </Field>

          <Field label="Description">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className={inputClass}
            />
          </Field>

          <Field label="Category">
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className={inputClass}
            >
              <option value="">Uncategorized</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>

          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm text-[#5c534a]">
              <input
                type="checkbox"
                checked={usePriceLabel}
                onChange={(e) => setUsePriceLabel(e.target.checked)}
                className="rounded"
              />
              Custom price label (e.g. Market price)
            </label>
            {usePriceLabel ? (
              <input
                value={priceLabel}
                onChange={(e) => setPriceLabel(e.target.value)}
                placeholder="e.g. Preț la cerere"
                className={inputClass}
              />
            ) : (
              <div className="flex items-center gap-2">
                <input
                  value={priceLei}
                  onChange={(e) => setPriceLei(e.target.value)}
                  placeholder="0,00"
                  inputMode="decimal"
                  className={inputClass}
                />
                <span className="text-sm text-[#9a8f82] shrink-0">lei</span>
              </div>
            )}
            {!usePriceLabel && item.priceCents != null && (
              <p className="text-xs text-[#9a8f82]">
                Preview:{" "}
                {formatPrice(
                  centsFromLeiInput(priceLei),
                  null,
                  currency
                ) || "—"}
              </p>
            )}
          </div>

          <Field label="Tags (comma-separated)">
            <input
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="vegan, spicy"
              className={inputClass}
            />
          </Field>

          <Field label="Sort order">
            <input
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              className={inputClass}
            />
          </Field>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={published}
              onChange={(e) => setPublished(e.target.checked)}
              className="rounded"
            />
            <span className="text-sm text-[#1a1612]">Published on public menu</span>
          </label>
        </form>

        <div className="shrink-0 px-5 py-4 border-t border-[#f0ebe3] flex flex-wrap gap-2 justify-between bg-[#fafaf8]">
          <button
            type="button"
            onClick={() => {
              if (confirm("Delete this product?")) onDelete();
            }}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg"
          >
            <Trash2 size={16} />
            Delete
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-[#5c534a] hover:bg-[#f0ebe3] rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="product-edit-form"
              disabled={saving || !name.trim()}
              className="px-5 py-2 text-sm bg-[#1a1612] text-white rounded-lg font-medium disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const inputClass =
  "w-full px-3 py-2 text-sm rounded-lg border border-[#e8e2d9] focus:outline-none focus:ring-2 focus:ring-[#c9a962]/40";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm text-[#5c534a] mb-1">{label}</label>
      {children}
    </div>
  );
}