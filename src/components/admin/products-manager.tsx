"use client";

import type { Category } from "@/db/schema";
import type { MenuItemWithImages } from "@/lib/product-image-display";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Copy, Check, Search } from "lucide-react";
import { ProductEditModal } from "@/components/admin/product-edit-modal";
import { ProductsCategoryBoard } from "@/components/admin/products-category-board";

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
  const [categories, setCategories] = useState(initialCategories);
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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  const editingItem = editingId
    ? items.find((i) => i.id === editingId)
    : undefined;

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
    router.refresh();
  }

  async function remove(itemId: string) {
    if (!confirm("Delete this item?")) return;
    await fetch(`/api/products/${itemId}`, { method: "DELETE" });
    setItems((prev) => prev.filter((i) => i.id !== itemId));
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
            Click a product to open it, copy the prompt, run it in Gemini, then
            upload the result in the modal.
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
          {items.length} products · {categories.length} categories
        </p>
      </div>

      {items.length === 0 ? (
        <p className="text-[#9a8f82] text-sm">
          No items yet. Import a menu from the Import page.
        </p>
      ) : (
        <ProductsCategoryBoard
          categories={categories}
          items={items}
          currency={currency}
          searchQuery={search}
          onCategoriesChange={setCategories}
          onItemsChange={setItems}
          onOpenProduct={setEditingId}
          onError={setError}
        />
      )}

      {editingItem && (
        <ProductEditModal
          item={editingItem}
          categories={categories}
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
    </div>
  );
}