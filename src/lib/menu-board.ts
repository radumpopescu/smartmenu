import type { Category } from "@/db/schema";
import type { MenuItemWithImages } from "@/lib/product-image-display";

export const UNCATEGORIZED_CONTAINER = "uncategorized";

export type ProductContainers = Record<string, string[]>;

export function buildProductContainers(
  categories: Category[],
  items: MenuItemWithImages[]
): ProductContainers {
  const containers: ProductContainers = {
    [UNCATEGORIZED_CONTAINER]: [],
  };
  const sortedCats = [...categories].sort((a, b) => a.sortOrder - b.sortOrder);
  for (const cat of sortedCats) {
    containers[cat.id] = [];
  }

  const sortedItems = [...items].sort((a, b) => a.sortOrder - b.sortOrder);
  for (const item of sortedItems) {
    const key =
      item.categoryId && containers[item.categoryId] !== undefined
        ? item.categoryId
        : UNCATEGORIZED_CONTAINER;
    containers[key].push(item.id);
  }
  return containers;
}

export function containersToReorderPayload(containers: ProductContainers) {
  const updates: {
    id: string;
    categoryId: string | null;
    sortOrder: number;
  }[] = [];

  for (const [containerId, productIds] of Object.entries(containers)) {
    const categoryId =
      containerId === UNCATEGORIZED_CONTAINER ? null : containerId;
    productIds.forEach((id, sortOrder) => {
      updates.push({ id, categoryId, sortOrder });
    });
  }
  return updates;
}

export function applyContainersToItems(
  items: MenuItemWithImages[],
  containers: ProductContainers
): MenuItemWithImages[] {
  const byId = Object.fromEntries(items.map((i) => [i.id, i]));
  const next: MenuItemWithImages[] = [];

  for (const [containerId, productIds] of Object.entries(containers)) {
    const categoryId =
      containerId === UNCATEGORIZED_CONTAINER ? null : containerId;
    productIds.forEach((id, sortOrder) => {
      const item = byId[id];
      if (item) {
        next.push({ ...item, categoryId, sortOrder });
      }
    });
  }

  return next;
}

export function splitVisibleAndHidden(
  productIds: string[],
  itemsById: Record<string, { hidden: boolean }>
): { visibleIds: string[]; hiddenIds: string[] } {
  const visibleIds: string[] = [];
  const hiddenIds: string[] = [];
  for (const id of productIds) {
    if (itemsById[id]?.hidden) hiddenIds.push(id);
    else visibleIds.push(id);
  }
  return { visibleIds, hiddenIds };
}

export function findProductContainer(
  containers: ProductContainers,
  productId: string
): string | undefined {
  for (const [containerId, ids] of Object.entries(containers)) {
    if (ids.includes(productId)) return containerId;
  }
  return undefined;
}

export function moveProductBetweenContainers(
  containers: ProductContainers,
  activeId: string,
  overId: string
): ProductContainers {
  const activeContainer = findProductContainer(containers, activeId);
  if (!activeContainer) return containers;

  let overContainer = findProductContainer(containers, overId);
  if (!overContainer && containers[overId]) {
    overContainer = overId;
  }
  if (!overContainer || activeContainer === overContainer) return containers;

  const activeItems = [...containers[activeContainer]];
  const overItems = [...containers[overContainer]];
  const activeIndex = activeItems.indexOf(activeId);
  if (activeIndex === -1) return containers;

  activeItems.splice(activeIndex, 1);
  overItems.push(activeId);

  return {
    ...containers,
    [activeContainer]: activeItems,
    [overContainer]: overItems,
  };
}

export function reorderInContainer(
  containers: ProductContainers,
  containerId: string,
  activeId: string,
  overId: string
): ProductContainers {
  const items = [...containers[containerId]];
  const activeIndex = items.indexOf(activeId);
  let overIndex = items.indexOf(overId);
  if (overIndex === -1) overIndex = items.length - 1;
  if (activeIndex === -1 || activeIndex === overIndex) return containers;

  const [removed] = items.splice(activeIndex, 1);
  items.splice(overIndex, 0, removed);

  return { ...containers, [containerId]: items };
}