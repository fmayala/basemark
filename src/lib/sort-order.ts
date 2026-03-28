/**
 * Compute the sort-order update(s) needed to place `movedItem` at `toIndex`
 * within `destinationItems` (which must NOT include `movedItem`).
 *
 * When all destination items share the same sortOrder (the default zero-state,
 * or an empty destination), returns a full bulk reindex of the resulting list
 * (sorted by index * 1000) to avoid floating-point precision degradation.
 *
 * Otherwise returns a single update for `movedItem` computed via fractional
 * indexing (midpoint between its new neighbors).
 */
export function computeSortUpdates(
  destinationItems: { id: string; sortOrder: number }[],
  movedItem: { id: string; sortOrder: number },
  toIndex: number,
): { id: string; sortOrder: number }[] {
  // Build the resulting ordered list with the moved item inserted
  const result = [...destinationItems];
  result.splice(toIndex, 0, movedItem);

  // Bulk-reindex when all destination items share the same sortOrder
  // Include movedItem so a cross-collection drag where destination items are all zero
  // but the moved item has a distinct sortOrder doesn't trigger unnecessary bulk reindex.
  const allOrders = new Set([...destinationItems, movedItem].map((i) => i.sortOrder));
  if (allOrders.size <= 1) {
    return result.map((item, idx) => ({ id: item.id, sortOrder: idx * 1000 }));
  }

  // Fractional indexing: midpoint between the new neighbors
  const prev = toIndex > 0 ? result[toIndex - 1].sortOrder : -Infinity;
  const next = toIndex < result.length - 1 ? result[toIndex + 1].sortOrder : Infinity;
  const newOrder =
    prev === -Infinity ? next - 1000
    : next === Infinity ? prev + 1000
    : (prev + next) / 2;

  return [{ id: movedItem.id, sortOrder: newOrder }];
}
