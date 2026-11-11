import { useState } from "react";
import { Check, Plus, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useDbMutation } from "@/lib/query";
import { createAllergen, useAllergens } from "./api";

/** Multi-select for allergens. With `allowCreate`, typing a new name offers to create one. */
export function AllergenPicker({
  value,
  onChange,
  allowCreate = false,
  placeholder = "Allergeni",
}: {
  value: string[];
  onChange: (ids: string[]) => void;
  allowCreate?: boolean;
  placeholder?: string;
}) {
  const { data: allergens = [] } = useAllergens();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const create = useDbMutation(createAllergen);

  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
  const trimmed = search.trim();
  const exists = allergens.some((a) => a.name.toLowerCase() === trimmed.toLowerCase());
  const selected = allergens.filter((a) => value.includes(a.id));

  return (
    <Popover open={open} onOpenChange={(o) => (setOpen(o), o || setSearch(""))}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="h-auto min-h-8 justify-start gap-1.5 py-1.5 font-normal whitespace-normal">
          <TriangleAlert className="text-muted-foreground" />
          {selected.length === 0 ? (
            <span className="text-muted-foreground">{placeholder}</span>
          ) : (
            <span className="flex flex-wrap gap-1">
              {selected.map((a) => (
                <Badge key={a.id} variant="destructive">
                  {a.name}
                </Badge>
              ))}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="start">
        <Command>
          <CommandInput placeholder={allowCreate ? "Cerca o crea…" : "Cerca allergene…"} value={search} onValueChange={setSearch} />
          <CommandList>
            <CommandEmpty>Nessun allergene.</CommandEmpty>
            {allergens.length > 0 && (
              <CommandGroup>
                {allergens.map((a) => (
                  <CommandItem key={a.id} value={a.name} onSelect={() => toggle(a.id)}>
                    <Check className={cn(value.includes(a.id) ? "opacity-100" : "opacity-0")} />
                    {a.name}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {allowCreate && trimmed && !exists && (
              <>
                <CommandSeparator />
                <CommandGroup>
                  <CommandItem
                    value={`__create ${trimmed}`}
                    onSelect={async () => {
                      const id = await create.mutateAsync(trimmed);
                      onChange([...value, id]);
                      setSearch("");
                    }}
                  >
                    <Plus />
                    Crea allergene «{trimmed}»
                  </CommandItem>
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export function AllergenBadges({ allergens }: { allergens: { id: string; name: string }[] }) {
  if (allergens.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {allergens.map((a) => (
        <Badge key={a.id} variant="destructive">
          {a.name}
        </Badge>
      ))}
    </div>
  );
}
