import { Link } from "@tanstack/react-router";
import { CalendarDays, CalendarX, Copy, EllipsisVertical, Lock, Pencil, Plus, Search, Trash2, UtensilsCrossed, X } from "lucide-react";
import { toast } from "sonner";
import { useMemo, useState } from "react";
import { PageBody, PageHeader } from "@/components/page";
import { SearchSelect } from "@/components/search-select";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { COURSES } from "@/db/schema";
import { toPlainText } from "@/lib/rich-text";
import { COURSE_LABELS, plannedUsageCount, useDeleteMeal, useDuplicateMeal, useMeals, useRemoveFromPlanner, type MealListItem } from "./api";
import { format } from "date-fns";

export function MealsPage() {
  const { data: meals, isLoading } = useMeals();
  const del = useDeleteMeal();
  const duplicate = useDuplicateMeal();
  const [toDelete, setToDelete] = useState<MealListItem | null>(null);
  const [toUnplan, setToUnplan] = useState<MealListItem | null>(null);
  const removeFromPlanner = useRemoveFromPlanner();
  const [viewing, setViewing] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [recipeId, setRecipeId] = useState<string | undefined>();
  const [planned, setPlanned] = useState<PlannedFilter>("all");

  // Recipes that appear in at least one menu, for the recipe filter.
  const usedRecipes = useMemo(() => {
    const byId = new Map<string, { id: string; name: string }>();
    for (const m of meals ?? []) for (const r of m.recipes) byId.set(r.recipeId, { id: r.recipeId, name: r.recipe.name });
    return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name, "it"));
  }, [meals]);

  const filtered = useMemo(() => filterMeals(meals ?? [], { search, recipeId, planned }), [meals, search, recipeId, planned]);
  const filtering = !!search.trim() || !!recipeId || planned !== "all";
  const resetFilters = () => {
    setSearch("");
    setRecipeId(undefined);
    setPlanned("all");
  };

  async function askDelete(m: MealListItem) {
    const n = await plannedUsageCount(m.id);
    if (n > 0) {
      toast.error(`«${m.name}» è nel planner (${n} volte). Rimuovilo prima dal planner.`);
      return;
    }
    setToDelete(m);
  }

  return (
    <>
      <PageHeader
        title="Menu"
        description={meals && (filtering ? `${filtered.length} di ${meals.length} menu` : `${meals.length} menu`)}
        actions={
          <Button asChild>
            <Link to="/meals/new">
              <Plus /> Nuovo menu
            </Link>
          </Button>
        }
      />
      <PageBody className="space-y-4">
        {!isLoading && meals?.length === 0 ? (
          <Empty className="border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <UtensilsCrossed />
              </EmptyMedia>
              <EmptyTitle>Nessun menu</EmptyTitle>
              <EmptyDescription>Un menu raggruppa ricette in antipasti, primi, secondi e dolci.</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button type="button" asChild>
                <Link to="/meals/new">
                  <Plus /> Nuovo menu
                </Link>
              </Button>
            </EmptyContent>
          </Empty>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <InputGroup className="max-w-sm">
                <InputGroupAddon>
                  <Search />
                </InputGroupAddon>
                <InputGroupInput placeholder="Cerca per nome…" value={search} onChange={(e) => setSearch(e.target.value)} />
              </InputGroup>
              <SearchSelect
                items={usedRecipes}
                value={recipeId}
                onChange={setRecipeId}
                allLabel="Tutte le ricette"
                searchPlaceholder="Cerca ricetta…"
                emptyText="Nessuna ricetta trovata."
                aria-label="Filtra per ricetta"
              />
              <ToggleGroup type="single" variant="outline" value={planned} onValueChange={(v) => v && setPlanned(v as PlannedFilter)}>
                <ToggleGroupItem value="all">Tutti</ToggleGroupItem>
                <ToggleGroupItem value="planned">Nel planner</ToggleGroupItem>
                <ToggleGroupItem value="unplanned">Non pianificati</ToggleGroupItem>
              </ToggleGroup>
              {filtering && (
                <Button type="button" variant="outline" onClick={resetFilters}>
                  <X /> Rimuovi filtri
                </Button>
              )}
            </div>
            {filtered.length === 0 && !isLoading && (
              <Empty className="border">
                <EmptyHeader>
                  <EmptyTitle>Nessun menu trovato</EmptyTitle>
                  <EmptyDescription>Nessun menu corrisponde ai filtri.</EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                  <Button type="button" variant="outline" onClick={resetFilters}>
                    <X /> Rimuovi filtri
                  </Button>
                </EmptyContent>
              </Empty>
            )}
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {filtered.map((m) => (
                <Card key={m.id} className="hover:border-primary/40 transition-colors">
                  <CardHeader>
                    <CardTitle>
                      <Link to="/meals/$mealId" params={{ mealId: m.id }} className="hover:underline">
                        {m.name}
                      </Link>
                    </CardTitle>
                    <CardDescription className="flex flex-wrap items-center gap-2">
                      {toPlainText(m.notes) || " "}
                    </CardDescription>
                    <CardAction>
                      {m.planned.length > 0 ? (
                        <Button type="button" variant="ghost" size="icon" aria-label="Visualizza" title="Nel planner: sola lettura" asChild>
                          <Link to="/meals/$mealId" params={{ mealId: m.id }}>
                            <Lock />
                          </Link>
                        </Button>
                      ) : (
                        <Button type="button" variant="ghost" size="icon" aria-label="Modifica" title="Modifica" asChild>
                          <Link to="/meals/$mealId" params={{ mealId: m.id }}>
                            <Pencil />
                          </Link>
                        </Button>
                      )}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button type="button" variant="ghost" size="icon" aria-label="Altre azioni">
                            <EllipsisVertical />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem disabled={duplicate.isPending} onSelect={() => duplicate.mutate(m.id)}>
                            <Copy /> Duplica
                          </DropdownMenuItem>
                          <DropdownMenuItem disabled={m.planned.length === 0} asChild={m.planned.length > 0}>
                            {m.planned.length > 0 ? (
                              <Link to="/planner" search={{ meal: m.id }}>
                                <CalendarDays /> Pianificazioni
                              </Link>
                            ) : (
                              <>
                                <CalendarDays /> Mai pianificato
                              </>
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {m.planned.length > 0 && (
                            <DropdownMenuItem variant="destructive" onSelect={() => setToUnplan(m)}>
                              <CalendarX /> Rimuovi da tutte le pianificazioni
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem variant="destructive" onSelect={() => askDelete(m)}>
                            <Trash2 /> Elimina
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </CardAction>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm h-full">
                    {COURSES.map((c) => {
                      const items = m.recipes.filter((r) => r.course === c);
                      // if (!items.length) return null;
                      return (
                        <div key={c}>
                          <div className="text-muted-foreground text-xs font-medium uppercase flex items-center gap-2">
                            {COURSE_LABELS[c]}
                            <Badge variant="secondary" className="text-muted-foreground">
                              {items?.length ?? 0}
                            </Badge>
                          </div>
                        </div>
                      );
                    })}
                    {(
                      <div>
                        <div className="text-muted-foreground text-xs font-medium uppercase flex items-center gap-2">
                          Piatti unici
                          <Badge variant="secondary" className="text-muted-foreground">
                            {m.dishes?.length ?? 0}
                          </Badge>
                        </div>
                      </div>
                    )}
                  </CardContent>
                  <CardFooter className="flex flex-wrap gap-2 items-center">
                    <Badge variant="outline">
                      {format(m.createdAt, 'dd/MM/yyyy')}
                    </Badge>
                    {m.planned?.length > 0 ? <Badge variant="secondary" asChild>
                      <Link to="/planner" search={{ meal: m.id }} title="Vedi le date nel planner">
                        <Lock /> Nel planner ({m.planned.length})
                      </Link>
                    </Badge>
                      : <Badge variant="secondary">Non pianificato</Badge>}
                  </CardFooter>
                </Card>
              ))}
            </div>
          </>
        )}
      </PageBody>

      {/* <RecipeDetailDialog recipeId={viewing} onClose={() => setViewing(null)} /> */}

      <AlertDialog open={!!toUnplan} onOpenChange={(o) => !o && setToUnplan(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rimuovere «{toUnplan?.name}» da tutte le pianificazioni?</AlertDialogTitle>
            <AlertDialogDescription>
              Verrà tolto dal planner in {toUnplan?.planned.length} {toUnplan?.planned.length === 1 ? "data" : "date"}, passate e future, insieme a coperti e
              coefficienti di quelle pianificazioni. Il menu resta e tornerà modificabile.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => toUnplan && removeFromPlanner.mutate(toUnplan.id)}>
              Rimuovi
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminare «{toDelete?.name}»?</AlertDialogTitle>
            <AlertDialogDescription>Le ricette del menu non verranno eliminate.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => toDelete && del.mutate(toDelete.id)}>
              Elimina
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

type PlannedFilter = "all" | "planned" | "unplanned";

/** Menus matching a name search, containing a recipe, and planned or not. */
export function filterMeals<T extends { name: string; recipes: { recipeId: string }[]; planned: unknown[] }>(
  meals: T[],
  { search, recipeId, planned }: { search: string; recipeId?: string; planned: PlannedFilter },
): T[] {
  const q = search.trim().toLowerCase();
  return meals.filter(
    (m) =>
      (!q || m.name.toLowerCase().includes(q)) &&
      (!recipeId || m.recipes.some((r) => r.recipeId === recipeId)) &&
      (planned === "all" || (planned === "planned") === m.planned.length > 0),
  );
}
