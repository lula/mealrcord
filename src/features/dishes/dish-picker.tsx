import { useState } from "react";
import { Check, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useDishes } from "./api";

/** Dialog to pick several "piatti unici", searchable by name or recipe. */
export function DishPicker({
  open,
  onOpenChange,
  selected,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selected: string[];
  onConfirm: (ids: string[]) => void;
}) {
  const { data: dishes = [] } = useDishes();
  const [search, setSearch] = useState("");
  const [picked, setPicked] = useState<string[]>(selected);

  // Reset local state each time the dialog opens.
  const [lastOpen, setLastOpen] = useState(false);
  if (open !== lastOpen) {
    setLastOpen(open);
    if (open) {
      setSearch("");
      setPicked(selected);
    }
  }

  const q = search.trim().toLowerCase();
  const results = dishes.filter((d) => !q || d.name.toLowerCase().includes(q) || d.recipes.some((r) => r.recipe.name.toLowerCase().includes(q)));
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Piatti unici</DialogTitle>
          <DialogDescription>Cerca per nome del piatto o di una sua ricetta.</DialogDescription>
        </DialogHeader>
        <InputGroup>
          <InputGroupAddon>
            <Search />
          </InputGroupAddon>
          <InputGroupInput autoFocus placeholder="Cerca piatto unico…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </InputGroup>
        <ScrollArea className="h-80 rounded-md border">
          <div className="p-1">
            {results.length === 0 && (
              <p className="text-muted-foreground p-6 text-center text-sm">{dishes.length ? "Nessun piatto unico trovato." : "Crea prima un piatto unico."}</p>
            )}
            {results.map((d) => {
              const on = picked.includes(d.id);
              return (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => toggle(d.id)}
                  className={cn("hover:bg-accent flex w-full items-center gap-3 rounded-md px-3 py-2 text-left", on && "bg-accent/60")}
                >
                  <Check className={cn("size-4 shrink-0", on ? "opacity-100" : "opacity-0")} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{d.name}</span>
                    <span className="text-muted-foreground block truncate text-xs">{d.recipes.map((r) => r.recipe.name).join(" · ")}</span>
                  </span>
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
