"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type StoreRow = {
  id: string;
  name: string;
  slug: string;
  published: boolean;
};

export function StoresManager({ initialStores }: { initialStores: StoreRow[] }) {
  const router = useRouter();
  const [stores, setStores] = useState(initialStores);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function createStore(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/stores", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        slug: slug || undefined,
      }),
    });

    setLoading(false);
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Failed to create store");
      return;
    }

    const { store } = await res.json();
    setStores((prev) => [...prev, store].sort((a, b) => a.name.localeCompare(b.name)));
    setName("");
    setSlug("");
    router.refresh();
  }

  async function switchToStore(storeId: string) {
    await fetch("/api/session/store", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ storeId }),
    });
    router.push("/admin");
    router.refresh();
  }

  return (
    <div className="space-y-8 max-w-2xl">
      <form
        onSubmit={createStore}
        className="bg-white rounded-xl border border-[#e8e2d9] p-6 space-y-4"
      >
        <h2 className="font-medium text-[#1a1612]">Create store</h2>
        <input
          placeholder="Store name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full px-4 py-2.5 rounded-lg border border-[#e8e2d9]"
          required
        />
        <input
          placeholder="URL slug (optional)"
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          className="w-full px-4 py-2.5 rounded-lg border border-[#e8e2d9]"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="px-6 py-2.5 bg-[#1a1612] text-white rounded-lg text-sm disabled:opacity-50"
        >
          {loading ? "Creating…" : "Create store"}
        </button>
      </form>

      <div className="bg-white rounded-xl border border-[#e8e2d9] overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[#f8f6f3] text-left text-[#5c534a]">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Slug</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {stores.map((s) => (
              <tr key={s.id} className="border-t border-[#f0ebe3]">
                <td className="px-4 py-3 font-medium">{s.name}</td>
                <td className="px-4 py-3 text-[#5c534a]">/{s.slug}</td>
                <td className="px-4 py-3">
                  {s.published ? (
                    <span className="text-green-700">Published</span>
                  ) : (
                    <span className="text-[#9a8f82]">Draft</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    onClick={() => switchToStore(s.id)}
                    className="text-[#1a1612] hover:text-[#c9a962] underline text-xs"
                  >
                    Manage menu
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {stores.length === 0 && (
          <p className="p-6 text-[#9a8f82] text-sm">No stores yet.</p>
        )}
      </div>
    </div>
  );
}