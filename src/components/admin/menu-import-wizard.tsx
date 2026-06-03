"use client";

import type { ExtractedMenu } from "@/lib/grok";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Upload, Check } from "lucide-react";

export function MenuImportWizard() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [extracted, setExtracted] = useState<ExtractedMenu | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [replaceExisting, setReplaceExisting] = useState(false);
  const [applying, setApplying] = useState(false);

  function onFileChange(f: File | null) {
    setFile(f);
    setExtracted(null);
    setError("");
    if (preview) URL.revokeObjectURL(preview);
    if (f) setPreview(URL.createObjectURL(f));
    else setPreview(null);
  }

  async function handleExtract() {
    if (!file) return;
    setLoading(true);
    setError("");

    const form = new FormData();
    form.append("image", file);

    const res = await fetch("/api/menu/import", { method: "POST", body: form });
    setLoading(false);

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Extraction failed");
      return;
    }

    const data = await res.json();
    setExtracted(data.extracted);
  }

  async function handleApply() {
    if (!extracted) return;
    setApplying(true);
    setError("");

    const res = await fetch("/api/menu/import/apply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ extracted, replaceExisting }),
    });

    setApplying(false);
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Import failed");
      return;
    }

    router.push("/admin/products");
    router.refresh();
  }

  const itemCount =
    extracted?.categories.reduce((n, c) => n + c.items.length, 0) ?? 0;

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-[#e8e2d9] p-6">
        <label className="flex flex-col items-center justify-center border-2 border-dashed border-[#e8e2d9] rounded-xl p-10 cursor-pointer hover:border-[#c9a962] transition">
          <Upload className="text-[#9a8f82] mb-3" size={32} />
          <span className="text-sm text-[#5c534a]">
            {file ? file.name : "Drop menu image or click to upload"}
          </span>
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
          />
        </label>
        {preview && (
          <img
            src={preview}
            alt="Menu preview"
            className="mt-4 max-h-64 mx-auto rounded-lg object-contain"
          />
        )}
        <button
          type="button"
          onClick={handleExtract}
          disabled={!file || loading}
          className="mt-4 w-full py-3 bg-[#1a1612] text-white rounded-lg text-sm font-medium disabled:opacity-50"
        >
          {loading ? "Extracting with Grok…" : "Extract menu"}
        </button>
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg p-3">{error}</p>
      )}

      {extracted && (
        <div className="bg-white rounded-xl border border-[#e8e2d9] p-6">
          <h2 className="font-medium text-[#1a1612] mb-4">
            Review ({itemCount} items)
          </h2>
          <div className="max-h-96 overflow-y-auto space-y-6 text-sm">
            {extracted.categories.map((cat, i) => (
              <div key={i}>
                <h3 className="text-[#c9a962] uppercase tracking-wider text-xs mb-2">
                  {cat.name}
                </h3>
                <ul className="space-y-2">
                  {cat.items.map((item, j) => (
                    <li
                      key={j}
                      className="flex justify-between gap-4 border-b border-[#f0ebe3] pb-2"
                    >
                      <div>
                        <p className="font-medium text-[#1a1612]">{item.name}</p>
                        {item.description && (
                          <p className="text-[#9a8f82]">{item.description}</p>
                        )}
                      </div>
                      <span className="text-[#5c534a] shrink-0">
                        {item.priceLabel ??
                          (item.priceCents != null
                            ? `$${(item.priceCents / 100).toFixed(2)}`
                            : "—")}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <label className="flex items-center gap-2 mt-4 text-sm text-[#5c534a]">
            <input
              type="checkbox"
              checked={replaceExisting}
              onChange={(e) => setReplaceExisting(e.target.checked)}
            />
            Replace existing menu (clears current items)
          </label>
          <button
            type="button"
            onClick={handleApply}
            disabled={applying}
            className="mt-4 w-full py-3 bg-[#c9a962] text-[#1a1612] rounded-lg text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Check size={18} />
            {applying ? "Importing…" : "Import to menu"}
          </button>
        </div>
      )}
    </div>
  );
}