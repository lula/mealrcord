import { useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { BookOpen, Copy, MoreHorizontal, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageBody, PageHeader } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { TagBadges, TagPicker } from "@/features/tags/tag-picker";
import { mealsUsingRecipe, useDeleteRecipe, useDuplicateRecipe, useRecipes, type RecipeListItem } from "./api";

export function RecipesPage() {
  const { data: recipes, isLoading } = useRecipes();
  const [search, setSearch] = useState("");
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [toDelete, setToDelete] = useState<RecipeListItem | null>(null);
  const navigate = useNavigate();
  const del = useDeleteRecipe();
  const duplicate = useDuplicateRecipe();

  const filtered = useMemo(() => filterRecipes(recipes ?? [], search, tagIds), [recipes, search, tagIds]);

  async function askDelete(r: RecipeListItem) {
    const usedIn = await mealsUsingRecipe(r.id);
    if (usedIn.length) {
      toast.error(`«${r.name}» è usata nei menu: ${usedIn.join(", ")}. Rimuovila prima da lì.`);
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
                <InputGroupInput placeholder="Cerca per nome…" value={search} onChange={(e) => setSearch(e.target.value)} />
              </InputGroup>
              <TagPicker value={tagIds} onChange={setTagIds} placeholder="Filtra per tag" />
              {(search || tagIds.length > 0) && (
                <Button variant="ghost" onClick={() => (setSearch(""), setTagIds([]))}>
                  Azzera filtri
                </Button>
              )}
            </div>
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Tag</TableHead>
                    <TableHead className="w-28 text-right">Persone</TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r) => (
                    <TableRow key={r.id} className="cursor-pointer" onClick={() => navigate({ to: "/recipes/$recipeId", params: { recipeId: r.id } })}>
                      <TableCell>
                        <div className="font-medium">{r.name}</div>
                        {r.description && <div className="text-muted-foreground line-clamp-1 max-w-xl text-xs">{r.description}</div>}
                      </TableCell>
                      <TableCell>
                        <TagBadges tags={r.tags.map((t) => t.tag)} />
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{r.baseServings}</TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" aria-label="Azioni">
                              <MoreHorizontal />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                              <Link to="/recipes/$recipeId" params={{ recipeId: r.id }}>
                                <Pencil /> Modifica
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => duplicate.mutate(r.id)}>
                              <Copy /> Duplica
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem variant="destructive" onSelect={() => askDelete(r)}>
                              <Trash2 /> Elimina
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filtered.length === 0 && !isLoading && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-muted-foreground h-24 text-center">
                        Nessuna ricetta corrisponde ai filtri.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </PageBody>

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminare «{toDelete?.name}»?</AlertDialogTitle>
            <AlertDialogDescription>La ricetta e i suoi ingredienti verranno eliminati. Gli ingredienti restano disponibili per altre ricette.</AlertDialogDescription>
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
  return recipes.filter(
    (r) => (!q || normalize(r.name).includes(q)) && tagIds.every((id) => r.tags.some((t) => t.tagId === id)),
  );
}

const normalize = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
