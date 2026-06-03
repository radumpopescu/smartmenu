import { requireAdminContext } from "@/lib/admin-context";
import { getFullMenuForAdmin } from "@/lib/stores";
import Link from "next/link";
import { Upload, UtensilsCrossed, Store, Eye, Building2, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export default async function AdminDashboardPage() {
  const admin = await requireAdminContext();

  const menu = admin.activeStoreId
    ? await getFullMenuForAdmin(admin.activeStoreId)
    : { categories: [], items: [] };

  const publishedCount = menu.items.filter((i) => i.published).length;
  const withImages = menu.items.filter(
    (i) => i.enhancedImageUrl || i.originalImageUrl
  ).length;

  return (
    <div>
      <h1 className="font-[family-name:var(--font-display)] text-3xl text-[#1a1612] mb-2">
        Dashboard
      </h1>
      <p className="text-[#5c534a] mb-8">
        {admin.activeStore
          ? `Managing ${admin.activeStore.name}`
          : admin.isSuperadmin
            ? "Select a store in the sidebar to manage its menu"
            : "Welcome"}
        {admin.user.role === "superadmin" && (
          <span className="ml-2 text-xs uppercase tracking-wide text-[#c9a962]">
            superadmin
          </span>
        )}
      </p>

      {admin.activeStoreId && (
        <>
          <div className="grid sm:grid-cols-3 gap-4 mb-10">
            <StatCard label="Menu items" value={menu.items.length} />
            <StatCard label="Published" value={publishedCount} />
            <StatCard label="With photos" value={withImages} />
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <ActionCard
              href="/admin/store"
              icon={Store}
              title="Store settings"
              description="Name, slug, publish settings"
            />
            <ActionCard
              href="/admin/import"
              icon={Upload}
              title="Import menu"
              description="Upload a photo — Grok extracts items"
            />
            <ActionCard
              href="/admin/products"
              icon={UtensilsCrossed}
              title="Products"
              description="Edit dishes and enhance photos"
            />
            {admin.activeStore?.published && (
              <ActionCard
                href={`/${admin.activeStore.slug}`}
                icon={Eye}
                title="Public menu"
                description="Open live menu in new tab"
                external
              />
            )}
          </div>
        </>
      )}

      {admin.isSuperadmin && (
        <div className="mt-10 grid sm:grid-cols-2 gap-4">
          <h2 className="sm:col-span-2 font-medium text-[#1a1612]">
            Platform administration
          </h2>
          <ActionCard
            href="/admin/stores"
            icon={Building2}
            title="All stores"
            description="Create stores and manage the platform"
          />
          <ActionCard
            href="/admin/users"
            icon={Users}
            title="Users"
            description="Create accounts and assign stores"
          />
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white rounded-xl border border-[#e8e2d9] p-5">
      <p className="text-sm text-[#9a8f82]">{label}</p>
      <p className="text-3xl font-[family-name:var(--font-display)] text-[#1a1612] mt-1">
        {value}
      </p>
    </div>
  );
}

function ActionCard({
  href,
  icon: Icon,
  title,
  description,
  external,
}: {
  href: string;
  icon: LucideIcon;
  title: string;
  description: string;
  external?: boolean;
}) {
  const className =
    "block bg-white rounded-xl border border-[#e8e2d9] p-5 hover:border-[#c9a962] transition group";
  const inner = (
    <>
      <Icon size={22} className="text-[#c9a962] mb-3" />
      <h2 className="font-medium text-[#1a1612] group-hover:text-[#c9a962] transition">
        {title}
      </h2>
      <p className="text-sm text-[#9a8f82] mt-1">{description}</p>
    </>
  );

  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
        {inner}
      </a>
    );
  }
  return (
    <Link href={href} className={className}>
      {inner}
    </Link>
  );
}