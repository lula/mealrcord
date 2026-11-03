import { useEffect, useReducer, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { eachDayOfInterval, endOfWeek, format, parseISO, startOfToday, startOfTomorrow, startOfWeek } from "date-fns";
import { Link, useCanGoBack, useNavigate, useParams, useRouter, useSearch } from "@tanstack/react-router";
import { ArrowLeft, CalendarIcon, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PageBody, PageHeader } from "@/components/page";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { ProposedNumberInput } from "@/components/proposed-number-input";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RichTextEditor } from "@/components/rich-text-editor";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { COURSES } from "@/db/schema";
import { COURSE_LABELS, useMeals } from "@/features/meals/api";
import { useSettings } from "@/features/settings/api";
import {
  courseGuests,
  exceedsGuests,
  SLOT_SUGGESTIONS,
  useMealForScaling,
  usePlanned,
  usePlannedEntry,
  useSavePlanned,
  useSavePlannedOnDays,
  type ScalableEntry,
} from "./api";
import { PlannedQuantities } from "./planned-detail";

const coefficient = z.number({ error: "Inserisci un numero" }).gt(0, "Deve essere maggiore di 0").max(10, "Massimo 10");
const courseCoefficient = coefficient.nullable();
const guests = z.number({ error: "Inserisci un numero" }).int("Numero intero").min(1, "Almeno 1 coperto");

const schema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Scegli una data"),
  slot: z.string().trim().min(1, "Indica il servizio"),
  mealId: z.string().min(1, "Scegli un menu"),
  guests,
  /** null = 1. */
  courseCoefficients: z.object({ starter: courseCoefficient, first: courseCoefficient, main: courseCoefficient, side: courseCoefficient, dessert: courseCoefficient }),
  /** Guests by recipe id. Filled with an even split until the user edits them. */
  recipeGuests: z.record(z.string(), guests.nullish()),
  /** Coefficient of the "piatti unici"; null = 1. */
  dishCoefficient: courseCoefficient,
  /** Guests by dish id, like recipeGuests. */
  dishGuests: z.record(z.string(), guests.nullish()),
  notes: z.string(),
});

const NO_COURSE_COEFFICIENTS = { starter: null, first: null, main: null, side: null, dessert: null };

type FormValues = z.infer<typeof schema>;

/** Search params of /planner/new: day and menu to preselect. */
export type PlannedNewSearch = { date?: string; meal?: string };

/** Create (/planner/new) or edit (/planner/$plannedId) a planned meal. */
export function PlannedEditorPage() {
  const { plannedId } = useParams({ strict: false });
  const { date, meal: initialMealId } = useSearch({ strict: false }) as PlannedNewSearch;
  const { data: entry, isLoading } = usePlannedEntry(plannedId);
  const router = useRouter();
  const canGoBack = useCanGoBack();
  const navigate = useNavigate();
  // Ready once the entry to edit (if any) is loaded.
  const open = !plannedId || !!entry;
  // Back to where the user came from (planner view, menu filter...).
  const close = (savedDate?: string) => (canGoBack ? router.history.back() : navigate({ to: "/planner", search: { date: savedDate ?? date } }));
  const { data: meals = [] } = useMeals();
  const save = useSavePlanned();
  const saveOnDays = useSavePlannedOnDays();
  // New plans only: days of the chosen date's week to plan on (the chosen date is preselected).
  const [days, setDays] = useState<string[]>([]);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const form = useForm<FormValues>({ resolver: zodResolver(schema) });
  // Recipes whose guests the user set; the others follow the even split.
  // A ref, so the effects below see it right after the form is reset.
  const editedRef = useRef<Set<string>>(new Set());
  const [, rerender] = useReducer((n: number) => n + 1, 0);
  const edited = editedRef.current;
  const setEdited = (id: string, on: boolean) => {
    const set = editedRef.current;
    if (on === set.has(id)) return;
    if (on) set.add(id);
    else set.delete(id);
    rerender();
  };

  useEffect(() => {
    if (!open) return;
    // Recipe and dish ids are both uuids, so one set holds both.
    editedRef.current = new Set([...(entry?.recipeGuests.map((g) => g.recipeId) ?? []), ...(entry?.dishGuests.map((g) => g.dishId) ?? [])]);
    form.reset(
      entry
        ? {
            date: entry.date,
            slot: entry.slot,
            mealId: entry.mealId,
            guests: entry.guests,
            courseCoefficients: {
              ...NO_COURSE_COEFFICIENTS,
              ...Object.fromEntries(entry.courseCoefficients.map((c) => [c.course, c.coefficient])),
            },
            recipeGuests: Object.fromEntries(entry.recipeGuests.map((g) => [g.recipeId, g.guests])),
            dishCoefficient: entry.dishCoefficient,
            dishGuests: Object.fromEntries(entry.dishGuests.map((g) => [g.dishId, g.guests])),
            notes: entry.notes,
          }
        : {
            date: date ?? format(new Date(), "yyyy-MM-dd"),
            slot: "Pranzo",
            mealId: initialMealId ?? "",
            guests: 20,
            courseCoefficients: NO_COURSE_COEFFICIENTS,
            recipeGuests: {},
            dishCoefficient: null,
            dishGuests: {},
            notes: "",
          },
    );
  }, [open, entry, date, initialMealId, form]);

  const mealId = form.watch("mealId");
  // Menus already planned on the chosen day (a menu goes at most once per day).
  const formDate = form.watch("date") ?? "";
  const week = formDate
    ? eachDayOfInterval({ start: startOfWeek(parseISO(formDate)), end: endOfWeek(parseISO(formDate)) }).map((d) => format(d, "yyyy-MM-dd"))
    : [];
  const { data: weekPlanned = [] } = usePlanned(week[0] ?? "", week[6] ?? "");
  // Menus already planned on each day of the week (a menu goes at most once per day).
  const takenByDay = new Map<string, Set<string>>();
  for (const p of weekPlanned) if (p.id !== entry?.id) takenByDay.set(p.date, (takenByDay.get(p.date) ?? new Set()).add(p.mealId));
  const isTaken = (day: string, meal: string) => !!meal && !!takenByDay.get(day)?.has(meal);
  const targetDays = entry ? [formDate] : days;
  // A menu can't be chosen when it is taken on every day it would go to.
  const takenMealIds = new Set(meals.filter((m) => targetDays.length > 0 && targetDays.every((d) => isTaken(d, m.id))).map((m) => m.id));

  // New plans go from today on.
  const today = format(new Date(), "yyyy-MM-dd");
  // Choosing a date (re)starts the selection from that day.
  useEffect(() => {
    if (formDate) setDays(formDate >= today ? [formDate] : []);
  }, [formDate]);
  // Days where the chosen menu is already planned can't stay selected.
  const takenKey = days.filter((d) => isTaken(d, mealId)).join();
  useEffect(() => {
    if (takenKey) setDays((ds) => ds.filter((d) => !takenKey.split(",").includes(d)));
  }, [takenKey]);
  const plannedGuests = form.watch("guests");
  const mealRecipes = meals.find((m) => m.id === mealId)?.recipes ?? [];
  const mealDishes = meals.find((m) => m.id === mealId)?.dishes ?? [];
  const dishGuestValues = form.watch("dishGuests") ?? {};
  const mealCourses = COURSES.filter((c) => mealRecipes.some((r) => r.course === c));
  const recipeGuestValues = form.watch("recipeGuests") ?? {};
  const { data: settings } = useSettings();
  const warnPercent = settings?.guestsWarningPercent ?? 20;
  const total = Number.isFinite(plannedGuests) ? plannedGuests : 0;

  // Fill the recipes the user has not edited with an even share of what is left.
  const editedValues = [
    ...mealRecipes.map((r) => (edited.has(r.recipeId) ? recipeGuestValues[r.recipeId] : null)),
    ...mealDishes.map((d) => (edited.has(d.dishId) ? dishGuestValues[d.dishId] : null)),
  ];
  const splitKey = JSON.stringify([total, mealId, mealRecipes.map((r) => r.recipeId), mealDishes.map((d) => d.dishId), editedValues]);
  useEffect(() => {
    if (!open) return;
    const edited = editedRef.current;
    // Each course is a group of recipes; the "piatti unici" are one more group of dishes.
    const groups = [
      ...COURSES.map((c) => ({ field: "recipeGuests" as const, ids: mealRecipes.filter((r) => r.course === c).map((r) => r.recipeId) })),
      { field: "dishGuests" as const, ids: mealDishes.map((d) => d.dishId) },
    ];
    for (const { field, ids } of groups) {
      if (!ids.length) continue;
      const values = form.getValues(field) ?? {};
      const overrides = Object.fromEntries(ids.filter((id) => edited.has(id)).map((id) => [id, Number.isFinite(values[id]) ? values[id] : 0]));
      const split = courseGuests(total, ids, overrides);
      for (const id of ids) {
        if (!edited.has(id) && values[id] !== split[id]) form.setValue(`${field}.${id}`, split[id] || null);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, splitKey]);

  const courseTotal = (course: (typeof COURSES)[number]) =>
    mealRecipes.filter((r) => r.course === course).reduce((n, r) => n + (Number(recipeGuestValues[r.recipeId]) || 0), 0);

  const dishTotal = mealDishes.reduce((n, d) => n + (Number(dishGuestValues[d.dishId]) || 0), 0);

  const onSubmit = form.handleSubmit(async (formValues) => {
    // Keep overrides only for courses, recipes and dishes the chosen menu has.
    const courseCoefficients = Object.fromEntries(mealCourses.map((c) => [c, formValues.courseCoefficients[c]]));
    const recipeGuests = Object.fromEntries(mealRecipes.map((r) => [r.recipeId, formValues.recipeGuests[r.recipeId] || null]));
    const dishGuests = Object.fromEntries(mealDishes.map((d) => [d.dishId, formValues.dishGuests[d.dishId] || null]));
    const values = { ...formValues, courseCoefficients, recipeGuests, dishGuests, dishCoefficient: mealDishes.length ? formValues.dishCoefficient : null };
    if (entry) {
      await save.mutateAsync({ id: entry.id, ...values });
      close(values.date);
      return;
    }
    const dates = [...days].sort();
    if (dates.length === 0) {
      form.setError("date", { message: "Scegli almeno un giorno" });
      return;
    }
    await saveOnDays.mutateAsync({ ...values, dates });
    close(dates[0]);
  });

  const errors = form.formState.errors;

  // Live preview of the quantities, from the values in the form.
  const { data: scalingMeal } = useMealForScaling(mealId || undefined);
  const courseCoefficientValues = form.watch("courseCoefficients");
  const dishCoefficientValue = form.watch("dishCoefficient");
  const preview: ScalableEntry | null =
    scalingMeal && scalingMeal.id === mealId
      ? {
          guests: total,
          courseCoefficients: COURSES.flatMap((course) => {
            const coefficient = courseCoefficientValues?.[course];
            return coefficient != null && Number.isFinite(coefficient) ? [{ course, coefficient }] : [];
          }),
          recipeGuests: mealRecipes.flatMap((r) => {
            const guests = recipeGuestValues[r.recipeId];
            return guests != null && Number.isFinite(guests) ? [{ recipeId: r.recipeId, guests }] : [];
          }),
          dishCoefficient: dishCoefficientValue != null && Number.isFinite(dishCoefficientValue) ? dishCoefficientValue : null,
          dishGuests: mealDishes.flatMap((d) => {
            const guests = dishGuestValues[d.dishId];
            return guests != null && Number.isFinite(guests) ? [{ dishId: d.dishId, guests }] : [];
          }),
          meal: scalingMeal,
        }
      : null;

  if (plannedId && isLoading) {
    return (
      <PageBody>
        <Skeleton className="h-96 w-full" />
      </PageBody>
    );
  }
  if (plannedId && !entry) {
    return (
      <>
        <PageHeader title="Pianificazione non trovata" />
        <PageBody>
          <Button asChild variant="outline">
            <Link to="/planner">
              <ArrowLeft /> Torna al planner
            </Link>
          </Button>
        </PageBody>
      </>
    );
  }

  return (
    <form onSubmit={(e) => e.preventDefault()} className="flex flex-1 flex-col">
      <PageHeader
        title={entry ? "Modifica pianificazione" : "Pianifica menu"}
        actions={
          <>
            <Button type="button" variant="outline" onClick={() => close()}>
              Annulla
            </Button>
            <Button type="button" disabled={save.isPending} onClick={onSubmit}>
              Salva
            </Button>
          </>
        }
      />
      <PageBody className="grid items-start gap-6 lg:grid-cols-2">
        {/* Left: what you fill in. Right: the resulting quantities, always in view. */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Dettagli</CardTitle>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <Field data-invalid={!!errors.date}>
                  <FieldLabel>Data</FieldLabel>
                  <Controller
                    control={form.control}
                    name="date"
                    render={({ field }) => (
                      <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="w-full justify-start font-normal capitalize">
                            <CalendarIcon />
                            {field.value ? format(parseISO(field.value), "EEEE d MMMM yyyy") : "Scegli una data"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value ? parseISO(field.value) : undefined}
                            defaultMonth={field.value ? parseISO(field.value) : undefined}
                            disabled={entry ? undefined : { before: startOfTomorrow() }}
                            onSelect={(d) => {
                              if (d) field.onChange(format(d, "yyyy-MM-dd"));
                              setCalendarOpen(false);
                            }}
                          />
                        </PopoverContent>
                      </Popover>
                    )}
                  />
                  <FieldError errors={[errors.date]} />
                </Field>
                {!entry && week.length > 0 && (
                  <Field>
                    <FieldLabel>Giorni della settimana</FieldLabel>
                    <ToggleGroup type="multiple" variant="outline" className="grid w-full grid-cols-7" value={days} onValueChange={setDays}>
                      {week.map((d) => {
                        const taken = isTaken(d, mealId);
                        const past = d <= today;
                        return (
                          <ToggleGroupItem
                            key={d}
                            value={d}
                            disabled={taken || past}
                            title={past ? "Giorno passato" : taken ? "Menu già pianificato in questo giorno" : undefined}
                            className="h-auto flex-col gap-0 py-1.5 capitalize"
                          >
                            <span className="text-muted-foreground text-[10px]">{format(parseISO(d), "EEE")}</span>
                            <span className="font-semibold tabular-nums">{format(parseISO(d), "d")}</span>
                          </ToggleGroupItem>
                        );
                      })}
                    </ToggleGroup>
                    <FieldDescription>
                      {days.length === 0
                        ? "Scegli almeno un giorno."
                        : days.length === 1
                          ? "Verrà pianificato in 1 giorno."
                          : `Verrà pianificato in ${days.length} giorni, con gli stessi valori.`}
                    </FieldDescription>
                  </Field>
                )}
                <Field data-invalid={!!errors.slot}>
                  <FieldLabel htmlFor="slot">Servizio</FieldLabel>
                  <Controller
                    control={form.control}
                    name="slot"
                    render={({ field }) => (
                      <div className="flex flex-wrap gap-2">
                        <ToggleGroup
                          type="single"
                          variant="outline"
                          value={SLOT_SUGGESTIONS.includes(field.value) ? field.value : ""}
                          onValueChange={(v) => v && field.onChange(v)}
                        >
                          {SLOT_SUGGESTIONS.map((s) => (
                            <ToggleGroupItem key={s} value={s}>
                              {s}
                            </ToggleGroupItem>
                          ))}
                        </ToggleGroup>
                        <Input id="slot" className="w-36" placeholder="Altro…" value={field.value ?? ""} onChange={field.onChange} />
                      </div>
                    )}
                  />
                  <FieldError errors={[errors.slot]} />
                </Field>
                <Field data-invalid={!!errors.mealId}>
                  <FieldLabel>Menu</FieldLabel>
                  <Controller
                    control={form.control}
                    name="mealId"
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder={meals.length ? "Scegli un menu" : "Crea prima un menu"} />
                        </SelectTrigger>
                        <SelectContent>
                          {meals.map((m) => (
                            <SelectItem key={m.id} value={m.id} disabled={takenMealIds.has(m.id)}>
                              {m.name}
                              {takenMealIds.has(m.id) && (
                                <span className="text-muted-foreground text-xs">
                                  già pianificato {targetDays.length > 1 ? "in questi giorni" : "in questo giorno"}
                                </span>
                              )}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  <FieldError errors={[errors.mealId]} />
                </Field>
                <Field data-invalid={!!errors.guests} className="max-w-48">
                  <FieldLabel htmlFor="guests">Coperti</FieldLabel>
                  <Input id="guests" type="number" min={1} step={1} {...form.register("guests", { valueAsNumber: true })} />
                  <FieldError errors={[errors.guests]} />
                </Field>
                <Field>
                  <FieldLabel htmlFor="notes">Note</FieldLabel>
                  <Controller
                    control={form.control}
                    name="notes"
                    render={({ field }) => <RichTextEditor id="notes" value={field.value ?? ""} onChange={field.onChange} onBlur={field.onBlur} minRows={2} />}
                  />
                </Field>
              </FieldGroup>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Portate</CardTitle>
              <CardDescription>
                Coperti divisi tra le ricette di ogni portata. Modificali dove serve: le altre ricette si dividono quelli rimasti.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {mealCourses.length === 0 && mealDishes.length === 0 ? (
                <p className="text-muted-foreground text-sm">Scegli un menu per vedere le portate.</p>
              ) : (
                <div className="space-y-5">
                  {mealCourses.map((course) => {
                    const sum = courseTotal(course);
                    return (
                      <section key={course} className="space-y-2">
                        <Controller
                          control={form.control}
                          name={`courseCoefficients.${course}`}
                          render={({ field, fieldState }) => (
                            <Field orientation="horizontal" data-invalid={!!fieldState.error}>
                              <FieldLabel htmlFor={`coef-${course}`} className="text-muted-foreground flex-1 text-xs font-semibold tracking-wide uppercase">
                                {COURSE_LABELS[course]}
                              </FieldLabel>
                              <span className="text-muted-foreground text-xs">Coefficiente</span>
                              <ProposedNumberInput
                                id={`coef-${course}`}
                                step="0.05"
                                min={0.05}
                                className="h-8 w-20"
                                proposed={1}
                                value={field.value}
                                onChange={field.onChange}
                                onBlur={field.onBlur}
                              />
                            </Field>
                          )}
                        />
                        <div className="divide-y rounded-lg border">
                          {mealRecipes
                            .filter((r) => r.course === course)
                            .map((r) => (
                              <Controller
                                key={r.recipeId}
                                control={form.control}
                                name={`recipeGuests.${r.recipeId}`}
                                render={({ field, fieldState }) => (
                                  <Field orientation="horizontal" data-invalid={!!fieldState.error} className="px-3 py-1.5">
                                    <FieldLabel htmlFor={`guests-${r.recipeId}`} className="flex-1 truncate">
                                      {r.recipe.name}
                                    </FieldLabel>
                                    <span className="text-muted-foreground text-xs">Coperti</span>
                                    <Input
                                      id={`guests-${r.recipeId}`}
                                      type="number"
                                      min={1}
                                      step={1}
                                      className="h-8 w-20"
                                      value={field.value ?? ""}
                                      onFocus={(e) => e.target.select()}
                                      onChange={(e) => {
                                        setEdited(r.recipeId, true);
                                        field.onChange(e.target.value === "" ? null : e.target.valueAsNumber);
                                      }}
                                      onBlur={() => {
                                        // An emptied field goes back to the even split.
                                        if (field.value == null) setEdited(r.recipeId, false);
                                        field.onBlur();
                                      }}
                                    />
                                  </Field>
                                )}
                              />
                            ))}
                        </div>
                        {exceedsGuests(sum, total, warnPercent) && (
                          <p className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-500">
                            <TriangleAlert className="size-3.5 shrink-0" />
                            {sum} coperti su {total}: oltre il {warnPercent}% in più.
                          </p>
                        )}
                      </section>
                    );
                  })}
                  {mealDishes.length > 0 && (
                    <section className="space-y-2">
                      <Controller
                        control={form.control}
                        name="dishCoefficient"
                        render={({ field, fieldState }) => (
                          <Field orientation="horizontal" data-invalid={!!fieldState.error}>
                            <FieldLabel htmlFor="coef-dishes" className="text-muted-foreground flex-1 text-xs font-semibold tracking-wide uppercase">
                              Piatti unici
                            </FieldLabel>
                            <span className="text-muted-foreground text-xs">Coefficiente</span>
                            <ProposedNumberInput
                              id="coef-dishes"
                              step="0.05"
                              min={0.05}
                              className="h-8 w-20"
                              proposed={1}
                              value={field.value}
                              onChange={field.onChange}
                              onBlur={field.onBlur}
                            />
                          </Field>
                        )}
                      />
                      <div className="divide-y rounded-lg border">
                        {mealDishes.map((d) => (
                          <Controller
                            key={d.dishId}
                            control={form.control}
                            name={`dishGuests.${d.dishId}`}
                            render={({ field, fieldState }) => (
                              <Field orientation="horizontal" data-invalid={!!fieldState.error} className="px-3 py-1.5">
                                <FieldLabel htmlFor={`guests-${d.dishId}`} className="flex-1 truncate">
                                  {d.dish.name}
                                </FieldLabel>
                                <span className="text-muted-foreground text-xs">Coperti</span>
                                <Input
                                  id={`guests-${d.dishId}`}
                                  type="number"
                                  min={1}
                                  step={1}
                                  className="h-8 w-20"
                                  value={field.value ?? ""}
                                  onFocus={(e) => e.target.select()}
                                  onChange={(e) => {
                                    setEdited(d.dishId, true);
                                    field.onChange(e.target.value === "" ? null : e.target.valueAsNumber);
                                  }}
                                  onBlur={() => {
                                    if (field.value == null) setEdited(d.dishId, false);
                                    field.onBlur();
                                  }}
                                />
                              </Field>
                            )}
                          />
                        ))}
                      </div>
                      {exceedsGuests(dishTotal, total, warnPercent) && (
                        <p className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-500">
                          <TriangleAlert className="size-3.5 shrink-0" />
                          {dishTotal} coperti su {total}: oltre il {warnPercent}% in più.
                        </p>
                      )}
                    </section>
                  )}
                  <FieldError
                    errors={[
                      ...mealCourses.map((c) => errors.courseCoefficients?.[c]),
                      ...mealRecipes.map((r) => errors.recipeGuests?.[r.recipeId]),
                      errors.dishCoefficient,
                      ...mealDishes.map((d) => errors.dishGuests?.[d.dishId]),
                    ]}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="lg:sticky lg:top-4">
          <CardHeader>
            <CardTitle>Anteprima quantità</CardTitle>
            <CardDescription>Aggiornate mentre compili.</CardDescription>
          </CardHeader>
          <CardContent>
            {preview ? <PlannedQuantities entry={preview} /> : <p className="text-muted-foreground text-sm">Scegli un menu per vedere le quantità.</p>}
          </CardContent>
        </Card>
      </PageBody>
    </form>
  );
}
