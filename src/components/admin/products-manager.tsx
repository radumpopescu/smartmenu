"use client";

import type { Category } from "@/db/schema";
import {
  getAdminPreviewImageUrl,
  type MenuItemWithImages,
} from "@/lib/product-image-display";
import { formatPrice, parseTags } from "@/lib/utils";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  Sparkles,
  Upload,
  Trash2,
  Copy,
  Check,
  ExternalLink,
  ImagePlus,
  MoreVertical,
  Search,
  ImageOff,
} from "lucide-react";
import { ProductEditModal } from "@/components/admin/product-edit-modal";

type Props = {
  initialCategories: Category[];
  initialItems: MenuItemWithImages[];
  currency: string;
  dishEnhancementPrompt: string;
  dishEnhancementSource: string;
};

export function ProductsManager({
  initialCategories,
  initialItems,
  currency,
  dishEnhancementPrompt,
  dishEnhancementSource,
}: Props) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [enhancingId, setEnhancingId] = useState<string | null>(null);
  const [uploadingEnhancedId, setUploadingEnhancedId] = useState<string | null>(
    null
  );
  const [provider, setProvider] = useState<"nano-banana" | "openai">(
    "nano-banana"
  );
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [apiMode, setApiMode] = useState(false);
  const [search, setSearch] = useState("");
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [manualPanelId, setManualPanelId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const editingItem = editingId
    ? items.find((i) => i.id === editingId)
    : undefined;

  const categoryMap = Object.fromEntries(
    initialCategories.map((c) => [c.id, c.name])
  );

  const filteredItems = items.filter((item) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    const cat = item.categoryId
      ? (categoryMap[item.categoryId] ?? "").toLowerCase()
      : "";
    return (
      item.name.toLowerCase().includes(q) ||
      cat.includes(q) ||
      (item.description?.toLowerCase().includes(q) ?? false)
    );
  });

  useEffect(() => {
    function onPointerDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenuId(null);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  async function uploadPhoto(itemId: string, file: File) {
    const form = new FormData();
    form.append("image", file);
    const res = await fetch(`/api/products/${itemId}/upload`, {
      method: "POST",
      body: form,
    });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Upload failed");
      return;
    }
    const { item } = await res.json();
    setItems((prev) => prev.map((i) => (i.id === itemId ? item : i)));
    setOpenMenuId(null);
    router.refresh();
  }

  async function uploadEnhanced(itemId: string, file: File) {
    setUploadingEnhancedId(itemId);
    setError("");
    const form = new FormData();
    form.append("image", file);
    const res = await fetch(`/api/products/${itemId}/enhanced`, {
      method: "POST",
      body: form,
    });
    setUploadingEnhancedId(null);
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Upload failed");
      return;
    }
    const { item } = await res.json();
    setItems((prev) => prev.map((i) => (i.id === itemId ? item : i)));
    setOpenMenuId(null);
    router.refresh();
  }

  async function deleteImage(itemId: string, imageId: string) {
    const res = await fetch(`/api/products/${itemId}/images/${imageId}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Delete failed");
      return;
    }
    const { item } = await res.json();
    setItems((prev) => prev.map((i) => (i.id === itemId ? item : i)));
    router.refresh();
  }

  async function setDisplayImage(
    itemId: string,
    displayImageId: string | null
  ) {
    const res = await fetch(`/api/products/${itemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayImageId }),
    });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Could not update menu photo");
      return;
    }
    const { item } = await res.json();
    setItems((prev) => prev.map((i) => (i.id === itemId ? item : i)));
  }

  async function enhance(itemId: string, sourceImageId?: string) {
    setEnhancingId(itemId);
    setError("");
    const res = await fetch(`/api/products/${itemId}/enhance`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider, sourceImageId }),
    });
    setEnhancingId(null);
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Enhancement failed");
      return;
    }
    const { item } = await res.json();
    setItems((prev) => prev.map((i) => (i.id === itemId ? item : i)));
    setOpenMenuId(null);
    router.refresh();
  }

  async function remove(itemId: string) {
    if (!confirm("Delete this item?")) return;
    await fetch(`/api/products/${itemId}`, { method: "DELETE" });
    setItems((prev) => prev.filter((i) => i.id !== itemId));
    setOpenMenuId(null);
    setEditingId((id) => (id === itemId ? null : id));
    router.refresh();
  }

  async function saveProduct(
    itemId: string,
    data: {
      name: string;
      description: string | null;
      categoryId: string | null;
      priceCents: number | null;
      priceLabel: string | null;
      tags: string[];
      published: boolean;
      sortOrder: number;
    }
  ) {
    setSavingId(itemId);
    setError("");
    const res = await fetch(`/api/products/${itemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    setSavingId(null);
    if (!res.ok) {
      const body = await res.json();
      setError(body.error ?? "Save failed");
      return;
    }
    const { item } = await res.json();
    setItems((prev) => prev.map((i) => (i.id === itemId ? item : i)));
    setEditingId(null);
    router.refresh();
  }

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(dishEnhancementPrompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Could not copy — select and copy the prompt below.");
    }
  }

  return (
    <div className="space-y-4">
      <details className="bg-white rounded-xl border border-[#e8e2d9]">
        <summary className="px-4 py-3 text-sm font-medium text-[#1a1612] cursor-pointer">
          Photo enhancement guide
        </summary>
        <div className="px-4 pb-4 border-t border-[#f0ebe3] text-sm text-[#5c534a] space-y-3">
          <p>
            Copy the prompt → Gemini → upload result per product via the ⋮ menu.
          </p>
          <button
            type="button"
            onClick={copyPrompt}
            className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#1a1612] text-white text-xs rounded-lg"
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? "Copied!" : "Copy prompt"}
          </button>
          <details>
            <summary className="text-xs text-[#9a8f82] cursor-pointer">
              Preview · {dishEnhancementSource}
            </summary>
            <pre className="mt-2 p-2 bg-[#f8f6f3] rounded text-xs max-h-32 overflow-y-auto whitespace-pre-wrap">
              {dishEnhancementPrompt}
            </pre>
          </details>
        </div>
      </details>

      <details
        className="bg-[#f8f6f3] rounded-lg border border-[#e8e2d9]"
        onToggle={(e) =>
          setApiMode((e.currentTarget as HTMLDetailsElement).open)
        }
      >
        <summary className="px-4 py-2 text-sm text-[#5c534a] cursor-pointer">
          Optional: API auto-enhance (uses tokens)
        </summary>
        <div className="px-4 pb-3 flex items-center gap-2">
          <select
            value={provider}
            onChange={(e) =>
              setProvider(e.target.value as "nano-banana" | "openai")
            }
            className="text-xs border border-[#e8e2d9] rounded-lg px-2 py-1 bg-white"
          >
            <option value="nano-banana">Nano Banana</option>
            <option value="openai">OpenAI</option>
          </select>
        </div>
      </details>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg p-3">{error}</p>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
        <div className="relative flex-1 max-w-md">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9a8f82]"
          />
          <input
            type="search"
            placeholder="Search products…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-[#e8e2d9] bg-white focus:outline-none focus:ring-2 focus:ring-[#c9a962]/40"
          />
        </div>
        <p className="text-xs text-[#9a8f82] shrink-0">
          {filteredItems.length} of {items.length} products
        </p>
      </div>

      {items.length === 0 ? (
        <p className="text-[#9a8f82] text-sm">
          No items yet. Import a menu from the Import page.
        </p>
      ) : filteredItems.length === 0 ? (
        <p className="text-[#9a8f82] text-sm">No products match your search.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {filteredItems.map((item) => (
            <ProductGridCard
              key={item.id}
              item={item}
              categoryName={
                item.categoryId
                  ? categoryMap[item.categoryId]
                  : "Uncategorized"
              }
              currency={currency}
              displayUrl={getAdminPreviewImageUrl(item, item.images)}
              imageCount={item.images.length}
              hasOriginal={
                item.images.some((i) => i.kind === "original") ||
                !!item.originalImageUrl
              }
              isMenuOpen={openMenuId === item.id}
              isManualOpen={manualPanelId === item.id}
              isEnhancing={enhancingId === item.id}
              isUploadingEnhanced={uploadingEnhancedId === item.id}
              apiMode={apiMode}
              copied={copied}
              menuRef={openMenuId === item.id ? menuRef : undefined}
              onOpen={() => {
                setEditingId(item.id);
                setOpenMenuId(null);
              }}
              onToggleMenu={() =>
                setOpenMenuId((id) => (id === item.id ? null : item.id))
              }
              onToggleManual={() => {
                setManualPanelId((id) => (id === item.id ? null : item.id));
                setOpenMenuId(null);
              }}
              onUploadPhoto={(f) => uploadPhoto(item.id, f)}
              onUploadEnhanced={(f) => uploadEnhanced(item.id, f)}
              onEnhance={() => enhance(item.id)}
              onDelete={() => remove(item.id)}
              onCopyPrompt={copyPrompt}
            />
          ))}
        </div>
      )}

      {editingItem && (
        <ProductEditModal
          item={editingItem}
          categories={initialCategories}
          currency={currency}
          apiMode={apiMode}
          copied={copied}
          enhancing={enhancingId === editingItem.id}
          uploadingEnhanced={uploadingEnhancedId === editingItem.id}
          saving={savingId === editingItem.id}
          onClose={() => setEditingId(null)}
          onSave={(data) => saveProduct(editingItem.id, data)}
          onUploadPhoto={(f) => uploadPhoto(editingItem.id, f)}
          onUploadEnhanced={(f) => uploadEnhanced(editingItem.id, f)}
          onDeleteImage={(imageId) => deleteImage(editingItem.id, imageId)}
          onSetDisplayImage={(displayImageId) =>
            setDisplayImage(editingItem.id, displayImageId)
          }
          onEnhance={(sourceImageId) =>
            enhance(editingItem.id, sourceImageId)
          }
          onDelete={() => remove(editingItem.id)}
          onCopyPrompt={copyPrompt}
        />
      )}

      {manualPanelId && (
        <ManualEnhancePanel
          item={items.find((i) => i.id === manualPanelId)!}
          copied={copied}
          uploading={uploadingEnhancedId === manualPanelId}
          onClose={() => setManualPanelId(null)}
          onCopyPrompt={copyPrompt}
          onUploadEnhanced={(f) => uploadEnhanced(manualPanelId, f)}
        />
      )}
    </div>
  );
}

function ProductGridCard({
  item,
  categoryName,
  currency,
  displayUrl,
  imageCount,
  hasOriginal,
  isMenuOpen,
  isManualOpen,
  isEnhancing,
  isUploadingEnhanced,
  apiMode,
  copied,
  menuRef,
  onOpen,
  onToggleMenu,
  onToggleManual,
  onUploadPhoto,
  onUploadEnhanced,
  onEnhance,
  onDelete,
  onCopyPrompt,
}: {
  item: MenuItemWithImages;
  categoryName: string;
  currency: string;
  displayUrl: string | null;
  imageCount: number;
  hasOriginal: boolean;
  isMenuOpen: boolean;
  isManualOpen: boolean;
  isEnhancing: boolean;
  isUploadingEnhanced: boolean;
  apiMode: boolean;
  copied: boolean;
  menuRef?: React.RefObject<HTMLDivElement | null>;
  onOpen: () => void;
  onToggleMenu: () => void;
  onToggleManual: () => void;
  onUploadPhoto: (f: File) => void;
  onUploadEnhanced: (f: File) => void;
  onEnhance: () => void;
  onDelete: () => void;
  onCopyPrompt: () => void;
}) {
  const uploadOriginalRef = useRef<HTMLInputElement>(null);
  const uploadEnhancedRef = useRef<HTMLInputElement>(null);
  const tags = parseTags(item.tags);

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      className={`relative bg-white rounded-lg border transition-shadow cursor-pointer ${
        isManualOpen
          ? "border-[#c9a962] ring-1 ring-[#c9a962]/30"
          : "border-[#e8e2d9] hover:border-[#d4cfc6] hover:shadow-sm"
      }`}
    >
      <div className="relative aspect-square bg-[#f0ebe3] rounded-t-lg overflow-hidden">
        {displayUrl ? (
          <Image
            src={displayUrl}
            alt={item.name}
            fill
            className="object-cover"
            sizes="120px"
            unoptimized
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-[#9a8f82]">
            <ImageOff size={20} />
            <span className="text-[10px] mt-1">No photo</span>
          </div>
        )}
        {item.displayImageId && (
          <span className="absolute top-1 left-1 text-[9px] bg-[#1a1612] text-white px-1 rounded font-medium">
            menu
          </span>
        )}
        {imageCount > 1 && (
          <span className="absolute bottom-1 left-1 text-[9px] bg-white/90 text-[#1a1612] px-1 rounded font-medium border border-[#e8e2d9]">
            {imageCount} photos
          </span>
        )}
        <div
          className="absolute top-1 right-1"
          ref={menuRef}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={onToggleMenu}
            className="p-1 rounded-md bg-white/90 border border-[#e8e2d9] shadow-sm hover:bg-white text-[#1a1612]"
            aria-label="Actions"
          >
            <MoreVertical size={14} />
          </button>
          {isMenuOpen && (
            <div
              className="absolute right-0 top-full mt-1 z-30 w-44 py-1 bg-white rounded-lg border border-[#e8e2d9] shadow-lg text-xs"
              onClick={(e) => e.stopPropagation()}
            >
              <MenuButton
                label="Edit details…"
                onClick={onOpen}
              />
              <div className="border-t border-[#f0ebe3] my-1" />
              <MenuButton
                icon={Upload}
                label="Upload original"
                onClick={() => uploadOriginalRef.current?.click()}
              />
              {hasOriginal && (
                <a
                  href={
                    item.images.find((i) => i.kind === "original")?.url ??
                    item.originalImageUrl!
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-3 py-2 hover:bg-[#f8f6f3] text-[#1a1612]"
                  onClick={onToggleMenu}
                >
                  <ExternalLink size={14} />
                  Open original
                </a>
              )}
              <MenuButton
                icon={ImagePlus}
                label="Enhance photo…"
                onClick={onToggleManual}
                active={isManualOpen}
              />
              <MenuButton
                icon={Copy}
                label={copied ? "Prompt copied" : "Copy prompt"}
                onClick={() => {
                  onCopyPrompt();
                  onToggleMenu();
                }}
              />
              <MenuButton
                icon={ImagePlus}
                label={
                  isUploadingEnhanced ? "Uploading…" : "Upload enhanced"
                }
                onClick={() => uploadEnhancedRef.current?.click()}
              />
              {apiMode && hasOriginal && (
                <MenuButton
                  icon={Sparkles}
                  label={isEnhancing ? "Enhancing…" : "API enhance"}
                  onClick={onEnhance}
                  disabled={isEnhancing}
                />
              )}
              <div className="border-t border-[#f0ebe3] my-1" />
              <MenuButton
                icon={Trash2}
                label="Delete"
                onClick={onDelete}
                className="text-red-600 hover:bg-red-50"
              />
            </div>
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

      <div className="p-2 space-y-0.5">
        <p className="text-[10px] text-[#9a8f82] uppercase tracking-wide truncate">
          {categoryName}
        </p>
        <h3 className="text-xs font-medium text-[#1a1612] leading-snug line-clamp-2 min-h-[2.5em]">
          {item.name}
        </h3>
        <p className="text-xs text-[#c9a962] font-medium">
          {formatPrice(item.priceCents, item.priceLabel, currency) || "—"}
        </p>
        {tags.length > 0 && (
          <p className="text-[9px] text-[#9a8f82] truncate">{tags.join(" · ")}</p>
        )}
      </div>
    </article>
  );
}

function MenuButton({
  icon: Icon,
  label,
  onClick,
  disabled,
  active,
  className = "",
}: {
  icon?: React.ComponentType<{ size?: number }>;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-[#f8f6f3] disabled:opacity-50 ${
        active ? "bg-[#faf6ee] text-[#1a1612]" : "text-[#1a1612]"
      } ${className}`}
    >
      {Icon && <Icon size={14} />}
      {label}
    </button>
  );
}

function ManualEnhancePanel({
  item,
  copied,
  uploading,
  onClose,
  onCopyPrompt,
  onUploadEnhanced,
}: {
  item: MenuItemWithImages;
  copied: boolean;
  uploading: boolean;
  onClose: () => void;
  onCopyPrompt: () => void;
  onUploadEnhanced: (f: File) => void;
}) {
  const uploadRef = useRef<HTMLInputElement>(null);

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 p-4 sm:p-6 pointer-events-none">
      <div className="pointer-events-auto max-w-lg mx-auto bg-white rounded-xl border border-[#e8e2d9] shadow-xl p-4">
        <div className="flex justify-between items-start gap-2 mb-3">
          <div>
            <p className="text-xs text-[#9a8f82]">Enhance photo</p>
            <p className="font-medium text-[#1a1612]">{item.name}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-xs text-[#9a8f82] hover:text-[#1a1612]"
          >
            Close
          </button>
        </div>
        <p className="text-xs text-[#5c534a] mb-3">
          Run the prompt in Gemini, then upload the result here.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onCopyPrompt}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs border rounded-lg"
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            Copy prompt
          </button>
          <button
            type="button"
            onClick={() => uploadRef.current?.click()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs bg-[#c9a962] text-[#1a1612] rounded-lg font-medium"
          >
            <ImagePlus size={14} />
            {uploading ? "Uploading…" : "Upload enhanced"}
          </button>
        </div>
        <input
          ref={uploadRef}
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
  );
}