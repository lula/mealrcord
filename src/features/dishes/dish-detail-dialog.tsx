import { Link } from "@tanstack/react-router";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { formatNumber } from "@/lib/units";
import { useDish } from "./api";
import { TagBadges } from "../tags/tag-picker";

/** Read-only view of a recipe. Open with a recipe id, close with null. */
export function DishDetailDialog({ dishId, onClose }: { dishId: string | null; onClose: () => void }) {
  const { data: dish, isLoading } = useDish(dishId ?? undefined);

  return (
    <Dialog open={!!dishId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[85dvh] flex-col sm:max-w-lg">
        {isLoading || !dish ? (
          <>
            <DialogHeader>
              <DialogTitle>{isLoading ? "Caricamento…" : "Ricetta non trovata"}</DialogTitle>
            </DialogHeader>
            {isLoading && <Skeleton className="h-48 w-full" />}
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>{dish.name}</DialogTitle>
            </DialogHeader>

            <div className="-mx-4 min-h-0 flex-1 overflow-y-auto px-4">
              <div className="space-y-2 pb-1">
                {dish.recipes.map((r) => (
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
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" asChild>
                <Link to="/dishes/$dishId" params={{ dishId: dish.id }}>
                  <Pencil /> Modifica piatto unico
                </Link>
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
