import { useEffect } from "react";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { ArrowDown, ArrowLeft, ArrowUp, Plus, Trash2 } from "lucide-react";
import { PageBody, PageHeader } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { IngredientCombobox } from "@/features/ingredients/ingredient-combobox";
import { TagPicker } from "@/features/tags/tag-picker";
import { UnitSelect } from "@/features/units/unit-select";
import { useRecipe, useSaveRecipe, type RecipeDetail } from "./api";

const DEFAULT_UNIT_ID = "unit-g";

const schema = z.object({
  name: z.string().trim().min(1, "Inserisci un nome"),
  description: z.string(),
  baseServings: z.number({ error: "Inserisci un numero" }).int("Numero intero").min(1, "Almeno 1 persona"),
  ingredients: z.array(
    z.object({
      ingredientId: z.string().min(1, "Scegli un ingrediente"),
      quantity: z.number({ error: "Quantità" }).min(0, "Non negativa"),
      unitId: z.string().min(1, "Unità"),
    }),
  ),
  steps: z.array(z.object({ text: z.string() })),
  tagIds: z.array(z.string()),
});

type FormValues = z.infer<typeof schema>;

const EMPTY: FormValues = { name: "", description: "", baseServings: 4, ingredients: [], steps: [], tagIds: [] };

function toForm(r: RecipeDetail): FormValues {
  return {
    name: r.name,
    description: r.description,
    baseServings: r.baseServings,
    ingredients: r.ingredients.map(({ ingredientId, quantity, unitId }) => ({ ingredientId, quantity, unitId })),
    steps: r.steps.map((st) => ({ text: st.text })),
    tagIds: r.tags.map((t) => t.tagId),
  };
}

export function RecipeEditorPage() {
  const { recipeId } = useParams({ strict: false });
  const { data: recipe, isLoading } = useRecipe(recipeId);
  const save = useSaveRecipe();
  const navigate = useNavigate();

  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: EMPTY });
  const lines = useFieldArray({ control: form.control, name: "ingredients" });
  const steps = useFieldArray({ control: form.control, name: "steps" });

  useEffect(() => {
    form.reset(recipe ? toForm(recipe) : EMPTY);
  }, [recipe, form]);

  const onSubmit = form.handleSubmit(async (values) => {
    await save.mutateAsync({ id: recipeId, ...values, steps: values.steps.map((st) => st.text) });
    navigate({ to: "/recipes" });
  });

  const used = form.watch("ingredients").map((i) => i.ingredientId);

  if (recipeId && isLoading) {
    return (
      <PageBody>
        <Skeleton className="h-96 w-full" />
      </PageBody>
    );
  }
  if (recipeId && !recipe) {
    return (
      <>
        <PageHeader title="Ricetta non trovata" />
        <PageBody>
          <Button asChild variant="outline">
            <Link to="/recipes">
              <ArrowLeft /> Torna alle ricette
            </Link>
          </Button>
        </PageBody>
      </>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-1 flex-col">
      <PageHeader
        title={recipe ? recipe.name : "Nuova ricetta"}
        actions={
          <>
            <Button variant="outline" asChild>
              <Link to="/recipes">Annulla</Link>
            </Button>
            <Button type="submit" disabled={save.isPending}>
              Salva
            </Button>
          </>
        }
      />
      <PageBody className="flex flex-col gap-6">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          <Card className="self-start">
            <CardHeader>
              <CardTitle>Dettagli</CardTitle>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <Field data-invalid={!!form.formState.errors.name}>
                  <FieldLabel htmlFor="name">Nome</FieldLabel>
                  <Input id="name" autoFocus={!recipeId} {...form.register("name")} />
                  <FieldError errors={[form.formState.errors.name]} />
                </Field>
                <Field>
                  <FieldLabel htmlFor="description">Descrizione</FieldLabel>
                  <Textarea id="description" rows={5} {...form.register("description")} />
                </Field>
                <Field data-invalid={!!form.formState.errors.baseServings} className="max-w-40">
                  <FieldLabel htmlFor="baseServings">Persone (base)</FieldLabel>
                  <Input id="baseServings" type="number" min={1} step={1} {...form.register("baseServings", { valueAsNumber: true })} />
                  <FieldError errors={[form.formState.errors.baseServings]} />
                </Field>
                <Field>
                  <FieldLabel>Tag</FieldLabel>
                  <Controller
                    control={form.control}
                    name="tagIds"
                    render={({ field }) => <TagPicker value={field.value} onChange={field.onChange} allowCreate placeholder="Aggiungi tag" />}
                  />
                </Field>
              </FieldGroup>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Ingredienti</CardTitle>
              <CardDescription>Quantità per {form.watch("baseServings") || "?"} persone.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {lines.fields.length === 0 && <p className="text-muted-foreground py-4 text-center text-sm">Nessun ingrediente.</p>}
              {lines.fields.map((line, i) => {
                const err = form.formState.errors.ingredients?.[i];
                return (
                  <div key={line.id} className="grid grid-cols-[minmax(0,1fr)_6rem_7.5rem_auto] items-start gap-2">
                    <Field data-invalid={!!err?.ingredientId}>
                      <Controller
                        control={form.control}
                        name={`ingredients.${i}.ingredientId`}
                        render={({ field }) => (
                          <IngredientCombobox
                            value={field.value}
                            exclude={used}
                            onChange={(id, defaultUnitId) => {
                              field.onChange(id);
                              if (defaultUnitId) form.setValue(`ingredients.${i}.unitId`, defaultUnitId);
                            }}
                          />
                        )}
                      />
                      <FieldError errors={[err?.ingredientId]} />
                    </Field>
                    <Field data-invalid={!!err?.quantity}>
                      <Input
                        type="number"
                        step="any"
                        min={0}
                        aria-label="Quantità"
                        {...form.register(`ingredients.${i}.quantity`, { valueAsNumber: true })}
                      />
                    </Field>
                    <Controller
                      control={form.control}
                      name={`ingredients.${i}.unitId`}
                      render={({ field }) => <UnitSelect value={field.value} onChange={field.onChange} className="w-full" />}
                    />
                    <div className="flex">
                      <Button type="button" variant="ghost" size="icon" disabled={i === 0} onClick={() => lines.move(i, i - 1)} aria-label="Sposta su">
                        <ArrowUp />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        disabled={i === lines.fields.length - 1}
                        onClick={() => lines.move(i, i + 1)}
                        aria-label="Sposta giù"
                      >
                        <ArrowDown />
                      </Button>
                      <Button type="button" variant="ghost" size="icon" onClick={() => lines.remove(i)} aria-label="Rimuovi">
                        <Trash2 />
                      </Button>
                    </div>
                  </div>
                );
              })}
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => lines.append({ ingredientId: "", quantity: 0, unitId: DEFAULT_UNIT_ID }, { shouldFocus: false })}
              >
                <Plus /> Aggiungi ingrediente
              </Button>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Preparazione</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {steps.fields.length === 0 && <p className="text-muted-foreground py-4 text-center text-sm">Nessun passo.</p>}
            {steps.fields.map((step, i) => (
              <div key={step.id} className="grid grid-cols-[1.5rem_minmax(0,1fr)_auto] items-start gap-2">
                <span className="text-muted-foreground pt-2 text-right text-sm font-medium tabular-nums">{i + 1}.</span>
                <Textarea rows={2} aria-label={`Passo ${i + 1}`} {...form.register(`steps.${i}.text`)} />
                <div className="flex">
                  <Button type="button" variant="ghost" size="icon" disabled={i === 0} onClick={() => steps.move(i, i - 1)} aria-label="Sposta su">
                    <ArrowUp />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={i === steps.fields.length - 1}
                    onClick={() => steps.move(i, i + 1)}
                    aria-label="Sposta giù"
                  >
                    <ArrowDown />
                  </Button>
                  <Button type="button" variant="ghost" size="icon" onClick={() => steps.remove(i)} aria-label="Rimuovi">
                    <Trash2 />
                  </Button>
                </div>
              </div>
            ))}
            <Button type="button" variant="outline" className="w-full" onClick={() => steps.append({ text: "" })}>
              <Plus /> Aggiungi passo
            </Button>
          </CardContent>
        </Card>
      </PageBody>
    </form>
  );
}
