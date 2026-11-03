import { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import {
  addDays,
  addMonths,
  addWeeks,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  parseISO,
  startOfMonth,
  startOfToday,
  startOfTomorrow,
  startOfWeek
} from "date-fns";
import {
  CalendarDays,
  CalendarPlus,
  CopyPlus,
  Eye,
  UtensilsCrossed,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Plus,
  ShoppingCart,
  Trash2,
  TriangleAlert,
  Users,
  X,
  ArrowLeft,
} from "lucide-react";
import { PageBody, PageHeader } from "@/components/page";
import { ConfirmDialog } from "@/components/confirm-dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuLabel, ContextMenuSeparator, ContextMenuTrigger } from "@/components/ui/context-menu";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemTitle } from "@/components/ui/item";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { RichText } from "@/components/rich-text";
import { toPlainText } from "@/lib/rich-text";
import { cn } from "@/lib/utils";
import { useMeals } from "@/features/meals/api";
import { MealFilter } from "@/features/meals/meal-filter";
import { useSettings } from "@/features/settings/api";
import { plannedExceedsGuests, useCopyPlanned, useDeletePlanned, useMovePlanned, usePlanned, usePlannedForMeal, type PlannedEntry } from "./api";
import { PlannedDetail, PlannedQuantities } from "./planned-detail";

export type PlannerView = "month" | "week" | "day";
/** `meal` filters the planner to one menu and lists the days it is planned. */
export type PlannerSearch = { view?: PlannerView; date?: string; meal?: string };

const ISO = "yyyy-MM-dd";
const iso = (d: Date) => format(d, ISO);

function rangeFor(view: PlannerView, anchor: Date) {
  if (view === "day") return { start: anchor, end: anchor };
  if (view === "week") return { start: startOfWeek(anchor), end: endOfWeek(anchor) };
  // Month grid: full weeks around the month.
  return { start: startOfWeek(startOfMonth(anchor)), end: endOfWeek(endOfMonth(anchor)) };
}

function titleFor(view: PlannerView, anchor: Date) {
  if (view === "day") return format(anchor, "EEEE d MMMM yyyy");
  if (view === "month") return format(anchor, "MMMM yyyy");
  const { start, end } = rangeFor("week", anchor);
  return isSameMonth(start, end) ? `${format(start, "d")}–${format(end, "d MMMM yyyy")}` : `${format(start, "d MMM")} – ${format(end, "d MMM yyyy")}`;
}

const STEP = { day: addDays, week: addWeeks, month: addMonths } as const;

export function PlannerPage() {
  const { view = "week", date, meal: mealFilter } = useSearch({ from: "/planner" });
  const navigate = useNavigate({ from: "/planner" });
  const anchor = date ? parseISO(date) : new Date();
  const { start, end } = rangeFor(view, anchor);
  const { data: inRange = [] } = usePlanned(iso(start), iso(end));
  const { data: forMeal = [] } = usePlannedForMeal(mealFilter);
  const { data: meals = [] } = useMeals();
  const filteredMeal = meals.find((m) => m.id === mealFilter);
  const entries = mealFilter ? forMeal : inRange;

  const nav = useNavigate();
  const addOn = (d: string) => nav({ to: "/planner/new", search: { date: d, meal: mealFilter } });
  const edit = (e: PlannedEntry) => nav({ to: "/planner/$plannedId", params: { plannedId: e.id } });
  const copy = useCopyPlanned();
  const del = useDeletePlanned();
  const [toRemove, setToRemove] = useState<PlannedEntry | null>(null);
  const entryMenu: EntryMenuActions = {
    open: (e) => setSelectedId(e.id),
    edit,
    copyToNextDay: (e) => copy.mutate({ id: e.id, date: iso(addDays(parseISO(e.date), 1)) }),
    showMealDates: (e) => go({ meal: e.mealId }),
    remove: setToRemove,
  };
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = entries.find((e) => e.id === selectedId) ?? null;

  const byDate = useMemo(() => {
    const map = new Map<string, PlannedEntry[]>();
    for (const e of entries) map.set(e.date, [...(map.get(e.date) ?? []), e]);
    return map;
  }, [entries]);

  const go = (search: Partial<PlannerSearch>) => navigate({ search: (s) => ({ ...s, ...search }) });
  const shift = (n: number) => go({ date: iso(STEP[view](anchor, n)) });
  const days = eachDayOfInterval({ start, end });

  return (
    <>
      <PageHeader
        title={mealFilter ? (filteredMeal?.name ?? "Menu") : <span className="capitalize">Planner</span>}
        description={titleFor(view, anchor)}
        actions={
          <>
            {!mealFilter && (
              <Button variant="outline" asChild>
                <Link to="/shopping" search={{ from: iso(start), to: iso(end) }}>
                  <ShoppingCart /> Spesa
                </Link>
              </Button>
            )}
            <Button onClick={() => addOn(iso(view === "day" && !mealFilter ? anchor : new Date()))}>
              <CalendarPlus /> Pianifica
            </Button>
          </>
        }
      />
      <div className="flex flex-wrap items-center gap-2 border-b px-2 py-2">
        {!mealFilter && (
          <>
            <Button variant="outline" size="sm" onClick={() => go({ date: undefined })}>
              Oggi
            </Button>
            <Button variant="ghost" size="icon-sm" onClick={() => shift(-1)} aria-label="Precedente">
              <ChevronLeft />
            </Button>
            <Button variant="ghost" size="icon-sm" onClick={() => shift(1)} aria-label="Successivo">
              <ChevronRight />
            </Button>
          </>
        )}
        <MealFilter value={mealFilter} onChange={(meal) => go({ meal })} />
        {mealFilter ? (
          <Button variant="outline" size="sm" className="ml-auto" onClick={() => go({ meal: undefined })}>
            <ArrowLeft /> Torna al calendario
          </Button>
        ) : (
          <ToggleGroup type="single" variant="outline" size="sm" className="ml-auto" value={view} onValueChange={(v) => v && go({ view: v as PlannerView })}>
            <ToggleGroupItem value="month">Mese</ToggleGroupItem>
            <ToggleGroupItem value="week">Settimana</ToggleGroupItem>
            <ToggleGroupItem value="day">Giorno</ToggleGroupItem>
          </ToggleGroup>
        )}
      </div>

      <EntryMenuContext.Provider value={entryMenu}>
        <PageBody className={view === "week" && !mealFilter ? "flex flex-col" : ""}>
          {mealFilter && <MealOccurrences entries={forMeal} onSelect={setSelectedId} onAdd={() => addOn(iso(new Date()))} />}
          {!mealFilter && (view === "month" || view === "week") && (
            <PlannerDnd>
              {view === "month" ? (
                <MonthView anchor={anchor} days={days} byDate={byDate} onOpenDay={(d) => go({ view: "day", date: d })} onAdd={addOn} onSelect={setSelectedId} />
              ) : (
                <WeekView days={days} byDate={byDate} onOpenDay={(d) => go({ view: "day", date: d })} onAdd={addOn} onSelect={setSelectedId} />
              )}
            </PlannerDnd>
          )}
          {!mealFilter && view === "day" && <DayView entries={byDate.get(iso(anchor)) ?? []} onAdd={() => addOn(iso(anchor))} onEdit={edit} />}
        </PageBody>
      </EntryMenuContext.Provider>

      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelectedId(null)}>
        <SheetContent className="w-full gap-0 sm:max-w-lg">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  {selected.slot} · {selected.meal.name}
                  <GuestsWarning entry={selected} className="size-4" />
                </SheetTitle>
                <SheetDescription className="capitalize">
                  {format(parseISO(selected.date), "EEEE d MMMM")} · {selected.guests} coperti
                </SheetDescription>
              </SheetHeader>
              {/* Only the body scrolls: header and footer stay in place. */}
              <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
                <RichText value={selected.notes} className="text-muted-foreground mb-4" />
                <PlannedQuantities entry={selected} />
              </div>
              <SheetFooter className="mt-0 flex-col">
                {mealFilter && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedId(null);
                      go({ meal: undefined, view: "day", date: selected.date });
                    }}
                  >
                    <CalendarDays /> Apri il giorno nel calendario
                  </Button>
                )}
                <EntryActions entry={selected} onEdit={() => edit(selected)} onDeleted={() => setSelectedId(null)} />
              </SheetFooter>
            </>
          )}
        </SheetContent>
      </Sheet>

      <AlertDialog open={!!toRemove} onOpenChange={(o) => !o && setToRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rimuovere dal planner?</AlertDialogTitle>
            <AlertDialogDescription>
              {toRemove && `${toRemove.slot} · ${toRemove.meal.name}, ${format(parseISO(toRemove.date), "EEEE d MMMM")}. Il menu resta disponibile.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => toRemove && del.mutate(toRemove.id, { onSuccess: () => selectedId === toRemove.id && setSelectedId(null) })}
            >
              Rimuovi
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function EntryActions({ entry, onEdit, onDeleted }: { entry: PlannedEntry; onEdit: () => void; onDeleted?: () => void }) {
  const del = useDeletePlanned();
  return (
    <>
      <Button variant="outline" size="sm" onClick={onEdit}>
        <Pencil /> Modifica
      </Button>
      <ConfirmDialog
        trigger={
          <Button variant="destructive" size="sm">
            <Trash2 /> Rimuovi
          </Button>
        }
        title="Rimuovere dal planner?"
        description={`${entry.slot} · ${entry.meal.name}. Il menu resta disponibile.`}
        confirmLabel="Rimuovi"
        onConfirm={() => del.mutate(entry.id, { onSuccess: onDeleted })}
      />
    </>
  );
}

type GridProps = {
  days: Date[];
  byDate: Map<string, PlannedEntry[]>;
  onOpenDay: (date: string) => void;
  onAdd: (date: string) => void;
  onSelect: (id: string) => void;
};

/** Warning icon when a course or the "piatti unici" go over the guests limit set in the settings. */
function GuestsWarning({ entry, className }: { entry: PlannedEntry; className?: string }) {
  const { data: settings } = useSettings();
  const percent = settings?.guestsWarningPercent ?? 20;
  if (!plannedExceedsGuests(entry, percent)) return null;
  const label = `Coperti di una portata oltre il ${percent}% in più`;
  return <TriangleAlert role="img" aria-label={label} className={cn("size-3.5 shrink-0 text-amber-600 dark:text-amber-500", className)} />;
}

function ChipBody({ entry, compact }: { entry: PlannedEntry; compact?: boolean }) {
  return compact ? (
    <>
      <GuestsWarning entry={entry} className="mr-1 inline size-3 align-[-2px]" />
      <span className="font-medium">{entry.slot}</span> · {entry.meal.name}
    </>
  ) : (
    <>
      <div className="text-muted-foreground flex items-center justify-between text-xs">
        <span>{entry.slot}</span>
        <span className="flex items-center gap-1 tabular-nums">
          <GuestsWarning entry={entry} className="size-3" />
          <Users className="size-3" />
          {entry.guests}
        </span>
      </div>
      <div className="truncate font-medium">{entry.meal.name}</div>
    </>
  );
}

const chipClass = (compact?: boolean) =>
  cn("bg-primary/10 hover:bg-primary/20 w-full rounded-md text-left transition-colors", compact ? "truncate px-1.5 py-0.5 text-xs" : "px-2 py-1.5 text-sm");

/** Whether the current drag copies (⌥ held) instead of moving. */
const CopyingContext = createContext(false);

/** True while ⌥/Alt is held down. */
function useAltKey() {
  const [alt, setAlt] = useState(false);
  useEffect(() => {
    const update = (e: KeyboardEvent) => setAlt(e.altKey);
    const reset = () => setAlt(false);
    window.addEventListener("keydown", update);
    window.addEventListener("keyup", update);
    window.addEventListener("blur", reset);
    return () => {
      window.removeEventListener("keydown", update);
      window.removeEventListener("keyup", update);
      window.removeEventListener("blur", reset);
    };
  }, []);
  return alt;
}

/** Drag & drop for the week/month grids: drop a planned meal on a day to move it, with ⌥ held to copy it. */
function PlannerDnd({ children }: { children: React.ReactNode }) {
  // A small distance, so a simple click still opens the detail.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const [active, setActive] = useState<{ entry: PlannedEntry; compact: boolean } | null>(null);
  const copying = useAltKey();
  const move = useMovePlanned();
  const copy = useCopyPlanned();

  return (
    <DndContext
      sensors={sensors}
      onDragStart={(e: DragStartEvent) => {
        const entry = e.active.data.current?.entry as PlannedEntry | undefined;
        const compact = (e.active.rect.current.initial?.height ?? 40) < 32;
        if (entry) setActive({ entry, compact });
      }}
      onDragCancel={() => setActive(null)}
      onDragEnd={(e: DragEndEvent) => {
        const entry = active?.entry;
        setActive(null);
        const date = e.over?.id as string | undefined;
        if (!entry || !date) return;
        if (copying) copy.mutate({ id: entry.id, date });
        else if (date !== entry.date) move.mutate({ id: entry.id, date });
      }}
    >
      <CopyingContext.Provider value={copying}>{children}</CopyingContext.Provider>
      <DragOverlay dropAnimation={null}>
        {active && (
          <div className={cn(chipClass(active.compact), "bg-background ring-primary/40 relative w-48 cursor-grabbing shadow-lg ring-1")}>
            <ChipBody entry={active.entry} compact={active.compact} />
            <Badge className="absolute -top-2 -right-2">{copying ? "Copia" : "Sposta"}</Badge>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}

/** What the right-click menu of a planned meal can do; provided by the planner page. */
type EntryMenuActions = {
  open: (e: PlannedEntry) => void;
  edit: (e: PlannedEntry) => void;
  copyToNextDay: (e: PlannedEntry) => void;
  showMealDates: (e: PlannedEntry) => void;
  remove: (e: PlannedEntry) => void;
};
const EntryMenuContext = createContext<EntryMenuActions | null>(null);

/** Right-click menu with the actions of a planned meal. */
function EntryContextMenu({ entry, children }: { entry: PlannedEntry; children: React.ReactNode }) {
  const actions = useContext(EntryMenuContext);
  if (!actions) return children;
  const d = new Date(entry.date)
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuLabel className="max-w-64 truncate">
          {entry.slot} · {entry.meal.name}
        </ContextMenuLabel>
        <ContextMenuSeparator />
        <ContextMenuItem onSelect={() => actions.open(entry)}>
          <Eye /> Apri dettaglio
        </ContextMenuItem>
        {d >= startOfTomorrow() && <ContextMenuItem onSelect={() => actions.edit(entry)}>
          <Pencil /> Modifica pianificazione
        </ContextMenuItem>}
        {d >= startOfToday() && <ContextMenuItem onSelect={() => actions.copyToNextDay(entry)}>
          <CopyPlus /> Copia al giorno dopo
        </ContextMenuItem>}
        <ContextMenuSeparator />
        <ContextMenuItem onSelect={() => actions.showMealDates(entry)}>
          <CalendarDays /> Tutte le date del menu
        </ContextMenuItem>
        <ContextMenuItem asChild>
          <Link to="/meals/$mealId" params={{ mealId: entry.mealId }}>
            <UtensilsCrossed /> Apri il menu
          </Link>
        </ContextMenuItem>
        {d >= startOfTomorrow() && (<>
          <ContextMenuSeparator />
          <ContextMenuItem variant="destructive" onSelect={() => actions.remove(entry)}>
            <Trash2 /> Rimuovi dal planner
          </ContextMenuItem>
        </>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
}

/** A planned meal in the week/month grid: click to open, drag to another day to move (⌥ to copy). */
function EntryChip({ entry, onSelect, compact }: { entry: PlannedEntry; onSelect: (id: string) => void; compact?: boolean }) {
  const { setNodeRef, listeners, attributes, isDragging } = useDraggable({ id: entry.id, data: { entry } });
  return (
    <EntryContextMenu entry={entry}>
      <button
        ref={setNodeRef}
        type="button"
        {...attributes}
        {...listeners}
        onClick={() => onSelect(entry.id)}
        title="Trascina su un altro giorno per spostare, tieni premuto ⌥ per copiare"
        className={cn(chipClass(compact), "cursor-grab touch-none", isDragging && "opacity-40")}
      >
        <ChipBody entry={entry} compact={compact} />
      </button>
    </EntryContextMenu>
  );
}

/** A day cell that accepts dropped planned meals; red when it already has the dragged menu. */
function DropDay({ date, entries = [], className, children }: { date: string; entries?: PlannedEntry[]; className?: string; children: React.ReactNode }) {
  const { setNodeRef, isOver, active } = useDroppable({ id: date, data: { entries } });
  const dragged = active?.data.current?.entry as PlannedEntry | undefined;
  const copying = useContext(CopyingContext);
  const taken = !!dragged && entries.some((e) => e.mealId === dragged.mealId && (copying || e.id !== dragged.id));
  return (
    <div
      ref={setNodeRef}
      className={cn(className, isOver && (taken ? "bg-destructive/5 ring-destructive/50 ring-2 ring-inset" : "bg-primary/5 ring-primary/50 ring-2 ring-inset"))}
    >
      {children}
    </div>
  );
}

function WeekView({ days, byDate, onOpenDay, onAdd, onSelect }: GridProps) {
  return (
    <div className="grid flex-1 divide-y md:grid-cols-7 md:divide-x md:divide-y-0">
      {days.map((d) => {
        const key = iso(d);
        const list = byDate.get(key) ?? [];
        return (
          <DropDay key={key} date={key} entries={list} className="group flex min-h-40 flex-col p-2">
            <div className="mb-2 flex items-center justify-between">
              <button type="button" onClick={() => onOpenDay(key)} className="flex items-center gap-1.5 text-left hover:underline">
                <span className="text-muted-foreground text-xs capitalize">{format(d, "EEE")}</span>
                <span
                  className={cn(
                    "flex size-5 items-center justify-center rounded-full font-semibold text-sm",
                    isToday(d) && "bg-primary text-primary-foreground",
                  )}
                >
                  {format(d, "d")}
                </span>
              </button>
              <Button variant="ghost" size="icon-xs" disabled={d < startOfTomorrow()} onClick={() => onAdd(key)} aria-label="Aggiungi" className="opacity-60 group-hover:opacity-100">
                {d >= startOfTomorrow() && <Plus />}
              </Button>
            </div>
            <div className="space-y-1.5">
              {list.map((e) => (
                <EntryChip key={e.id} entry={e} onSelect={onSelect} />
              ))}
            </div>
          </DropDay>
        );
      })}
    </div>
  );
}

function MonthView({ anchor, days, byDate, onOpenDay, onAdd, onSelect }: GridProps & { anchor: Date }) {
  const weekdays = days.slice(0, 7);
  return (
    <div className="overflow-hidden rounded-lg border">
      <div className="bg-muted/50 grid grid-cols-7 border-b">
        {weekdays.map((d) => (
          <div key={iso(d)} className="text-muted-foreground px-2 py-1.5 text-xs font-medium capitalize">
            {format(d, "EEE")}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((d) => {
          const key = iso(d);
          const list = byDate.get(key) ?? [];
          return (
            <DropDay
              key={key}
              date={key}
              entries={list}
              className={cn(
                "group min-h-28 space-y-1 border-r border-b p-1.5 [&:nth-child(7n)]:border-r-0",
                !isSameMonth(d, anchor) && "bg-muted/30 text-muted-foreground",
              )}
            >
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => onOpenDay(key)}
                  className={cn(
                    "flex size-6 items-center justify-center rounded-full text-xs hover:underline",
                    isToday(d) && "bg-primary text-primary-foreground",
                  )}
                >
                  {format(d, "d")}
                </button>
                <Button variant="ghost" size="icon-xs" onClick={() => onAdd(key)} aria-label="Aggiungi" className="opacity-0 group-hover:opacity-100">
                  <Plus />
                </Button>
              </div>
              {list.slice(0, 3).map((e) => (
                <EntryChip key={e.id} entry={e} onSelect={onSelect} compact />
              ))}
              {list.length > 3 && (
                <button type="button" onClick={() => onOpenDay(key)} className="text-muted-foreground px-1.5 text-xs hover:underline">
                  +{list.length - 3} altri
                </button>
              )}
            </DropDay>
          );
        })}
      </div>
    </div>
  );
}

function DayView({ entries, onAdd, onEdit }: { entries: PlannedEntry[]; onAdd: () => void; onEdit: (e: PlannedEntry) => void }) {
  if (entries.length === 0) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyTitle>Nessun menu pianificato</EmptyTitle>
          <EmptyDescription>Aggiungi un menu con il numero di coperti previsti: le quantità verranno calcolate in automatico.</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button onClick={onAdd}>
            <CalendarPlus /> Pianifica
          </Button>
        </EmptyContent>
      </Empty>
    );
  }
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      {entries.map((e) => (
        <Card key={e.id}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {e.slot} · {e.meal.name}
              <GuestsWarning entry={e} className="size-4" />
            </CardTitle>
            <CardDescription className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">
                <Users /> {e.guests} coperti
              </Badge>
              {toPlainText(e.notes)}
            </CardDescription>
            <CardAction className="flex gap-1">
              <EntryActions entry={e} onEdit={() => onEdit(e)} />
            </CardAction>
          </CardHeader>
          <CardContent>
            <PlannedDetail entry={e} />
          </CardContent>
        </Card>
      ))}
      <Button variant="outline" className="h-auto min-h-20 border-dashed xl:col-span-2" onClick={onAdd}>
        <Plus /> Aggiungi un altro menu
      </Button>
    </div>
  );
}

/** Days on which one menu is planned: upcoming first, then past (most recent first). */
function MealOccurrences({ entries, onSelect, onAdd }: { entries: PlannedEntry[]; onSelect: (id: string) => void; onAdd: () => void }) {
  if (entries.length === 0) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyTitle>Menu mai pianificato</EmptyTitle>
          <EmptyDescription>Questo menu non è ancora nel planner.</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button onClick={onAdd}>
            <CalendarPlus /> Pianifica
          </Button>
        </EmptyContent>
      </Empty>
    );
  }
  const today = iso(new Date());
  const upcoming = entries.filter((e) => e.date >= today);
  const past = entries.filter((e) => e.date < today).reverse();
  const guests = entries.reduce((n, e) => n + e.guests, 0);

  return (
    <div className="space-y-6">
      <p className="text-muted-foreground text-sm">
        Pianificato {entries.length} {entries.length === 1 ? "volta" : "volte"}, {guests} coperti in totale.
      </p>
      {[
        { title: "Prossime", list: upcoming },
        { title: "Passate", list: past },
      ].map(
        ({ title, list }) =>
          list.length > 0 && (
            <div key={title} className="space-y-2">
              <h2 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                {title} ({list.length})
              </h2>
              <ItemGroup className="gap-2">
                {list.map((e) => (
                  <Item key={e.id} variant="outline" asChild>
                    <button type="button" onClick={() => onSelect(e.id)} className="hover:bg-muted text-left">
                      <ItemMedia
                        className={cn("bg-muted w-12 flex-col gap-0 rounded-md py-1 leading-tight", e.date === today && "bg-primary text-primary-foreground")}
                      >
                        <span className="text-[10px] uppercase">{format(parseISO(e.date), "MMM")}</span>
                        <span className="text-lg font-semibold tabular-nums">{format(parseISO(e.date), "d")}</span>
                      </ItemMedia>
                      <ItemContent className="min-w-0">
                        <ItemTitle className="capitalize">{format(parseISO(e.date), "EEEE d MMMM yyyy")}</ItemTitle>
                        <ItemDescription>
                          {e.slot}
                          {e.notes && ` · ${toPlainText(e.notes)}`}
                        </ItemDescription>
                      </ItemContent>
                      <ItemActions>
                        <GuestsWarning entry={e} className="size-4" />
                        <Badge variant="secondary">
                          <Users /> {e.guests}
                        </Badge>
                      </ItemActions>
                    </button>
                  </Item>
                ))}
              </ItemGroup>
            </div>
          ),
      )}
    </div>
  );
}
