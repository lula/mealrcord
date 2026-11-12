import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowDownWideNarrow, ArrowUpNarrowWide, BookOpen, Copy, EllipsisVertical, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { PageBody, PageHeader } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Badge } from "@/components/ui/badge";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ListPagination } from "@/components/list-pagination";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import { AllergenBadges, AllergenPicker } from "@/features/allergens/allergen-picker";
import { TagBadges, TagPicker } from "@/features/tags/tag-picker";
import { dishesUsingRecipe, mealsUsingRecipe, useDeleteRecipe, useDuplicateRecipe, useRecipes, type RecipeListItem } from "./api";
import { format } from "date-fns";

const PAGE_SIZES = [20, 50, 100] as const;

const SORT_LABELS = { name: "Nome", createdAt: "Data creazione", updatedAt: "Ultima modifica" } as const;
export type RecipeSort = keyof typeof SORT_LABELS;
export type SortDirection = "asc" | "desc";

export function RecipesPage() {
  const { data: recipes, isLoading } = useRecipes();
  const [search, setSearch] = useState("");
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [allergenIds, setAllergenIds] = useState<string[]>([]);
  const [toDelete, setToDelete] = useState<RecipeListItem | null>(null);
  const del = useDeleteRecipe();
  const duplicate = useDuplicateRecipe();

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(20);
  const [sort, setSort] = useState<RecipeSort>("name");
  const [direction, setDirection] = useState<SortDirection>("asc");

  // Sorted as chosen (name A→Z by default), `pageSize` per page.
  const filtered = useMemo(
    () => sortRecipes(filterRecipes(recipes ?? [], search, tagIds, allergenIds), sort, direction),
    [recipes, search, tagIds, allergenIds, sort, direction],
  );
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pageItems = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  async function askDelete(r: RecipeListItem) {
    const usedIn = await mealsUsingRecipe(r.id);
    if (usedIn.length) {
      toast.error(`«${r.name}» è usata nei menu: ${usedIn.join(", ")}. Rimuovila prima da lì.`);
      return;
    }
    const inDishes = await dishesUsingRecipe(r.id);
    if (inDishes.length) {
      toast.error(`«${r.name}» è usata nei piatti unici: ${inDishes.join(", ")}. Rimuovila prima da lì.`);
      return;
    }
    setToDelete(r);
  }

  return (
    <>
      <PageHeader
        title="Ricette"
        description={recipes && `${recipes.length} ricette`}
        actions={
          <Button asChild>
            <Link to="/recipes/new">
              <Plus /> Nuova ricetta
            </Link>
          </Button>
        }
      />
      <PageBody className="space-y-4">
        {!isLoading && recipes?.length === 0 ? (
          <Empty className="border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <BookOpen />
              </EmptyMedia>
              <EmptyTitle>Nessuna ricetta</EmptyTitle>
              <EmptyDescription>Crea la prima ricetta con i suoi ingredienti.</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button asChild>
                <Link to="/recipes/new">
                  <Plus /> Nuova ricetta
                </Link>
              </Button>
            </EmptyContent>
          </Empty>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              <InputGroup className="max-w-sm">
                <InputGroupAddon>
                  <Search />
                </InputGroupAddon>
                <InputGroupInput placeholder="Cerca per nome…" value={search} onChange={(e) => (setSearch(e.target.value), setPage(1))} />
              </InputGroup>
              <TagPicker value={tagIds} onChange={(ids) => (setTagIds(ids), setPage(1))} placeholder="Filtra per tag" />
              <AllergenPicker value={allergenIds} onChange={(ids) => (setAllergenIds(ids), setPage(1))} placeholder="Filtra per allergeni" />
              {(search || tagIds.length > 0 || allergenIds.length > 0) && (
                <Button variant="outline" onClick={() => (setSearch(""), setTagIds([]), setAllergenIds([]), setPage(1))}>
                  <X />
                  Rimuovi filtri
                </Button>
              )}
              <div className="ml-auto flex gap-1">
                <Select value={sort} onValueChange={(v) => (setSort(v as RecipeSort), setPage(1))}>
                  <SelectTrigger className="w-44" aria-label="Ordina per">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(SORT_LABELS) as RecipeSort[]).map((k) => (
                      <SelectItem key={k} value={k}>
                        {SORT_LABELS[k]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="icon"
                  aria-label={direction === "asc" ? "Crescente" : "Decrescente"}
                  title={direction === "asc" ? "Crescente" : "Decrescente"}
                  onClick={() => (setDirection((d) => (d === "asc" ? "desc" : "asc")), setPage(1))}
                >
                  {direction === "asc" ? <ArrowUpNarrowWide /> : <ArrowDownWideNarrow />}
                </Button>
              </div>
            </div>
            {filtered.length === 0 && !isLoading ? (
              <Empty className="border">
                <EmptyHeader>
                  <EmptyTitle>Nessuna ricetta trovata</EmptyTitle>
                  <EmptyDescription>Nessuna ricetta corrisponde ai filtri.</EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {pageItems.map((r) => (
                  <Card key={r.id} className="hover:border-primary/40 transition-colors">
                    <CardHeader>
                      <CardTitle>
                        <Link to="/recipes/$recipeId" params={{ recipeId: r.id }} className="hover:underline">
                          {r.name}
                        </Link>
                      </CardTitle>
                      {/* <CardDescription className="line-clamp-2">{toPlainText(r.description) || "\u00a0"}</CardDescription> */}
                      <CardAction>
                        <Button variant="ghost" size="icon" aria-label="Modifica" title="Modifica" asChild>
                          <Link to="/recipes/$recipeId" params={{ recipeId: r.id }}>
                            <Pencil />
                          </Link>
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" aria-label="Altre azioni">
                              <EllipsisVertical />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onSelect={() => duplicate.mutate(r.id)}>
                              <Copy /> Duplica
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem variant="destructive" onSelect={() => askDelete(r)}>
                              <Trash2 /> Elimina
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </CardAction>
                    </CardHeader>
                    <CardContent className="mt-auto flex flex-wrap items-center gap-2 text-sm">
                      <Badge variant="outline">
                        {format(r.createdAt, 'dd/MM/yyyy')}
                      </Badge>
                      {/* <Badge variant="secondary">
                        <Users /> {r.baseServings} persone
                      </Badge> */}
                      <TagBadges tags={r.tags.map((t) => t.tag)} />
                      <AllergenBadges allergens={r.allergens} />
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
            {filtered.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-muted-foreground flex items-center gap-2 text-sm">
                  <span>
                    {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, filtered.length)} di {filtered.length}
                  </span>
                  <span>·</span>
                  <span>Per pagina</span>
                  <Select value={String(pageSize)} onValueChange={(v) => (setPageSize(Number(v)), setPage(1))}>
                    <SelectTrigger size="sm" className="w-20" aria-label="Ricette per pagina">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAGE_SIZES.map((n) => (
                        <SelectItem key={n} value={String(n)}>
                          {n}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <ListPagination page={currentPage} pageCount={pageCount} onChange={setPage} className="mx-0 w-auto" />
              </div>
            )}
          </>
        )}
      </PageBody>

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminare «{toDelete?.name}»?</AlertDialogTitle>
            <AlertDialogDescription>
              La ricetta e i suoi ingredienti verranno eliminati. Gli ingredienti restano disponibili per altre ricette.
            </AlertDialogDescription>
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

/** Recipes ordered by `sort` (names compared the Italian way, ignoring case), ties broken by name. */
export function sortRecipes<T extends { name: string; createdAt: string; updatedAt: string }>(recipes: T[], sort: RecipeSort, direction: SortDirection) {
  const byName = (a: T, b: T) => a.name.localeCompare(b.name, "it", { sensitivity: "base" });
  const sign = direction === "asc" ? 1 : -1;
  return [...recipes].sort((a, b) => sign * (sort === "name" ? byName(a, b) : a[sort].localeCompare(b[sort]) || byName(a, b)));
}

/** Name contains `search` (case/accents ignored), has every tag in `tagIds` and every allergen in `allergenIds`. */
export function filterRecipes<T extends { name: string; tags: { tagId: string }[]; allergens?: { id: string }[] }>(
  recipes: T[],
  search: string,
  tagIds: string[],
  allergenIds: string[] = [],
) {
  const q = normalize(search.trim());
  return recipes.filter(
    (r) =>
      (!q || normalize(r.name).includes(q)) &&
      tagIds.every((id) => r.tags.some((t) => t.tagId === id)) &&
      allergenIds.every((id) => r.allergens?.some((a) => a.id === id)),
  );
}

const normalize = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
