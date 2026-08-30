import { AdminSidebar } from "@/components/admin/sidebar";
import { requireAdminPage } from "@/server/page";
import { redirect } from "next/navigation";

export default async function AdminShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await requireAdminPage();

  if (
    !admin.isSuperadmin &&
    admin.actor.storeIds.length === 0
  ) {
    return (
      <div className="min-h-screen bg-[#f8f6f3] flex">
        <AdminSidebar
          role={admin.actor.role}
          stores={[]}
          activeStoreId={null}
        />
        <main className="flex-1 p-8">
          <h1 className="text-xl font-medium text-[#1a1612]">No access</h1>
          <p className="text-[#5c534a] mt-2">
            Your account is not assigned to any stores yet.
          </p>
        </main>
      </div>
    );
  }

  if (
    !admin.isSuperadmin &&
    !admin.activeStoreId &&
    admin.stores.length > 0
  ) {
    redirect("/admin");
  }

  return (
    <div className="min-h-screen bg-[#f8f6f3] flex">
      <AdminSidebar
        role={admin.actor.role}
        stores={admin.stores}
        activeStoreId={admin.activeStoreId}
        activeSlug={admin.activeStore?.slug}
      />
      <main className="flex-1 p-8 overflow-auto">{children}</main>
    </div>
  );
}