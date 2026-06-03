import { StoreForm } from "@/components/admin/store-form";
import { requireAdminContext } from "@/lib/admin-context";

export default async function StoreSettingsPage() {
  const admin = await requireAdminContext();

  return (
    <div className="max-w-xl">
      <h1 className="font-[family-name:var(--font-display)] text-3xl text-[#1a1612] mb-2">
        Store settings
      </h1>
      <p className="text-[#5c534a] mb-8">
        Public menu at{" "}
        <code className="text-sm bg-[#f0ebe3] px-2 py-0.5 rounded">
          /{admin.activeStore?.slug ?? "—"}
        </code>
      </p>
      <StoreForm store={admin.activeStore} />
    </div>
  );
}