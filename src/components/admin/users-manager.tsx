"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type UserRow = {
  id: string;
  email: string;
  name: string | null;
  role: string;
  storeIds: string[];
};

type StoreOption = { id: string; name: string };

export function UsersManager({
  initialUsers,
  stores,
}: {
  initialUsers: UserRow[];
  stores: StoreOption[];
}) {
  const router = useRouter();
  const [users, setUsers] = useState(initialUsers);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<"operator" | "superadmin">("operator");
  const [selectedStores, setSelectedStores] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function createUser(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        password,
        name: name || undefined,
        role,
        storeIds: role === "operator" ? selectedStores : [],
      }),
    });

    setLoading(false);
    if (!res.ok) {
      const data = await res.json();
      setError(typeof data.error === "string" ? data.error : "Failed");
      return;
    }

    const { user } = await res.json();
    setUsers((prev) =>
      [...prev, user].sort((a, b) => a.email.localeCompare(b.email))
    );
    setEmail("");
    setPassword("");
    setName("");
    setSelectedStores([]);
    router.refresh();
  }

  async function updateAssignments(userId: string, storeIds: string[]) {
    await fetch(`/api/users/${userId}/stores`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ storeIds }),
    });
    setUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, storeIds } : u))
    );
    router.refresh();
  }

  return (
    <div className="space-y-8">
      <form
        onSubmit={createUser}
        className="bg-white rounded-xl border border-[#e8e2d9] p-6 space-y-4 max-w-xl"
      >
        <h2 className="font-medium text-[#1a1612]">Create user</h2>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full px-4 py-2.5 rounded-lg border border-[#e8e2d9]"
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full px-4 py-2.5 rounded-lg border border-[#e8e2d9]"
          required
        />
        <input
          placeholder="Name (optional)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full px-4 py-2.5 rounded-lg border border-[#e8e2d9]"
        />
        <select
          value={role}
          onChange={(e) =>
            setRole(e.target.value as "operator" | "superadmin")
          }
          className="w-full px-4 py-2.5 rounded-lg border border-[#e8e2d9]"
        >
          <option value="operator">Store operator</option>
          <option value="superadmin">Superadmin</option>
        </select>
        {role === "operator" && (
          <div className="space-y-2">
            <p className="text-sm text-[#5c534a]">Assign stores</p>
            {stores.map((s) => (
              <label key={s.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={selectedStores.includes(s.id)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedStores((prev) => [...prev, s.id]);
                    } else {
                      setSelectedStores((prev) =>
                        prev.filter((id) => id !== s.id)
                      );
                    }
                  }}
                />
                {s.name}
              </label>
            ))}
          </div>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="px-6 py-2.5 bg-[#1a1612] text-white rounded-lg text-sm disabled:opacity-50"
        >
          {loading ? "Creating…" : "Create user"}
        </button>
      </form>

      <div className="space-y-4">
        {users.map((u) => (
          <div
            key={u.id}
            className="bg-white rounded-xl border border-[#e8e2d9] p-5"
          >
            <div className="flex justify-between items-start gap-4 mb-3">
              <div>
                <p className="font-medium">{u.email}</p>
                <p className="text-xs text-[#9a8f82]">
                  {u.role}
                  {u.name ? ` · ${u.name}` : ""}
                </p>
              </div>
            </div>
            {u.role === "operator" && (
              <div className="space-y-2">
                <p className="text-xs text-[#5c534a]">Store access</p>
                {stores.map((s) => (
                  <label key={s.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={u.storeIds.includes(s.id)}
                      onChange={(e) => {
                        const next = e.target.checked
                          ? [...u.storeIds, s.id]
                          : u.storeIds.filter((id) => id !== s.id);
                        updateAssignments(u.id, next);
                      }}
                    />
                    {s.name}
                  </label>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}