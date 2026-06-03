import { ProductsManager } from "@/components/admin/products-manager";
import { requireAdminContext } from "@/lib/admin-context";
import { getFullMenuForAdmin } from "@/lib/stores";
import { migrateLegacyProductImages } from "@/lib/product-images";
import { getDishEnhancementPrompt } from "@/lib/prompts";
import { redirect } from "next/navigation";

export default async function ProductsPage() {
  const admin = await requireAdminContext();
  if (!admin.activeStoreId) redirect("/admin");

  await migrateLegacyProductImages();
  const menu = await getFullMenuForAdmin(admin.activeStoreId);
  const dishPrompt = await getDishEnhancementPrompt();

  return (
    <div>
      <h1 className="font-[family-name:var(--font-display)] text-3xl text-[#1a1612] mb-2">
        Products
      </h1>
      <p className="text-[#5c534a] mb-2">
        Store: <strong>{admin.activeStore?.name}</strong>
      </p>
      <p className="text-[#5c534a] mb-8">
        Upload dish photos, copy the enhancement prompt into Gemini (or similar),
        then upload the result — no API tokens required. Edit prompts in{" "}
        <code className="text-sm bg-[#f0ebe3] px-1.5 py-0.5 rounded">
          prompts/
        </code>
        .
      </p>
      <ProductsManager
        initialCategories={menu.categories}
        initialItems={menu.items}
        currency={admin.activeStore?.currency ?? "RON"}
        dishEnhancementPrompt={dishPrompt.text}
        dishEnhancementSource={dishPrompt.sourceFile}
      />
    </div>
  );
}