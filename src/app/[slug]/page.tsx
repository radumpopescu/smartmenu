import { PublicMenu } from "@/components/menu/public-menu";
import { loadPublicMenu } from "@/server/page";
import { notFound } from "next/navigation";

export default async function PublicMenuPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const menu = await loadPublicMenu(slug);

  if (!menu) notFound();

  return (
    <PublicMenu
      store={menu.store}
      categories={menu.categories}
      items={menu.items}
    />
  );
}