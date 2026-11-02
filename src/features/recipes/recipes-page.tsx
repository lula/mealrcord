import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { BookOpen, Copy, EllipsisVertical, Pencil, Plus, Search, Trash2, Users, X } from "lucide-react";
import { toast } from "sonner";
import { PageBody, PageHeader } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Badge } from "@/components/ui/badge";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ListPagination } from "@/components/list-pagination";
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
import { toPlainText } from "@/lib/rich-text";
import { TagBadges, TagPicker } from "@/features/tags/tag-picker";
import { dishesUsingRecipe, mealsUsingRecipe, useDeleteRecipe, useDuplicateRecipe, useRecipes, type RecipeListItem } from "./api";
import { format } from "date-fns";

const PAGE_SIZE = 20;

export function RecipesPage() {
  const { data: recipes, isLoading } = useRecipes();
  const [search, setSearch] = useState("");
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [toDelete, setToDelete] = useState<RecipeListItem | null>(null);
  const del = useDeleteRecipe();
  const duplicate = useDuplicateRecipe();

  const [page, setPage] = useState(1);

  // Most recently changed first, PAGE_SIZE per page.
  const filtered = useMemo(
    () => filterRecipes(recipes ?? [], search, tagIds).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [recipes, search, tagIds],
  );
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageItems = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

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
              {(search || tagIds.length > 0) && (
                <Button variant="outline" onClick={() => (setSearch(""), setTagIds([]), setPage(1))}>
                  <X />
                  Rimuovi filtri
                </Button>
              )}
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
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
            <ListPagination page={currentPage} pageCount={pageCount} onChange={setPage} />
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

/** Name contains `search` (case/accents ignored) and has every tag in `tagIds`. */
export function filterRecipes<T extends { name: string; tags: { tagId: string }[] }>(recipes: T[], search: string, tagIds: string[]) {
  const q = normalize(search.trim());
  return recipes.filter((r) => (!q || normalize(r.name).includes(q)) && tagIds.every((id) => r.tags.some((t) => t.tagId === id)));
}

const normalize = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
