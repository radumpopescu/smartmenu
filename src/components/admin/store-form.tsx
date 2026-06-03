"use client";

import type { Store } from "@/db/schema";
import { SUPPORTED_CURRENCIES } from "@/lib/currency";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function StoreForm({ store }: { store: Store | null }) {
  const router = useRouter();
  const [name, setName] = useState(store?.name ?? "");
  const [slug, setSlug] = useState(store?.slug ?? "");
  const [tagline, setTagline] = useState(store?.tagline ?? "");
  const [description, setDescription] = useState(store?.description ?? "");
  const [accentColor, setAccentColor] = useState(
    store?.accentColor ?? "#c9a962"
  );
  const [currency, setCurrency] = useState(store?.currency ?? "RON");
  const [published, setPublished] = useState(store?.published ?? false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  if (!store) {
    return (
      <p className="text-[#5c534a]">
        Select a store from the sidebar, or ask a superadmin to assign you to one.
      </p>
    );
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage("");

    const res = await fetch("/api/store", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        slug,
        tagline,
        description,
        accentColor,
        currency,
        published,
      }),
    });

    setSaving(false);
    if (!res.ok) {
      const data = await res.json();
      setMessage(data.error ?? "Save failed");
      return;
    }
    setMessage("Saved");
    router.refresh();
  }

  return (
    <form
      onSubmit={handleSave}
      className="space-y-5 bg-white rounded-xl border border-[#e8e2d9] p-6"
    >
      <Field label="Store name">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full px-4 py-2.5 rounded-lg border border-[#e8e2d9] focus:outline-none focus:ring-2 focus:ring-[#c9a962]/40"
          required
        />
      </Field>
      <Field label="URL slug">
        <input
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          className="w-full px-4 py-2.5 rounded-lg border border-[#e8e2d9] focus:outline-none focus:ring-2 focus:ring-[#c9a962]/40"
          required
        />
      </Field>
      <Field label="Tagline">
        <input
          value={tagline}
          onChange={(e) => setTagline(e.target.value)}
          className="w-full px-4 py-2.5 rounded-lg border border-[#e8e2d9] focus:outline-none focus:ring-2 focus:ring-[#c9a962]/40"
        />
      </Field>
      <Field label="Description">
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full px-4 py-2.5 rounded-lg border border-[#e8e2d9] focus:outline-none focus:ring-2 focus:ring-[#c9a962]/40 min-h-[80px]"
          rows={3}
        />
      </Field>
      <Field label="Accent color">
        <input
          type="color"
          value={accentColor}
          onChange={(e) => setAccentColor(e.target.value)}
          className="h-10 w-20 rounded cursor-pointer"
        />
      </Field>
      <Field label="Currency">
        <select
          value={currency}
          onChange={(e) => setCurrency(e.target.value)}
          className="w-full px-4 py-2.5 rounded-lg border border-[#e8e2d9] focus:outline-none focus:ring-2 focus:ring-[#c9a962]/40"
        >
          {SUPPORTED_CURRENCIES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.label}
            </option>
          ))}
        </select>
        <p className="text-xs text-[#9a8f82] mt-1">
          Prices on the public menu and in admin use this currency. Default is lei.
        </p>
      </Field>
      <label className="flex items-center gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={published}
          onChange={(e) => setPublished(e.target.checked)}
          className="rounded"
        />
        <span className="text-sm text-[#1a1612]">Publish public menu</span>
      </label>
      {message && <p className="text-sm text-[#5c534a]">{message}</p>}
      <button
        type="submit"
        disabled={saving}
        className="px-6 py-2.5 bg-[#1a1612] text-white rounded-lg text-sm font-medium disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save"}
      </button>
    </form>
  );
}

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