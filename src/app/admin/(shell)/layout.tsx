import { auth } from "@/auth";
import { getRestaurantForUser } from "@/lib/restaurant";
import { AdminSidebar } from "@/components/admin/sidebar";
import { redirect } from "next/navigation";

export default async function AdminShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/admin/login");

  const restaurant = await getRestaurantForUser(session.user.id);

  return (
    <div className="min-h-screen bg-[#f8f6f3] flex">
      <AdminSidebar slug={restaurant?.slug} />
      <main className="flex-1 p-8 overflow-auto">{children}</main>
    </div>
  );
}