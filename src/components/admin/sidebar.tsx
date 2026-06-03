"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Upload,
  UtensilsCrossed,
  Store,
  ExternalLink,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { signOut } from "next-auth/react";

const links = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/restaurant", label: "Restaurant", icon: Store },
  { href: "/admin/import", label: "Import menu", icon: Upload },
  { href: "/admin/products", label: "Products", icon: UtensilsCrossed },
];

export function AdminSidebar({ slug }: { slug?: string }) {
  const pathname = usePathname();

  return (
    <aside className="w-56 shrink-0 border-r border-[#e8e2d9] bg-white min-h-screen p-4 flex flex-col">
      <div className="mb-8 px-2">
        <p className="text-xs tracking-widest uppercase text-[#9a8f82]">
          SmartMenu
        </p>
        <p className="font-[family-name:var(--font-display)] text-lg text-[#1a1612]">
          Admin
        </p>
      </div>
      <nav className="flex-1 space-y-1">
        {links.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition",
              pathname === href
                ? "bg-[#1a1612] text-white"
                : "text-[#5c534a] hover:bg-[#f8f6f3]"
            )}
          >
            <Icon size={18} />
            {label}
          </Link>
        ))}
      </nav>
      {slug && (
        <a
          href={`/${slug}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-3 py-2 text-sm text-[#5c534a] hover:text-[#1a1612] mb-2"
        >
          <ExternalLink size={16} />
          View public menu
        </a>
      )}
      <button
        type="button"
        onClick={() => signOut({ callbackUrl: "/admin/login" })}
        className="flex items-center gap-2 px-3 py-2 text-sm text-[#9a8f82] hover:text-red-700"
      >
        <LogOut size={16} />
        Sign out
      </button>
    </aside>
  );
}