import { UsersManager } from "@/components/admin/users-manager";
import { requireAdminContext } from "@/lib/admin-context";
import { db } from "@/db";
import { users, userStores } from "@/db/schema";
import { redirect } from "next/navigation";

export default async function UsersAdminPage() {
  const admin = await requireAdminContext();
  if (!admin.isSuperadmin) redirect("/admin");

  const allUsers = await db.select().from(users);
  const assignments = await db.select().from(userStores);
  const byUser = Object.fromEntries(allUsers.map((u) => [u.id, [] as string[]]));
  for (const a of assignments) {
    byUser[a.userId]?.push(a.storeId);
  }

  return (
    <div>
      <h1 className="font-[family-name:var(--font-display)] text-3xl text-[#1a1612] mb-2">
        Users
      </h1>
      <p className="text-[#5c534a] mb-8">
        Superadmins can manage all stores. Operators only see assigned stores.
      </p>
      <UsersManager
        initialUsers={allUsers.map((u) => ({
          id: u.id,
          email: u.email,
          name: u.name,
          role: u.role,
          storeIds: byUser[u.id] ?? [],
        }))}
        stores={admin.stores.map((s) => ({ id: s.id, name: s.name }))}
      />
    </div>
  );
}