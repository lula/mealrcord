import { useEffect, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { ArrowDown, ArrowLeft, ArrowUp, Plus, X } from "lucide-react";
import { PageBody, PageHeader } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { COURSES, type Course } from "@/db/schema";
import { useRecipes } from "@/features/recipes/api";
import { RecipePicker } from "./recipe-picker";
import { COURSE_LABELS, COURSE_TAG_ID, useMeal, useSaveMeal } from "./api";

const courses = z.object({
  starter: z.array(z.string()),
  first: z.array(z.string()),
  main: z.array(z.string()),
  dessert: z.array(z.string()),
});

const coefficient = z.number({ error: "Inserisci un numero" }).gt(0, "Deve essere maggiore di 0").max(10, "Massimo 10");
const courseCoefficient = coefficient.nullable();

const schema = z.object({
  name: z.string().trim().min(1, "Inserisci un nome"),
  notes: z.string(),
  coefficient,
  /** null = same as the meal. */
  courseCoefficients: z.object({ starter: courseCoefficient, first: courseCoefficient, main: courseCoefficient, dessert: courseCoefficient }),
  courses: courses.refine((c) => COURSES.some((k) => c[k].length > 0), "Aggiungi almeno una ricetta a una portata"),
});

type FormValues = z.infer<typeof schema>;

const EMPTY: FormValues = {
  name: "",
  notes: "",
  coefficient: 1,
  courseCoefficients: { starter: null, first: null, main: null, dessert: null },
  courses: { starter: [], first: [], main: [], dessert: [] },
};

export function MealEditorPage() {
  const { mealId } = useParams({ strict: false });
  const { data: meal, isLoading } = useMeal(mealId);
  const { data: recipes = [] } = useRecipes();
  const save = useSaveMeal();
  const navigate = useNavigate();
  const [picking, setPicking] = useState<Course | null>(null);

  const recipeNames = useMemo(() => new Map(recipes.map((r) => [r.id, r.name])), [recipes]);
  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: EMPTY });

  useEffect(() => {
    if (!meal) return form.reset(EMPTY);
    const byCourse = { ...EMPTY.courses };
    const coefs = { ...EMPTY.courseCoefficients };
    for (const c of COURSES) byCourse[c] = meal.recipes.filter((r) => r.course === c).map((r) => r.recipeId);
    for (const c of meal.courseCoefficients) coefs[c.course] = c.coefficient;
    form.reset({ name: meal.name, notes: meal.notes, coefficient: meal.coefficient, courseCoefficients: coefs, courses: byCourse });
  }, [meal, form]);

  const onSubmit = form.handleSubmit(async (values) => {
    await save.mutateAsync({ id: mealId, ...values });
    navigate({ to: "/meals" });
  });

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
        <PageHeader title="Pasto non trovato" />
        <PageBody>
          <Button asChild variant="outline">
            <Link to="/meals">
              <ArrowLeft /> Torna ai pasti
            </Link>
          </Button>
        </PageBody>
      </>
    );
  }

  const coursesError = form.formState.errors.courses;
  const mealCoefficient = form.watch("coefficient");

  return (
    <form onSubmit={onSubmit} className="flex flex-1 flex-col">
      <PageHeader
        title={meal ? meal.name : "Nuovo pasto"}
        actions={
          <>
            <Button variant="outline" asChild>
              <Link to="/meals">Annulla</Link>
            </Button>
            <Button type="submit" disabled={save.isPending}>
              Salva
            </Button>
          </>
        }
      />
      <PageBody className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <Card className="self-start">
          <CardHeader>
            <CardTitle>Dettagli</CardTitle>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <Field data-invalid={!!form.formState.errors.name}>
                <FieldLabel htmlFor="name">Nome</FieldLabel>
                <Input id="name" autoFocus={!mealId} {...form.register("name")} />
                <FieldError errors={[form.formState.errors.name]} />
              </Field>
              <Field data-invalid={!!form.formState.errors.coefficient} className="max-w-48">
                <FieldLabel htmlFor="coefficient">Coefficiente quantità</FieldLabel>
                <Input id="coefficient" type="number" step="0.05" min={0.05} {...form.register("coefficient", { valueAsNumber: true })} />
                <FieldDescription>Es. 0,7 per ridurre le porzioni quando il pasto ha molte portate. Puoi cambiarlo per le singole portate.</FieldDescription>
                <FieldError errors={[form.formState.errors.coefficient]} />
              </Field>
              <Field>
                <FieldLabel htmlFor="notes">Note</FieldLabel>
                <Textarea id="notes" rows={3} {...form.register("notes")} />
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
                      <CardAction>
                        <Button type="button" variant="outline" size="sm" onClick={() => setPicking(course)}>
                          <Plus /> Aggiungi
                        </Button>
                      </CardAction>
                    </CardHeader>
                    <CardContent>
                      <Controller
                        control={form.control}
                        name={`courseCoefficients.${course}`}
                        render={({ field: coef, fieldState }) => (
                          <Field orientation="horizontal" data-invalid={!!fieldState.error}>
                            <FieldLabel htmlFor={`coef-${course}`} className="text-muted-foreground font-normal">
                              Coefficiente
                            </FieldLabel>
                            <Input
                              id={`coef-${course}`}
                              type="number"
                              step="0.05"
                              min={0.05}
                              className="w-24"
                              placeholder={Number.isFinite(mealCoefficient) ? String(mealCoefficient) : ""}
                              value={coef.value ?? ""}
                              onChange={(e) => coef.onChange(e.target.value === "" ? null : e.target.valueAsNumber)}
                              onBlur={coef.onBlur}
                            />
                            <FieldDescription className="text-xs">{coef.value == null ? "come il pasto" : ""}</FieldDescription>
                            <FieldError errors={[fieldState.error]} />
                          </Field>
                        )}
                      />
                    </CardContent>
                    {ids.length > 0 && (
                      <CardContent className="space-y-1">
                        {ids.map((id, i) => (
                          <div key={id} className="bg-muted/50 flex items-center gap-1 rounded-md py-1 pr-1 pl-3 text-sm">
                            <span className="flex-1 truncate">{recipeNames.get(id) ?? "…"}</span>
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
        </div>
      </PageBody>
    </form>
  );
}
