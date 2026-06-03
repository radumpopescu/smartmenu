import { MenuImportWizard } from "@/components/admin/menu-import-wizard";
import { requireAdminContext } from "@/lib/admin-context";
import { redirect } from "next/navigation";

export default async function ImportPage() {
  const admin = await requireAdminContext();
  if (!admin.activeStoreId) redirect("/admin");

  return (
    <div className="max-w-3xl">
      <h1 className="font-[family-name:var(--font-display)] text-3xl text-[#1a1612] mb-2">
        Import menu
      </h1>
      <p className="text-[#5c534a] mb-2">
        Importing into: <strong>{admin.activeStore?.name}</strong>
      </p>
      <p className="text-[#5c534a] mb-8">
        Upload a photo of your existing menu. Grok will extract categories,
        dishes, descriptions, and prices for you to review. Tune prompts in{" "}
        <code className="text-sm bg-[#f0ebe3] px-1.5 py-0.5 rounded">
          prompts/menu-extraction-*.txt
        </code>
        .
      </p>
      <MenuImportWizard currency={admin.activeStore?.currency ?? "RON"} />
    </div>
  );
}