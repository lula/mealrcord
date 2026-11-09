import { useMemo, useState } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { addWeeks, endOfWeek, format, parseISO, startOfWeek } from "date-fns";
import type { DateRange } from "react-day-picker";
import { CalendarIcon, Share2, ShoppingCart } from "lucide-react";
import { PageBody, PageHeader } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useGroupByCategory } from "@/features/ingredients/api";
import { LinesByCategory } from "@/features/planner/planned-detail";
import { plannedLines, usePlanned } from "@/features/planner/api";
import { aggregate, formatQuantity } from "@/lib/units";
import { cn } from "@/lib/utils";
import { sharePdf } from "@/lib/share";
import { shoppingListPdf } from "@/features/planner/pdf";

export type ShoppingSearch = { from?: string; to?: string };

const iso = (d: Date) => format(d, "yyyy-MM-dd");

export function ShoppingPage() {
  const search = useSearch({ from: "/shopping" });
  const navigate = useNavigate({ from: "/shopping" });
  const from = search.from ?? iso(startOfWeek(new Date()));
  const to = search.to && search.to >= from ? search.to : iso(endOfWeek(parseISO(from)));
  const { data: entries = [], isLoading } = usePlanned(from, to);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [draft, setDraft] = useState<DateRange | undefined>();
  const [view, setView] = useState<"total" | "categories">("total");

  const lines = useMemo(
    () => aggregate(entries.flatMap(plannedLines)),
    [entries],
  );

  const groups = useGroupByCategory(lines);

  const setRange = (f: Date, t: Date) => navigate({ search: { from: iso(f), to: iso(t) } });
  const thisWeek = startOfWeek(new Date());

  const title = `Lista della spesa ${format(parseISO(from), "d-M")} – ${format(parseISO(to), "d-M-yyyy")}`;
  const share = () =>
    sharePdf(title, shoppingListPdf("Lista della spesa", `${format(parseISO(from), "d/M")} – ${format(parseISO(to), "d/M/yyyy")}`, `${entries.length} menu pianificati`, lines, groups));

  return (
    <>
      <PageHeader
        title="Lista della spesa"
        description={`${entries.length} menu pianificati nel periodo`}
        actions={
          <Button variant="outline" disabled={!lines.length} onClick={share}>
            <Share2 /> Condividi PDF
          </Button>
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
          <Tabs value={view} onValueChange={(v) => setView(v as typeof view)} className="max-w-2xl">
            <TabsList className="print:hidden">
              <TabsTrigger value="total">Totale</TabsTrigger>
              <TabsTrigger value="categories">Per categoria</TabsTrigger>
            </TabsList>
            <TabsContent value="total">
              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ingrediente</TableHead>
                      <TableHead className="text-right">Quantità</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lines.map((l) => (
                      <TableRow key={l.key} className="cursor-pointer">
                        <TableCell>{l.ingredientName}</TableCell>
                        <TableCell className={cn("text-right tabular-nums")}>{formatQuantity(l.quantity, l.unit)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
            <TabsContent value="categories">
              <LinesByCategory lines={lines} />
            </TabsContent>
          </Tabs>
        )}
      </PageBody>
    </>
  );
}
