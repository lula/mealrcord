import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { COURSE_LABELS } from "@/features/meals/api";
import { displayQuantity, formatNumber } from "@/lib/units";
import { scalePlanned, type PlannedEntry } from "./api";

/** Recipes of a planned meal with ingredient quantities scaled to its guests. */
export function PlannedDetail({ entry }: { entry: PlannedEntry }) {
  const courses = scalePlanned(entry);
  const coef = entry.meal.coefficient;
  return (
    <div className="space-y-5">
      {coef !== 1 && (
        <p className="text-muted-foreground text-sm">
          Quantità ridotte con coefficiente <Badge variant="outline">×{formatNumber(coef)}</Badge>
        </p>
      )}
      {courses.map(({ course, recipes }) => (
        <section key={course} className="space-y-3">
          <h3 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">{COURSE_LABELS[course]}</h3>
          {recipes.map((r) => (
            <div key={r.recipeId} className="rounded-lg border">
              <div className="flex items-baseline justify-between gap-2 border-b px-3 py-2">
                <span className="font-medium">{r.name}</span>
                <span className="text-muted-foreground text-xs tabular-nums">×{formatNumber(r.factor)}</span>
              </div>
              {r.lines.length === 0 ? (
                <p className="text-muted-foreground px-3 py-2 text-sm">Nessun ingrediente.</p>
              ) : (
                <Table>
                  <TableBody>
                    {r.lines.map((l) => (
                      <TableRow key={l.key}>
                        <TableCell className="py-1.5">{l.ingredientName}</TableCell>
                        <TableCell className="py-1.5 text-right tabular-nums">{displayQuantity(l.quantity, l.unit)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}
