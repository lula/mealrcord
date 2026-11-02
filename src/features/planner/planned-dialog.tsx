import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format, parseISO } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useMeals } from "@/features/meals/api";
import { SLOT_SUGGESTIONS, useSavePlanned, type PlannedEntry } from "./api";

const schema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Scegli una data"),
  slot: z.string().trim().min(1, "Indica il servizio"),
  mealId: z.string().min(1, "Scegli un pasto"),
  guests: z.number({ error: "Inserisci un numero" }).int("Numero intero").min(1, "Almeno 1 coperto"),
  notes: z.string(),
});

type FormValues = z.infer<typeof schema>;

/** Create (with `date`) or edit (with `entry`) a planned meal. */
export function PlannedDialog({
  open,
  onOpenChange,
  date,
  entry,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date?: string;
  entry?: PlannedEntry | null;
}) {
  const { data: meals = [] } = useMeals();
  const save = useSavePlanned();
  const [calendarOpen, setCalendarOpen] = useState(false);
  const form = useForm<FormValues>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (!open) return;
    form.reset(
      entry
        ? { date: entry.date, slot: entry.slot, mealId: entry.mealId, guests: entry.guests, notes: entry.notes }
        : { date: date ?? format(new Date(), "yyyy-MM-dd"), slot: "Pranzo", mealId: "", guests: 20, notes: "" },
    );
  }, [open, entry, date, form]);

  const onSubmit = form.handleSubmit(async (values) => {
    await save.mutateAsync({ id: entry?.id, ...values });
    onOpenChange(false);
  });

  const errors = form.formState.errors;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={onSubmit} className="space-y-6">
          <DialogHeader>
            <DialogTitle>{entry ? "Modifica pianificazione" : "Pianifica pasto"}</DialogTitle>
          </DialogHeader>
          <FieldGroup>
            <Field data-invalid={!!errors.date}>
              <FieldLabel>Data</FieldLabel>
              <Controller
                control={form.control}
                name="date"
                render={({ field }) => (
                  <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="justify-start font-normal capitalize">
                        <CalendarIcon />
                        {field.value ? format(parseISO(field.value), "EEEE d MMMM yyyy") : "Scegli una data"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value ? parseISO(field.value) : undefined}
                        defaultMonth={field.value ? parseISO(field.value) : undefined}
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
            <Field data-invalid={!!errors.slot}>
              <FieldLabel htmlFor="slot">Servizio</FieldLabel>
              <Controller
                control={form.control}
                name="slot"
                render={({ field }) => (
                  <div className="flex flex-wrap gap-2">
                    <ToggleGroup type="single" variant="outline" value={SLOT_SUGGESTIONS.includes(field.value) ? field.value : ""} onValueChange={(v) => v && field.onChange(v)}>
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
              <FieldLabel>Pasto</FieldLabel>
              <Controller
                control={form.control}
                name="mealId"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={meals.length ? "Scegli un pasto" : "Crea prima un pasto"} />
                    </SelectTrigger>
                    <SelectContent>
                      {meals.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              <FieldError errors={[errors.mealId]} />
            </Field>
            <Field data-invalid={!!errors.guests} className="max-w-40">
              <FieldLabel htmlFor="guests">Coperti</FieldLabel>
              <Input id="guests" type="number" min={1} step={1} {...form.register("guests", { valueAsNumber: true })} />
              <FieldError errors={[errors.guests]} />
            </Field>
            <Field>
              <FieldLabel htmlFor="notes">Note</FieldLabel>
              <Textarea id="notes" rows={2} {...form.register("notes")} />
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annulla
            </Button>
            <Button type="submit" disabled={save.isPending}>
              Salva
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
