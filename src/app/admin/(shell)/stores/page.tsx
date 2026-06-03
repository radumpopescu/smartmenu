import { StoresManager } from "@/components/admin/stores-manager";
import { requireAdminContext } from "@/lib/admin-context";
import { redirect } from "next/navigation";

export default async function StoresAdminPage() {
  const admin = await requireAdminContext();
  if (!admin.isSuperadmin) redirect("/admin");

  return (
    <div>
      <h1 className="font-[family-name:var(--font-display)] text-3xl text-[#1a1612] mb-2">
        Stores
      </h1>
      <p className="text-[#5c534a] mb-8">
        Create stores and switch to one to manage its menu. Assign operators
        under Users.
      </p>
      <StoresManager
        initialStores={admin.stores.map((s) => ({
          id: s.id,
          name: s.name,
          slug: s.slug,
          published: s.published,
        }))}
      />
    </div>
  );
}