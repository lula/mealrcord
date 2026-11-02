import { useEffect, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { ArrowDown, ArrowLeft, ArrowUp, Copy, Lock, Plus, RotateCcw, Save, X } from "lucide-react";
import { PageBody, PageHeader } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { RichTextEditor } from "@/components/rich-text-editor";
import { COURSES, type Course } from "@/db/schema";
import { useRecipes } from "@/features/recipes/api";
import { RecipeDetailDialog } from "@/features/recipes/recipe-detail-dialog";
import { useDishes } from "@/features/dishes/api";
import { DishPicker } from "@/features/dishes/dish-picker";
import { RecipePicker } from "./recipe-picker";
import { COURSE_LABELS, COURSE_TAG_ID, useDuplicateMeal, useMeal, useSaveMeal } from "./api";

const courses = z.object({
  starter: z.array(z.string()),
  first: z.array(z.string()),
  main: z.array(z.string()),
  dessert: z.array(z.string()),
});

const schema = z
  .object({
    name: z.string().trim().min(1, "Inserisci un nome"),
    notes: z.string(),
    courses,
    /** "Piatti unici", in order. */
    dishIds: z.array(z.string()),
  })
  .refine((v) => v.dishIds.length > 0 || COURSES.some((k) => v.courses[k].length > 0), {
    message: "Aggiungi almeno una ricetta a una portata o un piatto unico",
    path: ["courses"],
  });

type FormValues = z.infer<typeof schema>;

const EMPTY: FormValues = { name: "", notes: "", courses: { starter: [], first: [], main: [], dessert: [] }, dishIds: [] };

export function MealEditorPage() {
  const { mealId } = useParams({ strict: false });
  const { data: meal, isLoading } = useMeal(mealId);
  const { data: recipes = [] } = useRecipes();
  const save = useSaveMeal();
  const duplicate = useDuplicateMeal();
  const navigate = useNavigate();
  const [picking, setPicking] = useState<Course | null>(null);
  const [viewing, setViewing] = useState<string | null>(null);
  const [pickingDishes, setPickingDishes] = useState(false);
  const { data: allDishes = [] } = useDishes();
  const dishById = useMemo(() => new Map(allDishes.map((d) => [d.id, d])), [allDishes]);

  const recipeNames = useMemo(() => new Map(recipes.map((r) => [r.id, r.name])), [recipes]);
  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: EMPTY });

  useEffect(() => {
    if (!meal) return form.reset(EMPTY);
    const byCourse = { ...EMPTY.courses };
    for (const c of COURSES) byCourse[c] = meal.recipes.filter((r) => r.course === c).map((r) => r.recipeId);
    form.reset({ name: meal.name, notes: meal.notes, courses: byCourse, dishIds: meal.dishes.map((d) => d.dishId) });
  }, [meal, form]);

  const onSubmit = form.handleSubmit(async (values) => {
    await save.mutateAsync({ id: mealId, ...values });
    navigate({ to: "/meals" });
  });

  async function onDuplicate() {
    const id = await duplicate.mutateAsync(mealId!);
    navigate({ to: "/meals/$mealId", params: { mealId: id } });
  }

  if (mealId && isLoading) {
    return (
      <PageBody>
        <Skeleton className="h-96 w-full" />
      </PageBody>
    );
  }
  if (mealId && !meal) {
    return (
      <>
        <PageHeader title="Menu non trovato" />
        <PageBody>
          <Button type="button" asChild variant="outline">
            <Link to="/meals">
              <ArrowLeft /> Torna ai menu
            </Link>
          </Button>
        </PageBody>
      </>
    );
  }

  const coursesError = form.formState.errors.courses;
  const locked = !!meal && meal.planned.length > 0;

  return (
    <form onSubmit={(e) => e.preventDefault()} className="flex flex-1 flex-col">
      <PageHeader
        title={meal ? meal.name : "Nuovo menu"}
        actions={
          <>
            {locked ? (
              <>
                <Button type="button" variant="outline" disabled={duplicate.isPending} onClick={onDuplicate}>
                  <Copy /> Duplica
                </Button>
                <Button type="button" asChild>
                  <Link to="/meals">Chiudi</Link>
                </Button>
              </>
            ) : (
              <>
                <Button type="button" variant="outline" asChild>
                  <Link to="/meals">
                    <RotateCcw />
                    Annulla
                  </Link>
                </Button>
                <Button type="button" disabled={save.isPending} onClick={onSubmit}>
                  <Save />
                  Salva
                </Button>
              </>
            )}
          </>
        }
      />
      <PageBody className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        {locked && (
          <div role="status" className="bg-muted/50 flex gap-3 rounded-lg border p-4 text-sm lg:col-span-2">
            <Lock className="text-muted-foreground mt-0.5 size-4 shrink-0" />
            <div>
              <p className="font-medium">Menu in sola lettura</p>
              <p className="text-muted-foreground">
                È nel planner ({meal.planned.length} {meal.planned.length === 1 ? "volta" : "volte"}), quindi non si può più modificare. Duplicalo per crearne
                una variante.
              </p>
            </div>
          </div>
        )}
        <Card className="self-start">
          <CardHeader>
            <CardTitle>Dettagli</CardTitle>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <Field data-invalid={!!form.formState.errors.name}>
                <FieldLabel htmlFor="name">Nome</FieldLabel>
                <Input id="name" autoFocus={!mealId} readOnly={locked} {...form.register("name")} />
                <FieldError errors={[form.formState.errors.name]} />
              </Field>
              <Field>
                <FieldLabel htmlFor="notes">Note</FieldLabel>
                <Controller
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <RichTextEditor id="notes" value={field.value} onChange={field.onChange} onBlur={field.onBlur} readOnly={locked} minRows={3} />
                  )}
                />
              </Field>
            </FieldGroup>
          </CardContent>
        </Card>

        <div className="space-y-4">
          {coursesError && (
            <p className="text-destructive text-sm" role="alert">
              {coursesError.message ?? coursesError.root?.message}
            </p>
          )}
          {COURSES.map((course) => (
            <Controller
              key={course}
              control={form.control}
              name={`courses.${course}`}
              render={({ field }) => {
                const ids: string[] = field.value;
                const move = (from: number, to: number) => {
                  const next = [...ids];
                  next.splice(to, 0, next.splice(from, 1)[0]);
                  field.onChange(next);
                };
                return (
                  <Card size="sm">
                    <CardHeader>
                      <CardTitle>{COURSE_LABELS[course]}</CardTitle>
                      <CardDescription>{ids.length ? `${ids.length} ricette` : "Facoltativo"}</CardDescription>
                      {!locked && (
                        <CardAction>
                          <Button type="button" variant="outline" size="sm" onClick={() => setPicking(course)}>
                            <Plus /> Aggiungi
                          </Button>
                        </CardAction>
                      )}
                    </CardHeader>
                    {ids.length > 0 && (
                      <CardContent className="space-y-1">
                        {ids.map((id, i) => (
                          <div key={id} className="bg-muted/50 flex items-center gap-1 rounded-md py-1 pr-1 pl-3 text-sm">
                            <button
                              type="button"
                              className="hover:text-primary flex-1 cursor-pointer truncate text-left hover:underline"
                              onClick={() => setViewing(id)}
                            >
                              {recipeNames.get(id) ?? "…"}
                            </button>
                            {!locked && (
                              <>
                                <Button type="button" variant="ghost" size="icon-sm" disabled={i === 0} onClick={() => move(i, i - 1)} aria-label="Sposta su">
                                  <ArrowUp />
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon-sm"
                                  disabled={i === ids.length - 1}
                                  onClick={() => move(i, i + 1)}
                                  aria-label="Sposta giù"
                                >
                                  <ArrowDown />
                                </Button>
                                <Button type="button" variant="ghost" size="icon-sm" onClick={() => field.onChange(ids.filter((x) => x !== id))} aria-label="Rimuovi">
                                  <X />
                                </Button>
                              </>
                            )}
                          </div>
                        ))}
                      </CardContent>
                    )}
                    <RecipePicker
                      open={picking === course}
                      onOpenChange={(o) => !o && setPicking(null)}
                      title={`Ricette: ${COURSE_LABELS[course]}`}
                      initialTagIds={[COURSE_TAG_ID[course]]}
                      selected={ids}
                      unavailable={Object.fromEntries(
                        COURSES.filter((c) => c !== course).flatMap((c) =>
                          form.getValues(`courses.${c}`).map((id) => [id, `Già in ${COURSE_LABELS[c].toLowerCase()}`]),
                        ),
                      )}
                      onConfirm={(next) => {
                        field.onChange(next);
                        form.clearErrors("courses");
                      }}
                    />
                  </Card>
                );
              }}
            />
          ))}
          <Controller
            control={form.control}
            name="dishIds"
            render={({ field }) => {
              const ids: string[] = field.value;
              const move = (from: number, to: number) => {
                const next = [...ids];
                next.splice(to, 0, next.splice(from, 1)[0]);
                field.onChange(next);
              };
              return (
                <Card size="sm">
                  <CardHeader>
                    <CardTitle>Piatti unici</CardTitle>
                    <CardDescription>{ids.length ? `${ids.length} piatti unici` : "Facoltativo"}</CardDescription>
                    {!locked && (
                      <CardAction>
                        <Button type="button" variant="outline" size="sm" onClick={() => setPickingDishes(true)}>
                          <Plus /> Aggiungi
                        </Button>
                      </CardAction>
                    )}
                  </CardHeader>
                  {ids.length > 0 && (
                    <CardContent className="space-y-1">
                      {ids.map((id, i) => {
                        const dish = dishById.get(id);
                        return (
                          <div key={id} className="bg-muted/50 flex items-center gap-1 rounded-md py-1 pr-1 pl-3 text-sm">
                            <div className="min-w-0 flex-1">
                              <Link to="/dishes/$dishId" params={{ dishId: id }} className="hover:text-primary block truncate hover:underline">
                                {dish?.name ?? "…"}
                              </Link>
                              {dish && <div className="text-muted-foreground truncate text-xs">{dish.recipes.map((r) => r.recipe.name).join(" · ")}</div>}
                            </div>
                            {!locked && (
                              <>
                                <Button type="button" variant="ghost" size="icon-sm" disabled={i === 0} onClick={() => move(i, i - 1)} aria-label="Sposta su">
                                  <ArrowUp />
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon-sm"
                                  disabled={i === ids.length - 1}
                                  onClick={() => move(i, i + 1)}
                                  aria-label="Sposta giù"
                                >
                                  <ArrowDown />
                                </Button>
                                <Button type="button" variant="ghost" size="icon-sm" onClick={() => field.onChange(ids.filter((x) => x !== id))} aria-label="Rimuovi">
                                  <X />
                                </Button>
                              </>
                            )}
                          </div>
                        );
                      })}
                    </CardContent>
                  )}
                  <DishPicker
                    open={pickingDishes}
                    onOpenChange={setPickingDishes}
                    selected={ids}
                    onConfirm={(next) => {
                      field.onChange(next);
                      form.clearErrors("courses");
                    }}
                  />
                </Card>
              );
            }}
          />
        </div>
      </PageBody>
      <RecipeDetailDialog recipeId={viewing} onClose={() => setViewing(null)} />
    </form>
  );
}
