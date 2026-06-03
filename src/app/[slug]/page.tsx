import { PublicMenu } from "@/components/menu/public-menu";
import { getPublishedMenu } from "@/lib/restaurant";
import { notFound } from "next/navigation";

export default async function PublicMenuPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const menu = await getPublishedMenu(slug);

  if (!menu) notFound();

  return (
    <PublicMenu
      restaurant={menu.restaurant}
      categories={menu.categories}
      items={menu.items}
    />
  );
}