import { SearchSelect } from "@/components/search-select";
import { cn } from "@/lib/utils";
import { useMeals } from "./api";

/** Picks one menu to filter by, searching by name. `undefined` = all menus. */
export function MealFilter({ value, onChange, className }: { value: string | undefined; onChange: (id: string | undefined) => void; className?: string }) {
  const { data: meals = [] } = useMeals();
  return (
    <SearchSelect
      items={meals}
      value={value}
      onChange={onChange}
      allLabel="Tutti i menu"
      searchPlaceholder="Cerca menu…"
      emptyText="Nessun menu trovato."
      aria-label="Filtra per menu"
      className={cn("h-8", className)}
    />
  );
}
