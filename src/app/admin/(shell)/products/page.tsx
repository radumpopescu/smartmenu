import { ProductsManager } from "@/components/admin/products-manager";
import { auth } from "@/auth";
import { getDishEnhancementPrompt } from "@/lib/prompts";
import { getRestaurantForUser, getFullMenuForAdmin } from "@/lib/restaurant";

export default async function ProductsPage() {
  const session = await auth();
  const restaurant = session?.user?.id
    ? await getRestaurantForUser(session.user.id)
    : null;

  const menu = restaurant
    ? await getFullMenuForAdmin(restaurant.id)
    : { categories: [], items: [] };

  const dishPrompt = await getDishEnhancementPrompt();

  return (
    <div>
      <h1 className="font-[family-name:var(--font-display)] text-3xl text-[#1a1612] mb-2">
        Products
      </h1>
      <p className="text-[#5c534a] mb-8">
        Upload dish photos, copy the enhancement prompt into Gemini (or similar),
        then upload the result — no API tokens required. Edit prompts in{" "}
        <code className="text-sm bg-[#f0ebe3] px-1.5 py-0.5 rounded">
          prompts/
        </code>{" "}
        (restart dev server to pick up changes).
      </p>
      <ProductsManager
        initialCategories={menu.categories}
        initialItems={menu.items}
        dishEnhancementPrompt={dishPrompt.text}
        dishEnhancementSource={dishPrompt.sourceFile}
      />
    </div>
  );
}