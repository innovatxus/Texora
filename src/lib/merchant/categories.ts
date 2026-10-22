import "server-only";
import { listLiveCategories } from "@/lib/data/catalog-structure";
import { DEPARTMENTS } from "@/lib/validation/common";

/** Leaf categories a shop can sell in, for the "What you sell" checkboxes. */
export async function shopCategoryOptions() {
  const lists = await Promise.all(DEPARTMENTS.map((d) => listLiveCategories(d)));
  return lists
    .flat()
    .filter((c) => c.parentId !== null)
    .sort((a, b) => a.department.localeCompare(b.department) || a.sortOrder - b.sortOrder)
    .map((c) => ({ key: c.path.join("/"), name: c.name, department: c.department }));
}
