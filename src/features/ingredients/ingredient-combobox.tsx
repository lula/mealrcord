import { useState } from "react";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useDbMutation } from "@/lib/query";
import { createIngredient, useIngredients } from "./api";

/** Picks an ingredient, or creates a new one from the search text. */
export function IngredientCombobox({
  value,
  onChange,
  exclude = [],
}: {
  value: string;
  onChange: (id: string, defaultUnitId: string | null) => void;
  /** Ingredients already used in the recipe. */
  exclude?: string[];
}) {
  const { data: ingredients = [] } = useIngredients();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const create = useDbMutation(createIngredient);

  const current = ingredients.find((i) => i.id === value);
  const trimmed = search.trim();
  const exists = ingredients.some((i) => i.name.toLowerCase() === trimmed.toLowerCase());
  const options = ingredients.filter((i) => i.id === value || !exclude.includes(i.id));

  return (
    <Popover open={open} onOpenChange={(o) => (setOpen(o), o || setSearch(""))}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
          <span className={cn("truncate", !current && "text-muted-foreground")}>{current?.name ?? "Scegli ingrediente…"}</span>
          <ChevronsUpDown className="opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) min-w-64 p-0" align="start">
        <Command>
          <CommandInput placeholder="Cerca o crea…" value={search} onValueChange={setSearch} />
          <CommandList>
            <CommandEmpty>{trimmed ? "Nessun ingrediente trovato." : "Nessun ingrediente: scrivi per crearne uno."}</CommandEmpty>
            <CommandGroup>
              {options.map((i) => (
                <CommandItem
                  key={i.id}
                  value={i.name}
                  onSelect={() => {
                    onChange(i.id, i.defaultUnitId);
                    setOpen(false);
                  }}
                >
                  <Check className={cn(i.id === value ? "opacity-100" : "opacity-0")} />
                  {i.name}
                </CommandItem>
              ))}
            </CommandGroup>
            {trimmed && !exists && (
              <CommandGroup>
                <CommandItem
                  value={`__create ${trimmed}`}
                  onSelect={async () => {
                    const id = await create.mutateAsync({ name: trimmed });
                    onChange(id, null);
                    setOpen(false);
                  }}
                >
                  <Plus />
                  Crea «{trimmed}»
                </CommandItem>
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
