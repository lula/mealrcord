import { format, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import { COURSE_LABELS } from "@/features/meals/api";
import { TextWriter, type DocWriter } from "@/lib/doc-writer";
import { PdfWriter } from "@/lib/pdf";
import { toPlainParagraphs } from "@/lib/rich-text";
import { aggregate, displayQuantity, formatNumber, formatQuantity, type AggregatedLine } from "@/lib/units";
import { plannedLines, scalePlanned, scalePlannedDishes, type PlannedEntry, type ScaledDish, type ScaledRecipe } from "./api";

type Group = { name: string; lines: AggregatedLine[] };

const rows = (lines: AggregatedLine[]): [string, string][] => lines.map((l) => [l.ingredientName, formatQuantity(l.quantity, l.unit)]);

/** Creates the writer of the chosen format; `context` describes the document (header of each page, first line of a note). */
type MakeWriter<W extends DocWriter> = (context: string) => W;

const pdfWriter = (context: string) => new PdfWriter(context);
const textWriter = (context: string) => new TextWriter(context);

function categoriesSection(pdf: DocWriter, groups: Group[]) {
  for (const g of groups) {
    pdf.heading(g.name, 2);
    pdf.table(rows(g.lines));
  }
}

/** Shopping list of a period: the full list, then the same list by category. */
function shoppingList<W extends DocWriter>(make: MakeWriter<W>, title: string, period: string, subtitle: string, lines: AggregatedLine[], groups: Group[]) {
  const pdf = make(`${title} · ${period}`);
  pdf.title(title);
  pdf.subtitle(`${period} · ${subtitle}`);
  pdf.heading("Totale");
  pdf.table(rows(lines));
  pdf.pageBreak();
  pdf.heading("Per categoria");
  categoriesSection(pdf, groups);
  return pdf;
}

export const shoppingListPdf = (title: string, period: string, subtitle: string, lines: AggregatedLine[], groups: Group[]) =>
  shoppingList(pdfWriter, title, period, subtitle, lines, groups);
export const shoppingListText = (title: string, period: string, subtitle: string, lines: AggregatedLine[], groups: Group[]) =>
  shoppingList(textWriter, title, period, subtitle, lines, groups).toString();

export const plannedTitle = (entry: PlannedEntry) => `${entry.slot} ${entry.meal.name} ${format(parseISO(entry.date), "d-M-yyyy")}`;

/**
 * One planned menu: its composition, then (new page) the shopping list total,
 * by ingredient category and per recipe, then one page per recipe with its preparation.
 */
function plannedMenu<W extends DocWriter>(make: MakeWriter<W>, entry: PlannedEntry, groups: Group[]) {
  const descriptions = new Map<string, string>([
    ...entry.meal.recipes.map(({ recipe }) => [recipe.id, recipe.description] as const),
    ...entry.meal.dishes.flatMap(({ dish }) => dish.recipes.map(({ recipe }) => [recipe.id, recipe.description] as const)),
  ]);
  const courses = scalePlanned(entry).filter((c) => c.recipes.length);
  const dishes = scalePlannedDishes(entry);
  const withCoeff = (label: string, coefficient: number) => (coefficient !== 1 ? `${label} (coeff. ×${formatNumber(coefficient)})` : label);
  const dishMeta = (d: ScaledDish, r: ScaledDish["recipes"][number]) =>
    `Ricetta del piatto unico «${d.name}» · ${d.guests} coperti${r.coefficient !== 1 ? ` · coeff. ${formatNumber(r.coefficient)}` : ""} · ×${formatNumber(r.factor)}`;

  // Every recipe once, in menu order, with where it sits in the menu.
  // `key` links the composition to the recipe's preparation page.
  const courseKey = (course: string, r: ScaledRecipe) => `course:${course}:${r.recipeId}`;
  const dishKey = (d: ScaledDish, r: ScaledRecipe) => `dish:${d.dishId}:${r.recipeId}`;
  const all: { recipe: ScaledRecipe; context: string; key: string }[] = [
    ...courses.flatMap((c) =>
      c.recipes.map((r) => ({ recipe: r, key: courseKey(c.course, r), context: `${COURSE_LABELS[c.course]} · ${r.guests} coperti · ×${formatNumber(r.factor)}` })),
    ),
    ...(dishes?.dishes.flatMap((d) => d.recipes.map((r) => ({ recipe: r, key: dishKey(d, r), context: dishMeta(d, r) }))) ?? []),
  ];

  const pdf = make(`${entry.meal.name} del ${format(parseISO(entry.date), "dd/MM/yyyy")} ${entry.slot.toLowerCase()}`);
  pdf.cover(entry.meal.name, `${format(parseISO(entry.date), "EEEE d MMMM yyyy", { locale: it })}`, `${entry.slot}`, `${entry.guests} coperti`);

  // 1. Menu composition
  pdf.heading(`Composizione del menu (${entry.guests} coperti)`);
  for (const { course, coefficient, recipes } of courses) {
    pdf.heading(withCoeff(COURSE_LABELS[course], coefficient), 2);
    // pdf.paragraph(recipes.map((r) => `• ${r.name} (${r.guests} coperti)`).join("\n"));
    for (const r of recipes) pdf.link(`• ${r.name}`, courseKey(course, r));
  }
  if (dishes) {
    pdf.heading(withCoeff("Piatti unici", dishes.coefficient), 2);
    for (const d of dishes.dishes) {
      // pdf.heading(`${d.name} (${d.guests} coperti)`, 3);
      pdf.heading(`${d.name}`, 3);
      for (const r of d.recipes) pdf.link(`• ${r.name}`, dishKey(d, r));
    }
  }

  // 2. Shopping list: total and per recipe
  pdf.pageBreak();
  pdf.heading("Lista della spesa");
  const total = aggregate(plannedLines(entry));
  if (total.length) pdf.table(rows(total));
  else pdf.paragraph("Nessun ingrediente.");
  if (groups.length) {
    pdf.heading("Per categoria");
    categoriesSection(pdf, groups);
  }
  pdf.heading("Per ricetta");
  for (const { recipe: r, context } of all) {
    pdf.heading(r.name, 2);
    pdf.subtitle(context);
    if (r.lines.length) pdf.table(r.lines.map((l) => [l.ingredientName, displayQuantity(l.quantity, l.unit)]));
    else pdf.paragraph("Nessun ingrediente.", { muted: true });
  }

  // 3. One page per recipe with its preparation
  for (const { recipe: r, context, key } of all) {
    pdf.pageBreak();
    pdf.anchor(key);
    pdf.title(r.name);
    pdf.subtitle(context);
    pdf.heading("Preparazione", 2);
    pdf.paragraph(toPlainParagraphs(descriptions.get(r.recipeId) ?? "") || "Nessuna preparazione indicata.");
  }
  return pdf;
}

/** `groups`: the menu's shopping list by ingredient category (see `useGroupByCategory`). */
export const plannedMenuPdf = (entry: PlannedEntry, groups: Group[]) => plannedMenu(pdfWriter, entry, groups);
export const plannedMenuText = (entry: PlannedEntry, groups: Group[]) => plannedMenu(textWriter, entry, groups).toString();
