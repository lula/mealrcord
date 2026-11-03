import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Copy, CookingPot, EllipsisVertical, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { toast } from "sonner";
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
import { PageBody, PageHeader } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { TagBadges } from "@/features/tags/tag-picker";
import { toPlainText } from "@/lib/rich-text";
import { formatNumber } from "@/lib/units";
import { mealsUsingDish, useDeleteDish, useDishes, useDuplicateDish, type DishListItem } from "./api";

/** Catalog of "piatti unici". */
export function DishesPage() {
  const { data: dishes, isLoading } = useDishes();
  const duplicate = useDuplicateDish();
  const del = useDeleteDish();
  const [search, setSearch] = useState("");
  const [toDelete, setToDelete] = useState<DishListItem | null>(null);
  const [viewing, setViewing] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (dishes ?? []).filter((d) => !q || d.name.toLowerCase().includes(q) || d.recipes.some((r) => r.recipe.name.toLowerCase().includes(q)));
  }, [dishes, search]);

  async function askDelete(d: DishListItem) {
    const usedIn = await mealsUsingDish(d.id);
    if (usedIn.length) {
      toast.error(`«${d.name}» è nei menu: ${usedIn.join(", ")}. Rimuovilo prima da lì.`);
      return;
    }
    setToDelete(d);
  }

  return (
    <>
      <PageHeader
        title="Piatti unici"
        description={dishes && (search.trim() ? `${filtered.length} di ${dishes.length} piatti unici` : `${dishes.length} piatti unici`)}
        actions={
          <Button asChild>
            <Link to="/dishes/new">
              <Plus /> Nuovo piatto unico
            </Link>
          </Button>
        }
      />
      <PageBody className="space-y-4">
        {!isLoading && dishes?.length === 0 ? (
          <Empty className="border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <CookingPot />
              </EmptyMedia>
              <EmptyTitle>Nessun piatto unico</EmptyTitle>
              <EmptyDescription>Un piatto unico mette più ricette nello stesso piatto, ognuna con il suo coefficiente.</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button asChild>
                <Link to="/dishes/new">
                  <Plus /> Nuovo piatto unico
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
                <InputGroupInput placeholder="Cerca per nome o ricetta…" value={search} onChange={(e) => setSearch(e.target.value)} />
              </InputGroup>
              {search && (
                <Button variant="ghost" onClick={() => setSearch("")}>
                  <X /> Azzera
                </Button>
              )}
            </div>
            {filtered.length === 0 && !isLoading && (
              <Empty className="border">
                <EmptyHeader>
                  <EmptyTitle>Nessun piatto unico trovato</EmptyTitle>
                  <EmptyDescription>Nessun piatto unico corrisponde alla ricerca.</EmptyDescription>
                </EmptyHeader>
              </Empty>
            )}
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {filtered.map((d) => (
                <Card key={d.id} className="hover:border-primary/40 transition-colors">
                  <CardHeader>
                    <CardTitle>
                      <Link to="/dishes/$dishId" params={{ dishId: d.id }} className="hover:underline">
                        {d.name}
                      </Link>
                    </CardTitle>
                    <CardDescription className="line-clamp-2">
                      {toPlainText(d.notes) || (d.meals.length ? `In ${d.meals.length} menu` : " ")}
                    </CardDescription>
                    <CardAction>
                      <Button variant="ghost" size="icon" aria-label="Modifica" title="Modifica" asChild>
                        <Link to="/dishes/$dishId" params={{ dishId: d.id }}>
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
                          <DropdownMenuItem disabled={duplicate.isPending} onSelect={() => duplicate.mutate(d.id)}>
                            <Copy /> Duplica
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem variant="destructive" onSelect={() => askDelete(d)}>
                            <Trash2 /> Elimina
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </CardAction>
                  </CardHeader>
                  <CardContent className="space-y-4 text-sm h-full">
                    {d.recipes.map((r) => (
                      <div key={r.recipeId}>
                        <div className="text-muted-foreground text-xs font-medium uppercase flex items-center gap-2">
                          {r.recipe.name}
                          <span className="text-muted-foreground text-xs tabular-nums">×{formatNumber(r.coefficient)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {r.recipe.tags.length > 0 && <TagBadges tags={r.recipe.tags.map((t) => t.tag)} />}
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}
      </PageBody >

      {/* <RecipeDetailDialog recipeId={viewing} onClose={() => setViewing(null)} /> */}

      < AlertDialog open={!!toDelete
      } onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminare «{toDelete?.name}»?</AlertDialogTitle>
            <AlertDialogDescription>Le ricette del piatto unico non verranno eliminate.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => toDelete && del.mutate(toDelete.id)}>
              Elimina
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog >
    </>
  );
}
