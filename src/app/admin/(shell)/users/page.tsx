import { UsersManager } from "@/components/admin/users-manager";
import { requireAdminPage } from "@/server/page";
import { UserController } from "@/server/controllers/user-controller";
import { redirect } from "next/navigation";

export default async function UsersAdminPage() {
  const admin = await requireAdminPage();
  if (!admin.isSuperadmin) redirect("/admin");

  const { users: allUsers } = await UserController.make(admin.ctx).list();

  return (
    <div>
      <h1 className="font-[family-name:var(--font-display)] text-3xl text-[#1a1612] mb-2">
        Users
      </h1>
      <p className="text-[#5c534a] mb-8">
        Superadmins can manage all stores. Operators only see assigned stores.
      </p>
      <UsersManager
        initialUsers={allUsers}
        stores={admin.stores.map((s) => ({ id: s.id, name: s.name }))}
      />
    </div>
  );
}