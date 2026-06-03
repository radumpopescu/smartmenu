import { RestaurantForm } from "@/components/admin/restaurant-form";
import { auth } from "@/auth";
import { getRestaurantForUser } from "@/lib/restaurant";

export default async function RestaurantPage() {
  const session = await auth();
  const restaurant = session?.user?.id
    ? await getRestaurantForUser(session.user.id)
    : null;

  return (
    <div className="max-w-xl">
      <h1 className="font-[family-name:var(--font-display)] text-3xl text-[#1a1612] mb-2">
        Restaurant
      </h1>
      <p className="text-[#5c534a] mb-8">
        Your public menu lives at{" "}
        <code className="text-sm bg-[#f0ebe3] px-2 py-0.5 rounded">
          /{restaurant?.slug ?? "your-slug"}
        </code>
      </p>
      <RestaurantForm restaurant={restaurant} />
    </div>
  );
}