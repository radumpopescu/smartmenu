import { ProductsManager } from "@/components/admin/products-manager";
import { requireAdminPage } from "@/server/page";
import { ProductController } from "@/server/controllers/product-controller";
import { getDishEnhancementPrompt } from "@/lib/prompts";
import { IMAGE_QUALITY, IMAGE_SIZE, INPUT_MAX_PX } from "@/lib/image-config";
import { redirect } from "next/navigation";

export default async function ProductsPage() {
  const admin = await requireAdminPage();
  if (!admin.activeStoreId) redirect("/admin");

  const menu = await ProductController.make(admin.ctx).board();
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
        imageSettings={{
          size: IMAGE_SIZE,
          quality: IMAGE_QUALITY,
          inputMaxPx: INPUT_MAX_PX,
        }}
      />
    </div>
  );
}