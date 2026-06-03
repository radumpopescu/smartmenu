"use client";

import type { Category, MenuItem } from "@/db/schema";
import { formatPrice, parseTags } from "@/lib/utils";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  Sparkles,
  Upload,
  Trash2,
  Copy,
  Check,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  ImagePlus,
} from "lucide-react";

type Props = {
  initialCategories: Category[];
  initialItems: MenuItem[];
  dishEnhancementPrompt: string;
  dishEnhancementSource: string;
};

export function ProductsManager({
  initialCategories,
  initialItems,
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
  const [expandedManual, setExpandedManual] = useState<string | null>(null);
  const [apiMode, setApiMode] = useState(false);

  const categoryMap = Object.fromEntries(
    initialCategories.map((c) => [c.id, c.name])
  );

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

  async function clearEnhanced(itemId: string) {
    const res = await fetch(`/api/products/${itemId}/enhanced`, {
      method: "DELETE",
    });
    if (!res.ok) return;
    const { item } = await res.json();
    setItems((prev) => prev.map((i) => (i.id === itemId ? item : i)));
    router.refresh();
  }

  async function enhance(itemId: string) {
    setEnhancingId(itemId);
    setError("");
    const res = await fetch(`/api/products/${itemId}/enhance`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider }),
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
      <div className="bg-white rounded-xl border border-[#e8e2d9] p-5">
        <h2 className="font-medium text-[#1a1612] mb-1">
          Enhance photos manually (no API tokens)
        </h2>
        <p className="text-sm text-[#5c534a] mb-4">
          Copy the prompt, run it in Gemini (or another tool) with your dish
          photo, then upload the result for each product below.
        </p>
        <ol className="text-sm text-[#5c534a] space-y-1.5 mb-4 list-decimal list-inside">
          <li>Upload an original dish photo on a product</li>
          <li>Copy the enhancement prompt</li>
          <li>
            Open{" "}
            <a
              href="https://gemini.google.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#1a1612] underline underline-offset-2"
            >
              Gemini
            </a>{" "}
            (or your preferred editor), attach the original, paste the prompt
          </li>
          <li>Download the result and use &ldquo;Upload enhanced&rdquo; on that product</li>
        </ol>
        <button
          type="button"
          onClick={copyPrompt}
          className="inline-flex items-center gap-2 px-4 py-2 bg-[#1a1612] text-white text-sm rounded-lg hover:bg-[#2d2620] transition"
        >
          {copied ? <Check size={16} /> : <Copy size={16} />}
          {copied ? "Copied!" : "Copy enhancement prompt"}
        </button>
        <p className="mt-3 text-xs text-[#9a8f82]">
          Loaded from <code>{dishEnhancementSource}</code>
        </p>
        <details className="mt-2">
          <summary className="text-xs text-[#9a8f82] cursor-pointer hover:text-[#5c534a]">
            Preview prompt
          </summary>
          <pre className="mt-2 p-3 bg-[#f8f6f3] rounded-lg text-xs text-[#5c534a] whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">
            {dishEnhancementPrompt}
          </pre>
        </details>
      </div>

      <details
        className="bg-[#f8f6f3] rounded-lg border border-[#e8e2d9]"
        onToggle={(e) =>
          setApiMode((e.currentTarget as HTMLDetailsElement).open)
        }
      >
        <summary className="px-4 py-3 text-sm text-[#5c534a] cursor-pointer hover:text-[#1a1612]">
          Optional: auto-enhance via API (uses tokens)
        </summary>
        <div className="px-4 pb-4 flex flex-wrap items-center gap-3">
          <span className="text-sm text-[#5c534a]">Provider:</span>
          <select
            value={provider}
            onChange={(e) =>
              setProvider(e.target.value as "nano-banana" | "openai")
            }
            className="text-sm border border-[#e8e2d9] rounded-lg px-3 py-1.5 bg-white"
          >
            <option value="nano-banana">Nano Banana (Gemini)</option>
            <option value="openai">OpenAI</option>
          </select>
          <p className="text-xs text-[#9a8f82] w-full">
            Enables &ldquo;API enhance&rdquo; on each product. Requires API keys
            in .env.
          </p>
        </div>
      </details>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg p-3">{error}</p>
      )}

      {items.length === 0 ? (
        <p className="text-[#9a8f82]">
          No items yet. Import a menu from the Import page.
        </p>
      ) : (
        <div className="grid gap-4">
          {items.map((item) => {
            const displayUrl =
              item.enhancedImageUrl ?? item.originalImageUrl ?? null;
            const manualOpen = expandedManual === item.id;

            return (
              <article
                key={item.id}
                className="bg-white rounded-xl border border-[#e8e2d9] p-5"
              >
                <div className="flex flex-col md:flex-row gap-5">
                  <div className="flex gap-3 shrink-0">
                    {displayUrl ? (
                      <div className="relative w-28 h-28 rounded-lg overflow-hidden bg-[#f0ebe3]">
                        <Image
                          src={displayUrl}
                          alt={item.name}
                          fill
                          className="object-cover"
                          unoptimized
                        />
                        {item.enhancedImageUrl && (
                          <span className="absolute top-1 left-1 text-[10px] bg-[#c9a962] text-[#1a1612] px-1 rounded font-medium">
                            enhanced
                          </span>
                        )}
                      </div>
                    ) : (
                      <div className="w-28 h-28 rounded-lg bg-[#f0ebe3] flex items-center justify-center text-xs text-[#9a8f82] text-center px-2">
                        No photo
                      </div>
                    )}
                    {item.originalImageUrl && item.enhancedImageUrl && (
                      <div className="relative w-28 h-28 rounded-lg overflow-hidden bg-[#f0ebe3]">
                        <Image
                          src={item.originalImageUrl}
                          alt="Original"
                          fill
                          className="object-cover"
                          unoptimized
                        />
                        <span className="absolute bottom-1 left-1 text-[10px] bg-black/60 text-white px-1 rounded">
                          original
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between gap-2">
                      <div>
                        <p className="text-xs text-[#9a8f82] uppercase tracking-wide">
                          {item.categoryId
                            ? categoryMap[item.categoryId]
                            : "Uncategorized"}
                        </p>
                        <h2 className="font-medium text-[#1a1612] text-lg">
                          {item.name}
                        </h2>
                      </div>
                      <span className="text-[#c9a962] font-medium shrink-0">
                        {formatPrice(item.priceCents, item.priceLabel)}
                      </span>
                    </div>
                    {item.description && (
                      <p className="text-sm text-[#5c534a] mt-1 line-clamp-2">
                        {item.description}
                      </p>
                    )}
                    {parseTags(item.tags).length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {parseTags(item.tags).map((tag) => (
                          <span
                            key={tag}
                            className="text-[10px] uppercase tracking-wide px-2 py-0.5 bg-[#f0ebe3] rounded-full text-[#5c534a]"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="flex flex-wrap gap-2 mt-4">
                      <label className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs border border-[#e8e2d9] rounded-lg cursor-pointer hover:bg-[#f8f6f3]">
                        <Upload size={14} />
                        Original photo
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) uploadPhoto(item.id, f);
                          }}
                        />
                      </label>

                      {item.originalImageUrl && (
                        <a
                          href={item.originalImageUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs border border-[#e8e2d9] rounded-lg hover:bg-[#f8f6f3]"
                        >
                          <ExternalLink size={14} />
                          Open original
                        </a>
                      )}

                      <button
                        type="button"
                        onClick={() =>
                          setExpandedManual(manualOpen ? null : item.id)
                        }
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs border border-[#c9a962] text-[#1a1612] rounded-lg hover:bg-[#faf6ee]"
                      >
                        {manualOpen ? (
                          <ChevronUp size={14} />
                        ) : (
                          <ChevronDown size={14} />
                        )}
                        Manual enhance
                      </button>

                      {apiMode && item.originalImageUrl && (
                        <button
                          type="button"
                          onClick={() => enhance(item.id)}
                          disabled={enhancingId === item.id}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs bg-[#1a1612] text-white rounded-lg disabled:opacity-40"
                        >
                          <Sparkles size={14} />
                          {enhancingId === item.id ? "Enhancing…" : "API enhance"}
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => remove(item.id)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 rounded-lg"
                      >
                        <Trash2 size={14} />
                        Delete
                      </button>
                    </div>

                    {manualOpen && (
                      <div className="mt-4 p-4 bg-[#f8f6f3] rounded-lg border border-[#e8e2d9] space-y-3">
                        <p className="text-xs text-[#5c534a]">
                          After enhancing in Gemini, upload the result here. The
                          public menu uses the enhanced image when set.
                        </p>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={copyPrompt}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs border border-[#e8e2d9] rounded-lg bg-white hover:bg-[#f0ebe3]"
                          >
                            {copied ? <Check size={14} /> : <Copy size={14} />}
                            Copy prompt
                          </button>
                          <label className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs bg-[#c9a962] text-[#1a1612] rounded-lg cursor-pointer font-medium hover:bg-[#d4b872]">
                            <ImagePlus size={14} />
                            {uploadingEnhancedId === item.id
                              ? "Uploading…"
                              : "Upload enhanced"}
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f) uploadEnhanced(item.id, f);
                                e.target.value = "";
                              }}
                            />
                          </label>
                          {item.enhancedImageUrl && (
                            <button
                              type="button"
                              onClick={() => clearEnhanced(item.id)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-[#5c534a] hover:text-red-600"
                            >
                              Remove enhanced
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}