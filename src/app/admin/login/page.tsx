"use client";

import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

type DevUser = {
  id: string;
  email: string;
  name: string | null;
  role: string;
};

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/admin";
  const isDev = process.env.NODE_ENV === "development";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [devUsers, setDevUsers] = useState<DevUser[]>([]);
  const [devUserId, setDevUserId] = useState("");

  useEffect(() => {
    if (!isDev) return;
    fetch("/api/dev/users")
      .then((r) => r.json())
      .then((d) => {
        setDevUsers(d.users ?? []);
        if (d.users?.[0]) setDevUserId(d.users[0].id);
      })
      .catch(() => {});
  }, [isDev]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setLoading(false);
    if (result?.error) {
      setError("Invalid email or password");
      return;
    }
    router.push(callbackUrl);
    router.refresh();
  }

  async function handleDevLogin() {
    if (!devUserId) return;
    setLoading(true);
    setError("");

    const result = await signIn("dev-login", {
      userId: devUserId,
      redirect: false,
    });

    setLoading(false);
    if (result?.error) {
      setError("Dev login failed");
      return;
    }
    router.push(callbackUrl);
    router.refresh();
  }

  return (
    <main className="min-h-screen bg-[#f8f6f3] flex items-center justify-center px-6">
      <div className="w-full max-w-md bg-white rounded-2xl border border-[#e8e2d9] p-8 shadow-sm">
        <p className="text-xs tracking-widest uppercase text-[#9a8f82] mb-2">
          SmartMenu
        </p>
        <h1 className="font-[family-name:var(--font-display)] text-2xl text-[#1a1612] mb-6">
          Admin sign in
        </h1>

        {isDev && devUsers.length > 0 && (
          <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-xs font-medium text-amber-900 mb-2">
              Dev quick login
            </p>
            <select
              value={devUserId}
              onChange={(e) => setDevUserId(e.target.value)}
              className="w-full text-sm border border-amber-200 rounded-lg px-3 py-2 mb-2 bg-white"
            >
              {devUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.email} ({u.role})
                  {u.name ? ` — ${u.name}` : ""}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleDevLogin}
              disabled={loading}
              className="w-full py-2 text-sm bg-amber-800 text-white rounded-lg hover:bg-amber-900 disabled:opacity-50"
            >
              Sign in as selected user
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-[#5c534a] mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg border border-[#e8e2d9] focus:outline-none focus:ring-2 focus:ring-[#c9a962]/50"
              required
            />
          </div>
          <div>
            <label className="block text-sm text-[#5c534a] mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg border border-[#e8e2d9] focus:outline-none focus:ring-2 focus:ring-[#c9a962]/50"
              required
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-[#1a1612] text-white rounded-lg font-medium hover:bg-[#2d2620] disabled:opacity-50 transition"
          >
            {loading ? "Signing in…" : "Sign in with password"}
          </button>
        </form>
        <p className="mt-6 text-xs text-[#9a8f82] text-center">
          Superadmin: admin@example.com · Operator: operator@example.com (after
          seed, password changeme)
        </p>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}