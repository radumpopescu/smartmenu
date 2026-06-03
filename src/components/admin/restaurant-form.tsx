"use client";

import type { Restaurant } from "@/db/schema";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function RestaurantForm({
  restaurant,
}: {
  restaurant: Restaurant | null;
}) {
  const router = useRouter();
  const [name, setName] = useState(restaurant?.name ?? "");
  const [slug, setSlug] = useState(restaurant?.slug ?? "");
  const [tagline, setTagline] = useState(restaurant?.tagline ?? "");
  const [description, setDescription] = useState(restaurant?.description ?? "");
  const [accentColor, setAccentColor] = useState(
    restaurant?.accentColor ?? "#c9a962"
  );
  const [published, setPublished] = useState(restaurant?.published ?? false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage("");

    const res = await fetch("/api/restaurant", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        slug,
        tagline,
        description,
        accentColor,
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
    <form onSubmit={handleSave} className="space-y-5 bg-white rounded-xl border border-[#e8e2d9] p-6">
      <Field label="Restaurant name">
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
      <label className="flex items-center gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={published}
          onChange={(e) => setPublished(e.target.checked)}
          className="rounded"
        />
        <span className="text-sm text-[#1a1612]">Publish public menu</span>
      </label>
      {message && (
        <p className="text-sm text-[#5c534a]">{message}</p>
      )}
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