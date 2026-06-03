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
    <aside className="w-56 shrink-0 border-r border-[#e8e2d9] bg-white sticky top-0 h-screen flex flex-col">
      <div className="p-4 pb-0">
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
      </div>

      <nav className="flex-1 min-h-0 overflow-y-auto px-4 py-2 space-y-1">
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

      <div className="shrink-0 border-t border-[#e8e2d9] p-4 space-y-1 bg-white">
        {activeSlug && (
          <a
            href={`/${activeSlug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-3 py-2 text-sm text-[#5c534a] hover:text-[#1a1612] rounded-lg hover:bg-[#f8f6f3]"
          >
            <ExternalLink size={16} />
            View public menu
          </a>
        )}
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/admin/login" })}
          className="flex w-full items-center gap-2 px-3 py-2 text-sm text-[#5c534a] hover:text-red-700 rounded-lg hover:bg-red-50"
        >
          <LogOut size={16} />
          Sign out
        </button>
      </div>
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