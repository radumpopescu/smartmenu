"use client";

import type { Category, ProductImage } from "@/db/schema";
import {
  getAdminPreviewImageUrl,
  type MenuItemWithImages,
} from "@/lib/product-image-display";
import { DietaryBadgePicker } from "@/components/dietary-badges";
import {
  dietaryBadgeIdsToTags,
  parseDietaryBadgeIds,
  type DietaryBadgeId,
} from "@/lib/dietary-badges";
import { formatPrice } from "@/lib/utils";
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
  item: MenuItemWithImages;
  categories: Category[];
  currency: string;
  apiMode: boolean;
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
    hidden: boolean;
  }) => void;
  onUploadPhoto: (file: File) => void;
  onUploadEnhanced: (file: File) => void;
  onDeleteImage: (imageId: string) => void;
  onSetDisplayImage: (displayImageId: string | null) => void;
  onEnhance: (sourceImageId?: string) => void;
  onDelete: () => void;
  onCopyPrompt: () => void;
};

export function ProductEditModal({
  item,
  categories,
  currency,
  apiMode,
  copied,
  enhancing,
  uploadingEnhanced,
  saving,
  onClose,
  onSave,
  onUploadPhoto,
  onUploadEnhanced,
  onDeleteImage,
  onSetDisplayImage,
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
  const [badgeIds, setBadgeIds] = useState<DietaryBadgeId[]>(() =>
    parseDietaryBadgeIds(item.tags)
  );
  const [published, setPublished] = useState(item.published);
  const [hidden, setHidden] = useState(item.hidden);
  const [enhanceSourceId, setEnhanceSourceId] = useState<string>("");

  const uploadOriginalRef = useRef<HTMLInputElement>(null);
  const uploadEnhancedRef = useRef<HTMLInputElement>(null);

  const originals = item.images.filter((i) => i.kind === "original");

  useEffect(() => {
    setName(item.name);
    setDescription(item.description ?? "");
    setCategoryId(item.categoryId ?? "");
    setUsePriceLabel(!!item.priceLabel);
    setPriceLei(leiFromCents(item.priceCents));
    setPriceLabel(item.priceLabel ?? "");
    setBadgeIds(parseDietaryBadgeIds(item.tags));
    setPublished(item.published);
    setHidden(item.hidden);
    const firstOriginal = item.images.find((i) => i.kind === "original");
    if (firstOriginal) setEnhanceSourceId(firstOriginal.id);
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
    onSave({
      name: name.trim(),
      description: description.trim() || null,
      categoryId: categoryId || null,
      priceCents: usePriceLabel ? null : centsFromLeiInput(priceLei),
      priceLabel: usePriceLabel ? priceLabel.trim() || null : null,
      tags: dietaryBadgeIdsToTags(badgeIds),
      published,
      hidden,
    });
  }

  const previewUrl = getAdminPreviewImageUrl(item, item.images);

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
      <div className="relative w-full sm:max-w-xl max-h-[92vh] sm:max-h-[90vh] bg-white rounded-t-2xl sm:rounded-2xl border border-[#e8e2d9] shadow-xl flex flex-col overflow-hidden">
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
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium text-[#1a1612]">Photos</p>
              <p className="text-xs text-[#9a8f82]">
                Select which image appears on the public menu
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => uploadOriginalRef.current?.click()}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs border border-[#e8e2d9] rounded-lg hover:bg-[#f8f6f3]"
              >
                <Upload size={12} />
                Add original
              </button>
              <button
                type="button"
                onClick={() => uploadEnhancedRef.current?.click()}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs bg-[#c9a962]/20 border border-[#c9a962]/40 rounded-lg"
              >
                <ImagePlus size={12} />
                {uploadingEnhanced ? "Uploading…" : "Add enhanced"}
              </button>
              <button
                type="button"
                onClick={onCopyPrompt}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs border rounded-lg"
              >
                {copied ? <Check size={12} /> : <Copy size={12} />}
                Prompt
              </button>
              {apiMode && originals.length > 0 && (
                <button
                  type="button"
                  onClick={() =>
                    onEnhance(enhanceSourceId || undefined)
                  }
                  disabled={enhancing}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs bg-[#1a1612] text-white rounded-lg disabled:opacity-50"
                >
                  <Sparkles size={12} />
                  {enhancing ? "Enhancing…" : "API enhance"}
                </button>
              )}
            </div>

            {apiMode && originals.length > 1 && (
              <select
                value={enhanceSourceId}
                onChange={(e) => setEnhanceSourceId(e.target.value)}
                className="w-full text-xs border border-[#e8e2d9] rounded-lg px-2 py-1.5 bg-white"
              >
                {originals.map((img) => (
                  <option key={img.id} value={img.id}>
                    Enhance from original #{img.sortOrder + 1}
                  </option>
                ))}
              </select>
            )}

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

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <DisplayChoiceCard
                selected={item.displayImageId === null}
                label="No photo on menu"
                onSelect={() => onSetDisplayImage(null)}
              />
              {item.images.map((img) => (
                <ImageGalleryCard
                  key={img.id}
                  image={img}
                  selected={item.displayImageId === img.id}
                  onSelect={() => onSetDisplayImage(img.id)}
                  onDelete={() => {
                    if (confirm("Remove this photo?")) onDeleteImage(img.id);
                  }}
                />
              ))}
            </div>

            {item.images.length === 0 && (
              <p className="text-xs text-[#9a8f82]">
                No photos yet. Add an original or enhanced image above.
              </p>
            )}

            {previewUrl && (
              <p className="text-xs text-[#9a8f82]">
                Admin preview uses the menu selection when set, otherwise the
                latest upload.
              </p>
            )}
          </section>

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

          <div>
            <p className="text-sm text-[#5c534a] mb-2">Dietary badges</p>
            <DietaryBadgePicker value={badgeIds} onChange={setBadgeIds} />
            <p className="text-xs text-[#9a8f82] mt-2">
              Tap to toggle. Icons on the menu list; names shown on the dish
              page.
            </p>
          </div>

          <div className="space-y-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={published}
                onChange={(e) => setPublished(e.target.checked)}
                className="rounded"
              />
              <span className="text-sm text-[#1a1612]">
                Published on public menu
              </span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={hidden}
                onChange={(e) => setHidden(e.target.checked)}
                className="rounded"
              />
              <span className="text-sm text-[#1a1612]">
                Hidden (not shown on public menu or main grid)
              </span>
            </label>
          </div>
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

function DisplayChoiceCard({
  selected,
  label,
  onSelect,
}: {
  selected: boolean;
  label: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`relative aspect-square rounded-lg border-2 border-dashed flex flex-col items-center justify-center p-2 text-center transition ${
        selected
          ? "border-[#c9a962] bg-[#faf6ee] ring-2 ring-[#c9a962]/30"
          : "border-[#e8e2d9] hover:border-[#d4cfc6]"
      }`}
    >
      <ImageOffPlaceholder />
      <span className="text-[10px] text-[#5c534a] mt-2 leading-tight">
        {label}
      </span>
      {selected && <MenuBadge />}
    </button>
  );
}

function ImageGalleryCard({
  image,
  selected,
  onSelect,
  onDelete,
}: {
  image: ProductImage;
  selected: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className={`relative aspect-square rounded-lg overflow-hidden border-2 transition ${
        selected
          ? "border-[#c9a962] ring-2 ring-[#c9a962]/30"
          : "border-[#e8e2d9]"
      }`}
    >
      <button type="button" onClick={onSelect} className="absolute inset-0">
        <Image
          src={image.url}
          alt=""
          fill
          className="object-cover"
          unoptimized
        />
      </button>
      <span
        className={`absolute top-1 left-1 text-[9px] px-1 rounded font-medium ${
          image.kind === "enhanced"
            ? "bg-[#c9a962] text-[#1a1612]"
            : "bg-white/90 text-[#1a1612] border border-[#e8e2d9]"
        }`}
      >
        {image.kind}
      </span>
      {selected && <MenuBadge />}
      <div className="absolute top-1 right-1 flex gap-1">
        <a
          href={image.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="p-1 rounded bg-white/90 border border-[#e8e2d9] text-[#1a1612]"
        >
          <ExternalLink size={10} />
        </a>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="p-1 rounded bg-white/90 border border-[#e8e2d9] text-red-600"
        >
          <Trash2 size={10} />
        </button>
      </div>
      <label className="absolute bottom-0 inset-x-0 bg-black/50 text-white text-[10px] py-1 flex items-center justify-center gap-1 cursor-pointer">
        <input
          type="radio"
          name="menu-display"
          checked={selected}
          onChange={onSelect}
          className="accent-[#c9a962]"
        />
        On menu
      </label>
    </div>
  );
}

function MenuBadge() {
  return (
    <span className="absolute bottom-8 left-1/2 -translate-x-1/2 text-[9px] bg-[#1a1612] text-white px-1.5 py-0.5 rounded font-medium">
      menu
    </span>
  );
}

function ImageOffPlaceholder() {
  return (
    <div className="w-10 h-10 rounded-full bg-[#f0ebe3] flex items-center justify-center text-[#9a8f82] text-lg">
      ∅
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