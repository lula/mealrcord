import { Link } from "@tanstack/react-router";
import { Pencil, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { RichText } from "@/components/rich-text";
import { formatQuantity } from "@/lib/units";
import { useRecipe } from "./api";

/** Read-only view of a recipe. Open with a recipe id, close with null. */
export function RecipeDetailDialog({ recipeId, onClose }: { recipeId: string | null; onClose: () => void }) {
  const { data: recipe, isLoading } = useRecipe(recipeId ?? undefined);

  return (
    <Dialog open={!!recipeId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[85dvh] flex-col sm:max-w-lg">
        {isLoading || !recipe ? (
          <>
            <DialogHeader>
              <DialogTitle>{isLoading ? "Caricamento…" : "Ricetta non trovata"}</DialogTitle>
            </DialogHeader>
            {isLoading && <Skeleton className="h-48 w-full" />}
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>{recipe.name}</DialogTitle>
              <DialogDescription className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">
                  <Users /> {recipe.baseServings} persone
                </Badge>
                {recipe.tags.map((t) => (
                  <Badge key={t.tagId} variant="outline">
                    {t.tag.name}
                  </Badge>
                ))}
                {recipe.allergens.map((a) => (
                  <Badge key={a.id} variant="destructive">
                    {a.name}
                  </Badge>
                ))}
              </DialogDescription>
            </DialogHeader>

            {/* Plain overflow container: the dialog only has a max height, so a ScrollArea's
                `h-full` viewport would not resolve and the content would spill out. */}
            <div className="-mx-4 min-h-0 flex-1 overflow-y-auto px-4">
              <div className="space-y-5 pb-1">
                <RichText value={recipe.description} />

                <section className="space-y-2">
                  <h3 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">Ingredienti</h3>
                  {recipe.ingredients.length === 0 ? (
                    <p className="text-muted-foreground text-sm">Nessun ingrediente.</p>
                  ) : (
                    <Table>
                      <TableBody>
                        {recipe.ingredients.map((ri) => (
                          <TableRow key={ri.ingredientId}>
                            <TableCell className="py-1.5">{ri.ingredient.name}</TableCell>
                            <TableCell className="py-1.5 text-right tabular-nums">{formatQuantity(ri.quantity, ri.unit)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </section>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" asChild>
                <Link to="/recipes/$recipeId" params={{ recipeId: recipe.id }}>
                  <Pencil /> Modifica ricetta
                </Link>
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
