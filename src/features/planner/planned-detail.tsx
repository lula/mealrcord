import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { COURSE_LABELS } from "@/features/meals/api";
import { aggregate, displayQuantity, formatNumber, formatQuantity } from "@/lib/units";
import { plannedLines, scalePlanned, scalePlannedDishes, type ScalableEntry, type ScaledRecipe } from "./api";

function SectionTitle({ title, coefficient }: { title: string; coefficient: number }) {
  return (
    <div className="flex items-center gap-2">
      <h3 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">{title}</h3>
      {coefficient !== 1 && (
        <Badge variant="outline" title="Coefficiente quantità">
          ×{formatNumber(coefficient)}
        </Badge>
      )}
    </div>
  );
}

function IngredientRows({ recipe }: { recipe: ScaledRecipe }) {
  if (recipe.lines.length === 0) return <p className="text-muted-foreground px-3 py-2 text-sm">Nessun ingrediente.</p>;
  return (
    <Table>
      <TableBody>
        {recipe.lines.map((l) => (
          <TableRow key={l.key}>
            <TableCell className="py-1.5">{l.ingredientName}</TableCell>
            <TableCell className="py-1.5 text-right tabular-nums">{displayQuantity(l.quantity, l.unit)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

/** Recipes of a planned meal with ingredient quantities scaled to its guests. */
export function PlannedDetail({ entry }: { entry: ScalableEntry }) {
  const courses = scalePlanned(entry);
  const dishes = scalePlannedDishes(entry);
  return (
    <div className="space-y-5">
      {courses.map(({ course, coefficient, recipes }) => (
        <section key={course} className="space-y-3">
          <SectionTitle title={COURSE_LABELS[course]} coefficient={coefficient} />
          {recipes.map((r) => (
            <div key={r.recipeId} className="rounded-lg border">
              <div className="flex items-baseline justify-between gap-2 border-b px-3 py-2">
                <span className="font-medium">{r.name}</span>
                <span className="text-muted-foreground text-xs tabular-nums">
                  {r.guests} coperti · ×{formatNumber(r.factor)}
                </span>
              </div>
              <IngredientRows recipe={r} />
            </div>
          ))}
        </section>
      ))}
      {dishes && (
        <section className="space-y-3">
          <SectionTitle title="Piatti unici" coefficient={dishes.coefficient} />
          {dishes.dishes.map((d) => (
            <div key={d.dishId} className="rounded-lg border">
              <div className="bg-muted/50 flex items-baseline justify-between gap-2 border-b px-3 py-2">
                <span className="font-medium">{d.name}</span>
                <span className="text-muted-foreground text-xs tabular-nums">{d.guests} coperti</span>
              </div>
              {d.recipes.map((r) => (
                <div key={r.recipeId} className="border-b last:border-b-0">
                  <div className="flex items-baseline justify-between gap-2 px-3 pt-2 text-sm">
                    <span>{r.name}</span>
                    <span className="text-muted-foreground text-xs tabular-nums">
                      {r.coefficient !== 1 && `coeff. ${formatNumber(r.coefficient)} · `}×{formatNumber(r.factor)}
                    </span>
                  </div>
                  <IngredientRows recipe={r} />
                </div>
              ))}
            </div>
          ))}
        </section>
      )}
    </div>
  );
}

/** Quantities of a planned meal in two tabs: one flat list of ingredients, and per recipe. */
export function PlannedQuantities({ entry }: { entry: ScalableEntry }) {
  return (
    <Tabs defaultValue="total">
      <TabsList className="mb-3">
        <TabsTrigger value="total">Lista delle spesa</TabsTrigger>
        <TabsTrigger value="recipes">Per ricetta</TabsTrigger>
      </TabsList>
      <TabsContent value="total">
        <IngredientTotals entry={entry} />
      </TabsContent>
      <TabsContent value="recipes">
        <PlannedDetail entry={entry} />
      </TabsContent>
    </Tabs>
  );
}

/** Every ingredient of the planned meal, summed across recipes (same totals as the shopping list). */
export function IngredientTotals({ entry }: { entry: ScalableEntry }) {
  const lines = aggregate(plannedLines(entry));
  if (lines.length === 0) return <p className="text-muted-foreground text-sm">Nessun ingrediente.</p>;
  return (
    <div className="rounded-lg border">
      <Table>
        <TableBody>
          {lines.map((l) => (
            <TableRow key={l.key}>
              <TableCell className="py-1.5">{l.ingredientName}</TableCell>
              <TableCell className="py-1.5 text-right tabular-nums">{formatQuantity(l.quantity, l.unit)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
