"use client";

import type { Category } from "@/db/schema";
import { ProductGridCard } from "@/components/admin/product-grid-card";
import {
  getAdminPreviewImageUrl,
  type MenuItemWithImages,
} from "@/lib/product-image-display";
import {
  UNCATEGORIZED_CONTAINER,
  applyContainersToItems,
  buildProductContainers,
  containersToReorderPayload,
  findProductContainer,
  moveProductBetweenContainers,
  reorderInContainer,
  splitVisibleAndHidden,
  type ProductContainers,
} from "@/lib/menu-board";
import {
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  GripVertical,
  Plus,
  Trash2,
  Pencil,
  Check,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

type Props = {
  categories: Category[];
  items: MenuItemWithImages[];
  currency: string;
  searchQuery: string;
  onCategoriesChange: (categories: Category[]) => void;
  onItemsChange: (items: MenuItemWithImages[]) => void;
  onOpenProduct: (id: string) => void;
  onToggleProductHidden: (id: string, hidden: boolean) => void;
  onError: (message: string) => void;
};

export function ProductsCategoryBoard({
  categories,
  items,
  currency,
  searchQuery,
  onCategoriesChange,
  onItemsChange,
  onOpenProduct,
  onToggleProductHidden,
  onError,
}: Props) {
  const sortedCategories = useMemo(
    () => [...categories].sort((a, b) => a.sortOrder - b.sortOrder),
    [categories]
  );

  const categoryIds = useMemo(
    () => sortedCategories.map((c) => c.id),
    [sortedCategories]
  );

  const itemsById = useMemo(
    () => Object.fromEntries(items.map((i) => [i.id, i])),
    [items]
  );

  const [containers, setContainers] = useState<ProductContainers>(() =>
    buildProductContainers(sortedCategories, items)
  );

  const [activeProductId, setActiveProductId] = useState<string | null>(null);
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [addingCategory, setAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [savingCategory, setSavingCategory] = useState(false);
  const [expandedHidden, setExpandedHidden] = useState<
    Record<string, boolean>
  >({});

  const isSearching = searchQuery.trim().length > 0;

  function toggleHiddenSection(containerId: string) {
    setExpandedHidden((prev) => ({
      ...prev,
      [containerId]: !prev[containerId],
    }));
  }

  useEffect(() => {
    setContainers(buildProductContainers(sortedCategories, items));
  }, [sortedCategories, items]);

  const displayContainers = useMemo(() => {
    if (!isSearching) return containers;
    const q = searchQuery.trim().toLowerCase();
    const next: ProductContainers = {};
    for (const [containerId, ids] of Object.entries(containers)) {
      const filtered = ids.filter((id) => {
        const item = itemsById[id];
        if (!item) return false;
        const catName = item.categoryId
          ? sortedCategories.find((c) => c.id === item.categoryId)?.name
          : "";
        return (
          item.name.toLowerCase().includes(q) ||
          (item.description?.toLowerCase().includes(q) ?? false) ||
          (catName?.toLowerCase().includes(q) ?? false)
        );
      });
      if (filtered.length > 0) next[containerId] = filtered;
    }
    return next;
  }, [containers, isSearching, searchQuery, itemsById, sortedCategories]);

  const persistProductOrder = useCallback(
    async (nextContainers: ProductContainers) => {
      const res = await fetch("/api/products/reorder", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: containersToReorderPayload(nextContainers) }),
      });
      if (!res.ok) {
        const data = await res.json();
        onError(data.error ?? "Could not save order");
        setContainers(buildProductContainers(sortedCategories, items));
        return;
      }
      const { items: updated } = await res.json();
      const imageMap = new Map(items.map((i) => [i.id, i.images] as const));
      onItemsChange(
        updated.map((row: MenuItemWithImages) => ({
          ...row,
          images: imageMap.get(row.id) ?? [],
        }))
      );
    },
    [items, sortedCategories, onItemsChange, onError]
  );

  const persistCategoryOrder = useCallback(
    async (orderedIds: string[]) => {
      const res = await fetch("/api/categories", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderedIds }),
      });
      if (!res.ok) {
        const data = await res.json();
        onError(data.error ?? "Could not reorder categories");
        return;
      }
      const { categories: updated } = await res.json();
      onCategoriesChange(updated);
    },
    [onCategoriesChange, onError]
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 10 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 220, tolerance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  function handleDragStart(event: DragStartEvent) {
    const type = event.active.data.current?.type;
    if (type === "category") setActiveCategoryId(String(event.active.id));
    if (type === "product") setActiveProductId(String(event.active.id));
  }

  function handleDragOver(event: DragOverEvent) {
    if (isSearching) return;
    const { active, over } = event;
    if (!over || active.data.current?.type !== "product") return;

    const activeId = String(active.id);
    const overId = String(over.id);

    setContainers((prev) => {
      const activeContainer = findProductContainer(prev, activeId);
      let overContainer = findProductContainer(prev, overId);
      if (!overContainer && prev[overId]) overContainer = overId;
      if (!activeContainer || !overContainer) return prev;
      if (activeContainer === overContainer) {
        return reorderInContainer(prev, activeContainer, activeId, overId);
      }
      return moveProductBetweenContainers(prev, activeId, overId);
    });
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveProductId(null);
    setActiveCategoryId(null);
    if (!over || isSearching) return;

    if (active.data.current?.type === "category") {
      const activeId = String(active.id);
      const overId = String(over.id);
      const oldIndex = categoryIds.indexOf(activeId);
      const newIndex = categoryIds.indexOf(overId);
      if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
        const reordered = arrayMove(categoryIds, oldIndex, newIndex);
        onCategoriesChange(
          reordered.map((id, sortOrder) => {
            const cat = sortedCategories.find((c) => c.id === id)!;
            return { ...cat, sortOrder };
          })
        );
        void persistCategoryOrder(reordered);
      }
      return;
    }

    if (active.data.current?.type === "product") {
      const activeId = String(active.id);
      const overId = String(over.id);
      let next = containers;
      const activeContainer = findProductContainer(containers, activeId);
      let overContainer = findProductContainer(containers, overId);
      if (!overContainer && containers[overId]) overContainer = overId;

      if (activeContainer && overContainer) {
        if (activeContainer === overContainer) {
          next = reorderInContainer(
            containers,
            activeContainer,
            activeId,
            overId
          );
        } else {
          next = moveProductBetweenContainers(containers, activeId, overId);
          const overItems = [...next[overContainer]];
          const idx = overItems.indexOf(overId);
          if (idx >= 0) {
            const without = overItems.filter((id) => id !== activeId);
            without.splice(idx, 0, activeId);
            next = { ...next, [overContainer]: without };
          }
        }
      }

      setContainers(next);
      onItemsChange(applyContainersToItems(items, next));
      void persistProductOrder(next);
    }
  }

  async function createCategory() {
    const name = newCategoryName.trim();
    if (!name) return;
    setSavingCategory(true);
    const res = await fetch("/api/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setSavingCategory(false);
    if (!res.ok) {
      onError((await res.json()).error ?? "Could not create category");
      return;
    }
    const { category } = await res.json();
    onCategoriesChange([...categories, category]);
    setContainers((prev) => ({ ...prev, [category.id]: [] }));
    setNewCategoryName("");
    setAddingCategory(false);
  }

  async function renameCategory(id: string, name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    const res = await fetch(`/api/categories/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: trimmed }),
    });
    if (!res.ok) {
      onError((await res.json()).error ?? "Could not rename category");
      return;
    }
    const { category } = await res.json();
    onCategoriesChange(categories.map((c) => (c.id === id ? category : c)));
  }

  async function deleteCategory(id: string) {
    if (!confirm("Delete this empty category?")) return;
    const res = await fetch(`/api/categories/${id}`, { method: "DELETE" });
    if (!res.ok) {
      onError((await res.json()).error ?? "Could not delete category");
      return;
    }
    onCategoriesChange(categories.filter((c) => c.id !== id));
    setContainers((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  const activeProduct = activeProductId ? itemsById[activeProductId] : null;
  const dragDisabled = isSearching;

  const showUncategorized =
    (displayContainers[UNCATEGORIZED_CONTAINER]?.length ?? 0) > 0 ||
    !isSearching;

  return (
    <div className="space-y-4">
      {isSearching && (
        <p className="text-xs text-[#9a8f82] bg-[#f8f6f3] rounded-lg px-3 py-2">
          Clear search to drag and reorder categories and products.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {addingCategory ? (
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <input
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              placeholder="Category name"
              className="flex-1 min-w-[140px] px-3 py-2.5 text-sm rounded-lg border border-[#e8e2d9] focus:outline-none focus:ring-2 focus:ring-[#c9a962]/40"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") void createCategory();
                if (e.key === "Escape") setAddingCategory(false);
              }}
            />
            <button
              type="button"
              disabled={savingCategory}
              onClick={() => void createCategory()}
              className="inline-flex items-center gap-1 px-3 py-2.5 text-sm bg-[#1a1612] text-white rounded-lg min-h-[44px]"
            >
              <Check size={16} />
              Add
            </button>
            <button
              type="button"
              onClick={() => setAddingCategory(false)}
              className="p-2.5 rounded-lg border border-[#e8e2d9] min-h-[44px] min-w-[44px] flex items-center justify-center"
            >
              <X size={16} />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setAddingCategory(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium bg-white border border-[#e8e2d9] rounded-lg hover:border-[#c9a962] min-h-[44px] touch-manipulation"
          >
            <Plus size={16} />
            Add category
          </button>
        )}
        <p className="text-xs text-[#9a8f82] sm:ml-auto">
          <span className="sm:hidden">Hold grip to drag · tap to edit</span>
          <span className="hidden sm:inline">
            Long-press or use handles to drag · Tap card to edit
          </span>
        </p>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={categoryIds}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-6">
            {sortedCategories.map((category) => {
              const productIds = displayContainers[category.id] ?? [];
              if (isSearching && productIds.length === 0) return null;

              return (
                <CategorySection
                  key={category.id}
                  category={category}
                  productIds={productIds}
                  itemsById={itemsById}
                  currency={currency}
                  dragDisabled={dragDisabled}
                  isSearching={isSearching}
                  showHidden={expandedHidden[category.id] ?? false}
                  onToggleShowHidden={() => toggleHiddenSection(category.id)}
                  onOpenProduct={onOpenProduct}
                  onToggleProductHidden={onToggleProductHidden}
                  onRename={(name) => void renameCategory(category.id, name)}
                  onDelete={() => void deleteCategory(category.id)}
                  canDelete={productIds.length === 0 && !isSearching}
                />
              );
            })}
          </div>
        </SortableContext>

        {showUncategorized && (
          <UncategorizedSection
            productIds={displayContainers[UNCATEGORIZED_CONTAINER] ?? []}
            itemsById={itemsById}
            currency={currency}
            dragDisabled={dragDisabled}
            isSearching={isSearching}
            showHidden={expandedHidden[UNCATEGORIZED_CONTAINER] ?? false}
            onToggleShowHidden={() =>
              toggleHiddenSection(UNCATEGORIZED_CONTAINER)
            }
            onOpenProduct={onOpenProduct}
            onToggleProductHidden={onToggleProductHidden}
          />
        )}

        <DragOverlay>
          {activeProduct ? (
            <ProductGridCard
              item={activeProduct}
              currency={currency}
              displayUrl={getAdminPreviewImageUrl(
                activeProduct,
                activeProduct.images
              )}
              imageCount={activeProduct.images.length}
              onOpen={() => {}}
              isDragging
            />
          ) : activeCategoryId ? (
            <div className="px-4 py-3 bg-white rounded-xl border border-[#c9a962] shadow-lg text-sm font-medium">
              {sortedCategories.find((c) => c.id === activeCategoryId)?.name}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

function CategorySection({
  category,
  productIds,
  itemsById,
  currency,
  dragDisabled,
  isSearching,
  showHidden,
  onToggleShowHidden,
  onOpenProduct,
  onToggleProductHidden,
  onRename,
  onDelete,
  canDelete,
}: {
  category: Category;
  productIds: string[];
  itemsById: Record<string, MenuItemWithImages>;
  currency: string;
  dragDisabled: boolean;
  isSearching: boolean;
  showHidden: boolean;
  onToggleShowHidden: () => void;
  onOpenProduct: (id: string) => void;
  onToggleProductHidden: (id: string, hidden: boolean) => void;
  onRename: (name: string) => void;
  onDelete: () => void;
  canDelete: boolean;
}) {
  const { visibleIds, hiddenIds } = splitVisibleAndHidden(
    productIds,
    itemsById
  );
  const displayCount = isSearching ? productIds.length : visibleIds.length;
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: category.id,
    data: { type: "category" },
    disabled: dragDisabled,
  });

  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: category.id,
    data: { type: "container" },
    disabled: dragDisabled,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(category.name);

  useEffect(() => {
    setEditName(category.name);
  }, [category.name]);

  return (
    <section
      ref={setNodeRef}
      style={style}
      className={`rounded-xl border bg-white overflow-hidden ${
        isDragging ? "opacity-50 border-[#c9a962]" : "border-[#e8e2d9]"
      }`}
    >
      <header className="flex items-center gap-2 px-3 py-3 border-b border-[#f0ebe3] bg-[#fafaf8]">
        <button
          type="button"
          className="p-2 -ml-1 rounded-lg text-[#9a8f82] hover:bg-[#f0ebe3] touch-manipulation cursor-grab active:cursor-grabbing min-h-[44px] min-w-[44px] flex items-center justify-center shrink-0"
          aria-label="Drag category"
          {...attributes}
          {...listeners}
        >
          <GripVertical size={18} />
        </button>

        {editing ? (
          <div className="flex flex-1 items-center gap-2 min-w-0">
            <input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="flex-1 min-w-0 px-2 py-2 text-sm rounded-lg border border-[#e8e2d9]"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  onRename(editName);
                  setEditing(false);
                }
                if (e.key === "Escape") {
                  setEditName(category.name);
                  setEditing(false);
                }
              }}
            />
            <button
              type="button"
              onClick={() => {
                onRename(editName);
                setEditing(false);
              }}
              className="p-2 rounded-lg bg-[#1a1612] text-white min-h-[40px] min-w-[40px] flex items-center justify-center"
            >
              <Check size={16} />
            </button>
          </div>
        ) : (
          <>
            <h2 className="flex-1 font-medium text-[#1a1612] text-sm sm:text-base truncate">
              {category.name}
            </h2>
            <span className="text-xs text-[#9a8f82] shrink-0">
              {displayCount}
              {!isSearching && hiddenIds.length > 0 && (
                <span className="text-[#c9a962]"> +{hiddenIds.length} hidden</span>
              )}
            </span>
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="p-2 rounded-lg hover:bg-[#f0ebe3] text-[#5c534a] min-h-[40px] min-w-[40px] flex items-center justify-center touch-manipulation"
              aria-label="Rename category"
            >
              <Pencil size={16} />
            </button>
            {canDelete && (
              <button
                type="button"
                onClick={onDelete}
                className="p-2 rounded-lg hover:bg-red-50 text-red-600 min-h-[40px] min-w-[40px] flex items-center justify-center touch-manipulation"
                aria-label="Delete category"
              >
                <Trash2 size={16} />
              </button>
            )}
          </>
        )}
      </header>

      <div
        ref={setDropRef}
        className={`p-3 min-h-[72px] transition-colors ${
          isOver ? "bg-[#faf6ee]" : ""
        }`}
      >
        <ProductContainerGrid
          containerId={category.id}
          productIds={productIds}
          visibleIds={isSearching ? productIds : visibleIds}
          hiddenIds={isSearching ? [] : hiddenIds}
          itemsById={itemsById}
          currency={currency}
          dragDisabled={dragDisabled}
          showHidden={showHidden}
          onToggleShowHidden={onToggleShowHidden}
          onOpenProduct={onOpenProduct}
          onToggleProductHidden={onToggleProductHidden}
          emptyLabel="Drop products here"
        />
      </div>
    </section>
  );
}

function UncategorizedSection({
  productIds,
  itemsById,
  currency,
  dragDisabled,
  isSearching,
  showHidden,
  onToggleShowHidden,
  onOpenProduct,
  onToggleProductHidden,
}: {
  productIds: string[];
  itemsById: Record<string, MenuItemWithImages>;
  currency: string;
  dragDisabled: boolean;
  isSearching: boolean;
  showHidden: boolean;
  onToggleShowHidden: () => void;
  onOpenProduct: (id: string) => void;
  onToggleProductHidden: (id: string, hidden: boolean) => void;
}) {
  const { visibleIds, hiddenIds } = splitVisibleAndHidden(
    productIds,
    itemsById
  );
  const { setNodeRef, isOver } = useDroppable({
    id: UNCATEGORIZED_CONTAINER,
    data: { type: "container" },
    disabled: dragDisabled,
  });

  if (isSearching && productIds.length === 0) return null;

  return (
    <section className="rounded-xl border border-dashed border-[#d4cfc6] bg-[#f8f6f3]/50 overflow-hidden mt-6">
      <header className="px-4 py-3 border-b border-[#e8e2d9]">
        <h2 className="font-medium text-[#5c534a] text-sm">Uncategorized</h2>
        <p className="text-xs text-[#9a8f82] mt-0.5">
          Products without a category
        </p>
      </header>
      <div
        ref={setNodeRef}
        className={`p-3 min-h-[72px] ${isOver ? "bg-[#faf6ee]" : ""}`}
      >
        <ProductContainerGrid
          containerId={UNCATEGORIZED_CONTAINER}
          productIds={productIds}
          visibleIds={isSearching ? productIds : visibleIds}
          hiddenIds={isSearching ? [] : hiddenIds}
          itemsById={itemsById}
          currency={currency}
          dragDisabled={dragDisabled}
          showHidden={showHidden}
          onToggleShowHidden={onToggleShowHidden}
          onOpenProduct={onOpenProduct}
          onToggleProductHidden={onToggleProductHidden}
          emptyLabel={
            !isSearching ? "Drag products here to uncategorize" : "—"
          }
        />
      </div>
    </section>
  );
}

function ProductContainerGrid({
  containerId,
  productIds,
  visibleIds,
  hiddenIds,
  itemsById,
  currency,
  dragDisabled,
  showHidden,
  onToggleShowHidden,
  onOpenProduct,
  onToggleProductHidden,
  emptyLabel,
}: {
  containerId: string;
  productIds: string[];
  visibleIds: string[];
  hiddenIds: string[];
  itemsById: Record<string, MenuItemWithImages>;
  currency: string;
  dragDisabled: boolean;
  showHidden: boolean;
  onToggleShowHidden: () => void;
  onOpenProduct: (id: string) => void;
  onToggleProductHidden: (id: string, hidden: boolean) => void;
  emptyLabel: string;
}) {
  return (
    <SortableContext items={productIds} strategy={rectSortingStrategy}>
      {productIds.length === 0 ? (
        <p className="text-xs text-[#9a8f82] py-4 text-center">{emptyLabel}</p>
      ) : (
        <div className="space-y-3">
          {visibleIds.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
              {visibleIds.map((id) => (
                <SortableProductCard
                  key={id}
                  item={itemsById[id]!}
                  containerId={containerId}
                  currency={currency}
                  dragDisabled={dragDisabled}
                  dimmed={false}
                  onOpen={() => onOpenProduct(id)}
                  onToggleHidden={() => onToggleProductHidden(id, true)}
                />
              ))}
            </div>
          ) : hiddenIds.length > 0 && !showHidden ? (
            <p className="text-xs text-[#9a8f82] py-2 text-center">
              All products in this section are hidden
            </p>
          ) : null}

          {hiddenIds.length > 0 && (
            <div className="space-y-2">
              <button
                type="button"
                onClick={onToggleShowHidden}
                className="w-full flex items-center justify-center gap-1.5 py-2.5 px-3 text-xs font-medium text-[#5c534a] bg-[#f8f6f3] hover:bg-[#f0ebe3] border border-[#e8e2d9] rounded-lg touch-manipulation min-h-[44px] transition-colors"
              >
                {showHidden ? (
                  <>
                    <ChevronUp size={14} />
                    Hide hidden
                  </>
                ) : (
                  <>
                    <ChevronDown size={14} />
                    +{hiddenIds.length} hidden
                  </>
                )}
              </button>

              {showHidden && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 pt-1">
                  {hiddenIds.map((id) => (
                    <SortableProductCard
                      key={id}
                      item={itemsById[id]!}
                      containerId={containerId}
                      currency={currency}
                      dragDisabled={dragDisabled}
                      dimmed
                      onOpen={() => onOpenProduct(id)}
                      onToggleHidden={() => onToggleProductHidden(id, false)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </SortableContext>
  );
}

function SortableProductCard({
  item,
  containerId,
  currency,
  dragDisabled,
  dimmed,
  onOpen,
  onToggleHidden,
}: {
  item: MenuItemWithImages;
  containerId: string;
  currency: string;
  dragDisabled: boolean;
  dimmed?: boolean;
  onOpen: () => void;
  onToggleHidden?: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: item.id,
    data: { type: "product", containerId },
    disabled: dragDisabled,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <ProductGridCard
      ref={setNodeRef}
      style={style}
      item={item}
      currency={currency}
      displayUrl={getAdminPreviewImageUrl(item, item.images)}
      imageCount={item.images.length}
      onOpen={onOpen}
      isDragging={isDragging}
      isHidden={item.hidden}
      dimmed={dimmed}
      onToggleHidden={onToggleHidden}
      dragHandleProps={
        dragDisabled ? undefined : { ...attributes, ...listeners }
      }
    />
  );
}