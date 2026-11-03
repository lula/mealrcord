import { useState } from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const MAX_RESULTS = 10;

/**
 * Picks one item searching by name, showing at most 10 matches.
 * `undefined` = no choice (shown as `allLabel`).
 */
export function SearchSelect({
  items,
  value,
  onChange,
  allLabel,
  searchPlaceholder,
  emptyText,
  className,
  "aria-label": ariaLabel,
}: {
  items: { id: string; name: string }[];
  value: string | undefined;
  onChange: (id: string | undefined) => void;
  allLabel: string;
  searchPlaceholder: string;
  emptyText: string;
  className?: string;
  "aria-label"?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const current = items.find((i) => i.id === value);
  const query = search.trim().toLowerCase();
  const matches = query ? items.filter((i) => i.name.toLowerCase().includes(query)) : items;
  const shown = matches.slice(0, MAX_RESULTS);

  const pick = (id: string | undefined) => {
    onChange(id);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={(o) => (setOpen(o), o || setSearch(""))}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" aria-label={ariaLabel} className={cn("w-56 justify-between font-normal", className)}>
          <span className={cn("truncate", !current && "text-muted-foreground")}>{current?.name ?? allLabel}</span>
          <ChevronsUpDown className="opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-fit max-w-100 p-0" align="start">
        {/* Filtering is done here so the list can be capped at MAX_RESULTS. */}
        <Command shouldFilter={false}>
          <CommandInput placeholder={searchPlaceholder} value={search} onValueChange={setSearch} />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            {value && !query && (
              <CommandGroup>
                <CommandItem value="__all" onSelect={() => pick(undefined)}>
                  <X />
                  {allLabel}
                </CommandItem>
              </CommandGroup>
            )}
            {shown.length > 0 && (
              <CommandGroup>
                {shown.map((i) => (
                  <CommandItem key={i.id} value={i.id} onSelect={() => pick(i.id)}>
                    <Check className={cn(i.id === value ? "opacity-100" : "opacity-0")} />
                    <span className="truncate">{i.name}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {matches.length > MAX_RESULTS && (
              <p className="text-muted-foreground px-3 py-2 text-xs">Altri {matches.length - MAX_RESULTS}: scrivi per restringere la ricerca.</p>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
