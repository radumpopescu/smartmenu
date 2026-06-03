"use client";

import type { Store } from "@/db/schema";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function StoreSwitcher({
  stores,
  activeStoreId,
}: {
  stores: Store[];
  activeStoreId: string | null;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  if (stores.length <= 1) {
    if (stores.length === 1) {
      return (
        <p className="px-2 text-xs text-[#5c534a] truncate" title={stores[0].name}>
          {stores[0].name}
        </p>
      );
    }
    return (
      <p className="px-2 text-xs text-[#9a8f82]">No store assigned</p>
    );
  }

  async function onChange(storeId: string) {
    setLoading(true);
    await fetch("/api/session/store", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ storeId }),
    });
    setLoading(false);
    router.refresh();
  }

  return (
    <select
      value={activeStoreId ?? ""}
      disabled={loading}
      onChange={(e) => onChange(e.target.value)}
      className="w-full mx-2 mb-4 text-sm border border-[#e8e2d9] rounded-lg px-2 py-2 bg-[#f8f6f3] text-[#1a1612]"
    >
      {stores.map((s) => (
        <option key={s.id} value={s.id}>
          {s.name}
        </option>
      ))}
    </select>
  );
}