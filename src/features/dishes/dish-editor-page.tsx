import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { ArrowDown, ArrowLeft, ArrowUp, Plus, RotateCcw, Save, X } from "lucide-react";
import { PageBody, PageHeader } from "@/components/page";
import { RichTextEditor } from "@/components/rich-text-editor";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { RecipePicker } from "@/features/meals/recipe-picker";
import { useRecipes } from "@/features/recipes/api";
import { RecipeDetailDialog } from "@/features/recipes/recipe-detail-dialog";
import { useSettings } from "@/features/settings/api";
import { TagBadges } from "@/features/tags/tag-picker";
import { cn } from "@/lib/utils";
import { useDish, useSaveDish } from "./api";

const coefficient = z.number({ error: "Inserisci un numero" }).gt(0, "Deve essere maggiore di 0").max(10, "Massimo 10");

const schema = z.object({
  name: z.string().trim().min(1, "Inserisci un nome"),
  notes: z.string(),
  /** Presets the recipes' coefficients. */
  coefficient,
  recipes: z.array(z.object({ recipeId: z.string(), coefficient })).min(1, "Aggiungi almeno una ricetta"),
});

type FormValues = z.infer<typeof schema>;

const EMPTY: FormValues = { name: "", notes: "", coefficient: 1, recipes: [] };

/** Create (/dishes/new) or edit (/dishes/$dishId) a "piatto unico". */
export function DishEditorPage() {
  const { dishId } = useParams({ strict: false });
  const { data: dish, isLoading } = useDish(dishId);
  const { data: recipes = [] } = useRecipes();
  const { data: settings } = useSettings();
  const max = settings?.maxDishRecipes ?? 3;
  const save = useSaveDish();
  const navigate = useNavigate();
  const [picking, setPicking] = useState(false);
  const [viewing, setViewing] = useState<string | null>(null);

  const recipeNames = useMemo(() => new Map(recipes.map((r) => [r.id, r.name])), [recipes]);
  const recipeTags = useMemo(() => new Map(recipes.map((r) => [r.id, r.tags.map((t) => t.tag)])), [recipes]);
  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: EMPTY });
  const lines = useFieldArray({ control: form.control, name: "recipes" });
  // Recipes whose coefficient the user set; the others follow the dish coefficient.
  // A ref, so the effect below sees it right after the form is reset.
  const editedRef = useRef<Set<string>>(new Set());
  const [editedVersion, rerender] = useReducer((n: number) => n + 1, 0);
  const edited = editedRef.current;
  const markEdited = (id: string, on: boolean) => {
    const set = editedRef.current;
    if (on === set.has(id)) return;
    if (on) set.add(id);
    else set.delete(id);
    rerender();
  };

  useEffect(() => {
    if (!dish) {
      editedRef.current = new Set();
      return form.reset(EMPTY);
    }
    // A recipe with a value different from the dish's was set on purpose.
    editedRef.current = new Set(dish.recipes.filter((r) => r.coefficient !== dish.coefficient).map((r) => r.recipeId));
    form.reset({
      name: dish.name,
      notes: dish.notes,
      coefficient: dish.coefficient,
      recipes: dish.recipes.map((r) => ({ recipeId: r.recipeId, coefficient: r.coefficient })),
    });
  }, [dish, form]);

  // Changing the dish coefficient updates the recipes the user hasn't edited.
  const dishCoefficient = form.watch("coefficient");
  useEffect(() => {
    const value = form.getValues("coefficient");
    if (!Number.isFinite(value) || value <= 0) return;
    form.getValues("recipes").forEach((r, i) => {
      if (!editedRef.current.has(r.recipeId) && r.coefficient !== value) form.setValue(`recipes.${i}.coefficient`, value);
    });
  }, [dishCoefficient, editedVersion, form]);

  const onSubmit = form.handleSubmit(async (values) => {
    await save.mutateAsync({ id: dishId, ...values });
    navigate({ to: "/dishes" });
  });

  if (dishId && isLoading) {
    return (
      <PageBody>
        <Skeleton className="h-96 w-full" />
      </PageBody>
    );
  }
  if (dishId && !dish) {
    return (
      <>
        <PageHeader title="Piatto unico non trovato" />
        <PageBody>
          <Button asChild variant="outline">
            <Link to="/dishes">
              <ArrowLeft /> Torna ai piatti unici
            </Link>
          </Button>
        </PageBody>
      </>
    );
  }

  const ids = lines.fields.map((f) => f.recipeId);
  const recipesError = form.formState.errors.recipes;

  return (
    <form onSubmit={(e) => e.preventDefault()} className="flex flex-1 flex-col">
      <PageHeader
        title={dish ? dish.name : "Nuovo piatto unico"}
        actions={
          <>
            <Button type="button" variant="outline" asChild>
              <Link to="/dishes">
                <RotateCcw />
                Annulla
              </Link>
            </Button>
            <Button type="button" disabled={save.isPending} onClick={onSubmit}>
              <Save />
              Salva
            </Button>
          </>
        }
      />
      <PageBody className="grid items-start gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Dettagli</CardTitle>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <Field data-invalid={!!form.formState.errors.name}>
                <FieldLabel htmlFor="name">Nome</FieldLabel>
                <Input id="name" autoFocus={!dishId} {...form.register("name")} />
                <FieldError errors={[form.formState.errors.name]} />
              </Field>
              <Field>
                <FieldLabel htmlFor="notes">Note</FieldLabel>
                <Controller
                  control={form.control}
                  name="notes"
                  render={({ field }) => <RichTextEditor id="notes" value={field.value} onChange={field.onChange} onBlur={field.onBlur} minRows={3} />}
                />
              </Field>
              <Field data-invalid={!!form.formState.errors.coefficient} className="max-w-48">
                <FieldLabel htmlFor="coefficient">Coefficiente</FieldLabel>
                <Input id="coefficient" type="number" step="0.05" min={0.05} {...form.register("coefficient", { valueAsNumber: true })} />
                <FieldDescription>Preimposta il coefficiente delle ricette. Quelle che modifichi a mano tengono il loro valore.</FieldDescription>
                <FieldError errors={[form.formState.errors.coefficient]} />
              </Field>
            </FieldGroup>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Ricette</CardTitle>
            <CardDescription>
              Fino a {max} ricette nello stesso piatto. Il coefficiente scala le quantità di ogni ricetta (es. 0,5 per mezza porzione); in grigio
              quelli presi dal piatto.
            </CardDescription>
            <CardAction>
              <Button type="button" variant="outline" size="sm" onClick={() => setPicking(true)}>
                <Plus /> Aggiungi
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent className="space-y-2">
            {lines.fields.length === 0 && <p className="text-muted-foreground py-4 text-center text-sm">Nessuna ricetta.</p>}
            {lines.fields.map((line, i) => (
              <div key={line.id} className="bg-muted/50 flex items-center gap-1 rounded-md py-1 pr-1 pl-3 text-sm">
                <div className="min-w-0 flex-1 space-y-1 py-0.5">
                  <button
                    type="button"
                    className="hover:text-primary block max-w-full cursor-pointer truncate text-left hover:underline"
                    onClick={() => setViewing(line.recipeId)}
                  >
                    {recipeNames.get(line.recipeId) ?? "…"}
                  </button>
                  {(recipeTags.get(line.recipeId)?.length ?? 0) > 0 && <TagBadges tags={recipeTags.get(line.recipeId)!} />}
                </div>
                <span className="text-muted-foreground text-xs">Coefficiente</span>
                <Controller
                  control={form.control}
                  name={`recipes.${i}.coefficient`}
                  render={({ field, fieldState }) => (
                    <Input
                      type="number"
                      step="0.05"
                      min={0.05}
                      aria-label={`Coefficiente di ${recipeNames.get(line.recipeId) ?? "ricetta"}`}
                      className={cn("bg-background h-8 w-20", !edited.has(line.recipeId) && "text-muted-foreground")}
                      aria-invalid={!!fieldState.error}
                      value={Number.isFinite(field.value) ? field.value : ""}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => {
                        markEdited(line.recipeId, true);
                        field.onChange(e.target.value === "" ? Number.NaN : e.target.valueAsNumber);
                      }}
                      onBlur={() => {
                        // An emptied field goes back to the dish coefficient.
                        if (!Number.isFinite(field.value)) {
                          markEdited(line.recipeId, false);
                          field.onChange(form.getValues("coefficient"));
                        }
                        field.onBlur();
                      }}
                    />
                  )}
                />
                <Button type="button" variant="ghost" size="icon-sm" disabled={i === 0} onClick={() => lines.move(i, i - 1)} aria-label="Sposta su">
                  <ArrowUp />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  disabled={i === lines.fields.length - 1}
                  onClick={() => lines.move(i, i + 1)}
                  aria-label="Sposta giù"
                >
                  <ArrowDown />
                </Button>
                <Button type="button" variant="ghost" size="icon-sm" onClick={() => lines.remove(i)} aria-label="Rimuovi">
                  <X />
                </Button>
              </div>
            ))}
            <FieldError errors={[recipesError?.root ?? (recipesError?.message ? recipesError : undefined), ...(recipesError?.map?.((e) => e?.coefficient) ?? [])]} />
          </CardContent>
        </Card>
      </PageBody>

      <RecipePicker
        open={picking}
        onOpenChange={setPicking}
        title="Ricette del piatto unico"
        initialTagIds={[]}
        selected={ids}
        max={max}
        onConfirm={(next) => {
          // Keep the coefficients of recipes already in the dish; new ones start from the dish's.
          const current = new Map(form.getValues("recipes").map((r) => [r.recipeId, r.coefficient]));
          const preset = Number.isFinite(form.getValues("coefficient")) ? form.getValues("coefficient") : 1;
          form.setValue(
            "recipes",
            next.map((recipeId) => ({ recipeId, coefficient: current.get(recipeId) ?? preset })),
          );
          form.clearErrors("recipes");
        }}
      />
      <RecipeDetailDialog recipeId={viewing} onClose={() => setViewing(null)} />
    </form>
  );
}
