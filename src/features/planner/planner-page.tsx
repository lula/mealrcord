import { useMemo, useState } from "react";
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
  startOfWeek,
} from "date-fns";
import { CalendarPlus, ChevronLeft, ChevronRight, Pencil, Plus, ShoppingCart, Trash2, Users } from "lucide-react";
import { PageBody, PageHeader } from "@/components/page";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import { useDeletePlanned, usePlanned, type PlannedEntry } from "./api";
import { PlannedDetail } from "./planned-detail";
import { PlannedDialog } from "./planned-dialog";

export type PlannerView = "month" | "week" | "day";
export type PlannerSearch = { view?: PlannerView; date?: string };

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
  return isSameMonth(start, end)
    ? `${format(start, "d")}–${format(end, "d MMMM yyyy")}`
    : `${format(start, "d MMM")} – ${format(end, "d MMM yyyy")}`;
}

const STEP = { day: addDays, week: addWeeks, month: addMonths } as const;

export function PlannerPage() {
  const { view = "week", date } = useSearch({ from: "/planner" });
  const navigate = useNavigate({ from: "/planner" });
  const anchor = date ? parseISO(date) : new Date();
  const { start, end } = rangeFor(view, anchor);
  const { data: entries = [] } = usePlanned(iso(start), iso(end));

  const [dialog, setDialog] = useState<{ date?: string; entry?: PlannedEntry } | null>(null);
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
        title={<span className="capitalize">{titleFor(view, anchor)}</span>}
        actions={
          <>
            <Button variant="outline" asChild>
              <Link to="/shopping" search={{ from: iso(start), to: iso(end) }}>
                <ShoppingCart /> Spesa
              </Link>
            </Button>
            <Button onClick={() => setDialog({ date: iso(view === "day" ? anchor : new Date()) })}>
              <CalendarPlus /> Pianifica
            </Button>
          </>
        }
      />
      <div className="flex flex-wrap items-center gap-2 border-b px-2 py-2">
        <Button variant="outline" size="sm" onClick={() => go({ date: undefined })}>
          Oggi
        </Button>
        <Button variant="ghost" size="icon-sm" onClick={() => shift(-1)} aria-label="Precedente">
          <ChevronLeft />
        </Button>
        <Button variant="ghost" size="icon-sm" onClick={() => shift(1)} aria-label="Successivo">
          <ChevronRight />
        </Button>
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          className="ml-auto"
          value={view}
          onValueChange={(v) => v && go({ view: v as PlannerView })}
        >
          <ToggleGroupItem value="month">Mese</ToggleGroupItem>
          <ToggleGroupItem value="week">Settimana</ToggleGroupItem>
          <ToggleGroupItem value="day">Giorno</ToggleGroupItem>
        </ToggleGroup>
      </div>

      <PageBody className={view === "week" ? "flex flex-col" : ""}>
        {view === "month" && (
          <MonthView
            anchor={anchor}
            days={days}
            byDate={byDate}
            onOpenDay={(d) => go({ view: "day", date: d })}
            onAdd={(d) => setDialog({ date: d })}
            onSelect={setSelectedId}
          />
        )}
        {view === "week" && (
          <WeekView days={days} byDate={byDate} onOpenDay={(d) => go({ view: "day", date: d })} onAdd={(d) => setDialog({ date: d })} onSelect={setSelectedId} />
        )}
        {view === "day" && (
          <DayView
            entries={byDate.get(iso(anchor)) ?? []}
            onAdd={() => setDialog({ date: iso(anchor) })}
            onEdit={(entry) => setDialog({ entry })}
          />
        )}
      </PageBody>

      <PlannedDialog open={!!dialog} onOpenChange={(o) => !o && setDialog(null)} date={dialog?.date} entry={dialog?.entry} />

      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelectedId(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle>
                  {selected.slot} · {selected.meal.name}
                </SheetTitle>
                <SheetDescription className="capitalize">
                  {format(parseISO(selected.date), "EEEE d MMMM")} · {selected.guests} coperti
                </SheetDescription>
              </SheetHeader>
              <div className="px-4">
                {selected.notes && <p className="text-muted-foreground mb-4 text-sm">{selected.notes}</p>}
                <PlannedDetail entry={selected} />
              </div>
              <SheetFooter className="flex-col">
                <EntryActions entry={selected} onEdit={() => setDialog({ entry: selected })} onDeleted={() => setSelectedId(null)} />
              </SheetFooter>
            </>
          )}
        </SheetContent>
      </Sheet>
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
        description={`${entry.slot} · ${entry.meal.name}. Il pasto resta disponibile.`}
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

function EntryChip({ entry, onSelect, compact }: { entry: PlannedEntry; onSelect: (id: string) => void; compact?: boolean }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(entry.id)}
      className={cn(
        "bg-primary/10 hover:bg-primary/20 w-full rounded-md text-left transition-colors",
        compact ? "truncate px-1.5 py-0.5 text-xs" : "px-2 py-1.5 text-sm",
      )}
    >
      {compact ? (
        <>
          <span className="font-medium">{entry.slot}</span> · {entry.meal.name}
        </>
      ) : (
        <>
          <div className="text-muted-foreground flex items-center justify-between text-xs">
            <span>{entry.slot}</span>
            <span className="flex items-center gap-1 tabular-nums">
              <Users className="size-3" />
              {entry.guests}
            </span>
          </div>
          <div className="truncate font-medium">{entry.meal.name}</div>
        </>
      )}
    </button>
  );
}

function WeekView({ days, byDate, onOpenDay, onAdd, onSelect }: GridProps) {
  return (
    <div className="grid flex-1 divide-y md:grid-cols-7 md:divide-x md:divide-y-0">
      {days.map((d) => {
        const key = iso(d);
        const list = byDate.get(key) ?? [];
        return (
          <div key={key} className="group flex min-h-40 flex-col p-2">
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
              <Button variant="ghost" size="icon-xs" onClick={() => onAdd(key)} aria-label="Aggiungi" className="opacity-60 group-hover:opacity-100">
                <Plus />
              </Button>
            </div>
            <div className="space-y-1.5">
              {list.map((e) => (
                <EntryChip key={e.id} entry={e} onSelect={onSelect} />
              ))}
            </div>
          </div>
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
            <div
              key={key}
              className={cn("group min-h-28 space-y-1 border-r border-b p-1.5 [&:nth-child(7n)]:border-r-0", !isSameMonth(d, anchor) && "bg-muted/30 text-muted-foreground")}
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
            </div>
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
          <EmptyTitle>Nessun pasto pianificato</EmptyTitle>
          <EmptyDescription>Aggiungi un pasto con il numero di coperti previsti: le quantità verranno calcolate in automatico.</EmptyDescription>
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
            <CardTitle>
              {e.slot} · {e.meal.name}
            </CardTitle>
            <CardDescription className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">
                <Users /> {e.guests} coperti
              </Badge>
              {e.notes}
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
        <Plus /> Aggiungi un altro pasto
      </Button>
    </div>
  );
}
