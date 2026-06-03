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
  Building2,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { signOut } from "next-auth/react";
import { StoreSwitcher } from "./store-switcher";
import type { Store as StoreType, UserRole } from "@/db/schema";

const storeLinks = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/store", label: "Store settings", icon: Store },
  { href: "/admin/import", label: "Import menu", icon: Upload },
  { href: "/admin/products", label: "Products", icon: UtensilsCrossed },
];

const superadminLinks = [
  { href: "/admin/stores", label: "All stores", icon: Building2 },
  { href: "/admin/users", label: "Users", icon: Users },
];

export function AdminSidebar({
  role,
  stores,
  activeStoreId,
  activeSlug,
}: {
  role: UserRole;
  stores: StoreType[];
  activeStoreId: string | null;
  activeSlug?: string;
}) {
  const pathname = usePathname();
  const isSuperadmin = role === "superadmin";
  const hasStore = !!activeStoreId;

  return (
    <aside className="w-56 shrink-0 border-r border-[#e8e2d9] bg-white min-h-screen p-4 flex flex-col">
      <div className="mb-4 px-2">
        <p className="text-xs tracking-widest uppercase text-[#9a8f82]">
          SmartMenu
        </p>
        <p className="font-[family-name:var(--font-display)] text-lg text-[#1a1612]">
          Admin
        </p>
        <p className="text-[10px] uppercase tracking-wide text-[#c9a962] mt-1">
          {role}
        </p>
      </div>

      <StoreSwitcher stores={stores} activeStoreId={activeStoreId} />

      <nav className="flex-1 space-y-1">
        {isSuperadmin &&
          superadminLinks.map(({ href, label, icon: Icon }) => (
            <NavLink
              key={href}
              href={href}
              label={label}
              Icon={Icon}
              active={pathname === href}
            />
          ))}

        {isSuperadmin && hasStore && (
          <div className="pt-3 pb-1 px-3 text-[10px] uppercase tracking-widest text-[#9a8f82]">
            Active store
          </div>
        )}

        {hasStore &&
          storeLinks.map(({ href, label, icon: Icon }) => (
            <NavLink
              key={href}
              href={href}
              label={label}
              Icon={Icon}
              active={pathname === href}
            />
          ))}

        {!hasStore && !isSuperadmin && (
          <p className="px-3 text-xs text-[#9a8f82]">
            No store access. Contact your administrator.
          </p>
        )}
      </nav>

      {activeSlug && (
        <a
          href={`/${activeSlug}`}
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

function NavLink({
  href,
  label,
  Icon,
  active,
}: {
  href: string;
  label: string;
  Icon: React.ComponentType<{ size?: number }>;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition",
        active
          ? "bg-[#1a1612] text-white"
          : "text-[#5c534a] hover:bg-[#f8f6f3]"
      )}
    >
      <Icon size={18} />
      {label}
    </Link>
  );
}