import { useMemo, useState } from "react";
import { Check, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { filterRecipes } from "@/features/recipes/recipes-page";
import { useRecipes } from "@/features/recipes/api";
import { TagBadges, TagPicker } from "@/features/tags/tag-picker";

/** Dialog to pick several recipes, searchable by name and filterable by tag. */
export function RecipePicker({
  open,
  onOpenChange,
  title,
  initialTagIds,
  selected,
  unavailable = {},
  max,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  initialTagIds: string[];
  selected: string[];
  /** Recipes that cannot be picked, with the reason shown (e.g. "Già nei primi"). */
  unavailable?: Record<string, string>;
  /** Most recipes that can be picked. */
  max?: number;
  onConfirm: (ids: string[]) => void;
}) {
  const { data: recipes = [] } = useRecipes();
  const [search, setSearch] = useState("");
  const [tagIds, setTagIds] = useState(initialTagIds);
  const [picked, setPicked] = useState<string[]>(selected);

  // Reset local state each time the dialog opens.
  const [lastOpen, setLastOpen] = useState(false);
  if (open !== lastOpen) {
    setLastOpen(open);
    if (open) {
      setSearch("");
      setTagIds(initialTagIds);
      setPicked(selected);
    }
  }

  const results = useMemo(() => filterRecipes(recipes, search, tagIds), [recipes, search, tagIds]);
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Cerca per nome o filtra per tag. Rimuovi il filtro portata per vedere tutte le ricette.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap gap-2">
          <InputGroup className="min-w-48 flex-1">
            <InputGroupAddon>
              <Search />
            </InputGroupAddon>
            <InputGroupInput autoFocus placeholder="Cerca ricetta…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </InputGroup>
          <TagPicker value={tagIds} onChange={setTagIds} placeholder="Tutti i tag" />
        </div>
        <ScrollArea className="h-80 rounded-md border">
          <div className="p-1">
            {results.length === 0 && <p className="text-muted-foreground p-6 text-center text-sm">Nessuna ricetta trovata.</p>}
            {results.map((r) => {
              const on = picked.includes(r.id);
              const full = max != null && picked.length >= max && !on;
              const reason = unavailable[r.id] ?? (full ? `Massimo ${max} ricette` : undefined);
              return (
                <button
                  key={r.id}
                  type="button"
                  disabled={!!reason}
                  onClick={() => toggle(r.id)}
                  className={cn(
                    "hover:bg-accent flex w-full items-center gap-3 rounded-md px-3 py-2 text-left disabled:pointer-events-none disabled:opacity-50",
                    on && "bg-accent/60",
                  )}
                >
                  <Check className={cn("size-4 shrink-0", on ? "opacity-100" : "opacity-0")} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{r.name}</span>
                    <span className="text-muted-foreground text-xs">{reason ?? `${r.baseServings} persone`}</span>
                  </span>
                  {/* <TagBadges tags={r.tags.map((t) => t.tag)} /> */}
                </button>
              );
            })}
          </div>
        </ScrollArea>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annulla
          </Button>
          <Button
            onClick={() => {
              onConfirm(picked);
              onOpenChange(false);
            }}
          >
            Conferma ({picked.length})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
