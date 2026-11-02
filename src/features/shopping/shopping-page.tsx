import { useMemo, useState } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { addWeeks, endOfWeek, format, parseISO, startOfWeek } from "date-fns";
import type { DateRange } from "react-day-picker";
import { CalendarIcon, Copy, Share2, ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import { PageBody, PageHeader } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { usePlanned, scalePlanned } from "@/features/planner/api";
import { aggregate, formatQuantity } from "@/lib/units";
import { cn } from "@/lib/utils";

export type ShoppingSearch = { from?: string; to?: string };

const iso = (d: Date) => format(d, "yyyy-MM-dd");

export function ShoppingPage() {
  const search = useSearch({ from: "/shopping" });
  const navigate = useNavigate({ from: "/shopping" });
  const from = search.from ?? iso(startOfWeek(new Date()));
  const to = search.to && search.to >= from ? search.to : iso(endOfWeek(parseISO(from)));
  const { data: entries = [], isLoading } = usePlanned(from, to);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [draft, setDraft] = useState<DateRange | undefined>();

  const lines = useMemo(
    () => aggregate(entries.flatMap((e) => scalePlanned(e).flatMap((c) => c.recipes.flatMap((r) => r.lines)))),
    [entries],
  );

  const setRange = (f: Date, t: Date) => navigate({ search: { from: iso(f), to: iso(t) } });
  const thisWeek = startOfWeek(new Date());
  const toggle = (key: string) =>
    setChecked((s) => {
      const next = new Set(s);
      if (!next.delete(key)) next.add(key);
      return next;
    });

  const asText = () =>
    [`Lista della spesa ${format(parseISO(from), "d/M")}–${format(parseISO(to), "d/M/yyyy")}`, "", ...lines.map((l) => `- ${l.ingredientName}: ${formatQuantity(l.quantity, l.unit)}`)].join("\n");

  return (
    <>
      <PageHeader
        title="Lista della spesa"
        description={`${entries.length} menu pianificati nel periodo`}
        actions={
          <>
            <Button
              variant="outline"
              disabled={!lines.length}
              onClick={async () => {
                await navigator.clipboard.writeText(asText());
                toast.success("Lista copiata");
              }}
            >
              <Copy /> Copia
            </Button>
            {/* <Button variant="outline" disabled={!lines.length} onClick={() => window.print()}>
              <Printer /> Stampa
            </Button> */}
            <Button variant="outline" disabled={!lines.length}>
              <Share2  /> Condividi
            </Button>
          </>
        }
      />
      <PageBody className="space-y-4">
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <Popover
            open={calendarOpen}
            onOpenChange={(o) => {
              setCalendarOpen(o);
              if (o) setDraft({ from: parseISO(from), to: parseISO(to) });
            }}
          >
            <PopoverTrigger asChild>
              <Button variant="outline" className="font-normal">
                <CalendarIcon />
                {format(parseISO(from), "d MMM")} – {format(parseISO(to), "d MMM yyyy")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="range"
                numberOfMonths={2}
                selected={draft}
                defaultMonth={parseISO(from)}
                onSelect={(r) => {
                  setDraft(r);
                  if (r?.from && r.to && r.from.getTime() !== r.to.getTime()) {
                    setRange(r.from, r.to);
                    setCalendarOpen(false);
                  }
                }}
              />
            </PopoverContent>
          </Popover>
          <Button variant="ghost" size="sm" onClick={() => setRange(thisWeek, endOfWeek(thisWeek))}>
            Questa settimana
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setRange(addWeeks(thisWeek, 1), endOfWeek(addWeeks(thisWeek, 1)))}>
            Prossima settimana
          </Button>
        </div>

        <h2 className="hidden text-lg font-semibold print:block">
          Lista della spesa {format(parseISO(from), "d MMM")} – {format(parseISO(to), "d MMM yyyy")}
        </h2>

        {!isLoading && lines.length === 0 ? (
          <Empty className="border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <ShoppingCart />
              </EmptyMedia>
              <EmptyTitle>Niente da comprare</EmptyTitle>
              <EmptyDescription>Non ci sono menu pianificati con ingredienti in questo periodo.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="max-w-2xl rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10 print:hidden" />
                  <TableHead>Ingrediente</TableHead>
                  <TableHead className="text-right">Quantità</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lines.map((l) => {
                  const on = checked.has(l.key);
                  return (
                    <TableRow key={l.key} className="cursor-pointer" onClick={() => toggle(l.key)}>
                      <TableCell className="print:hidden">
                        <Checkbox checked={on} onCheckedChange={() => toggle(l.key)} onClick={(e) => e.stopPropagation()} aria-label={l.ingredientName} />
                      </TableCell>
                      <TableCell className={cn(on && "text-muted-foreground line-through")}>{l.ingredientName}</TableCell>
                      <TableCell className={cn("text-right tabular-nums", on && "text-muted-foreground line-through")}>
                        {formatQuantity(l.quantity, l.unit)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </PageBody>
    </>
  );
}
