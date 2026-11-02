import { Link } from "@tanstack/react-router";
import { Edit2, Plus, Trash2, UtensilsCrossed } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { PageBody, PageHeader } from "@/components/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { COURSES } from "@/db/schema";
import { formatNumber } from "@/lib/units";
import { COURSE_LABELS, plannedUsageCount, useDeleteMeal, useMeals, type MealListItem } from "./api";

export function MealsPage() {
  const { data: meals, isLoading } = useMeals();
  const del = useDeleteMeal();
  const [toDelete, setToDelete] = useState<MealListItem | null>(null);

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
        title="Pasti"
        description={meals && `${meals.length} pasti`}
        actions={
          <Button asChild>
            <Link to="/meals/new">
              <Plus /> Nuovo pasto
            </Link>
          </Button>
        }
      />
      <PageBody>
        {!isLoading && meals?.length === 0 ? (
          <Empty className="border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <UtensilsCrossed />
              </EmptyMedia>
              <EmptyTitle>Nessun pasto</EmptyTitle>
              <EmptyDescription>Un pasto raggruppa ricette in antipasti, primi, secondi e dolci.</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button asChild>
                <Link to="/meals/new">
                  <Plus /> Nuovo pasto
                </Link>
              </Button>
            </EmptyContent>
          </Empty>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {meals?.map((m) => (
              <Card key={m.id} className="hover:border-primary/40 transition-colors">
                <CardHeader>
                  <CardTitle>
                    <Link to="/meals/$mealId" params={{ mealId: m.id }} className="hover:underline">
                      {m.name}
                    </Link>
                  </CardTitle>
                  <CardDescription>
                    {m.coefficient !== 1 || m.courseCoefficients.length > 0 ? (
                      <Badge variant="outline">
                        Coefficiente ×{formatNumber(m.coefficient)}
                        {m.courseCoefficients.length > 0 && " (varia per portata)"}
                      </Badge>
                    ) : (
                      m.notes || " "
                    )}
                  </CardDescription>
                  <CardAction>
                    <Button variant="ghost" size="icon" aria-label="Modifica" asChild>
                      <Link to="/meals/$mealId" params={{ mealId: m.id }} className="hover:underline">
                        <Edit2 />
                      </Link>
                    </Button>
                    <Button variant="ghost" size="icon" aria-label="Elimina" onClick={() => askDelete(m)}>
                      <Trash2 />
                    </Button>
                  </CardAction>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {COURSES.map((c) => {
                    const items = m.recipes.filter((r) => r.course === c);
                    if (!items.length) return null;
                    return (
                      <div key={c}>
                        <div className="text-muted-foreground text-xs font-medium uppercase">{COURSE_LABELS[c]}</div>
                        <div>{items.map((r) => r.recipe.name).join(" · ")}</div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </PageBody>

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminare «{toDelete?.name}»?</AlertDialogTitle>
            <AlertDialogDescription>Le ricette del pasto non verranno eliminate.</AlertDialogDescription>
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
