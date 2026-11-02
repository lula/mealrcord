import { useState } from "react";
import { Check, Plus, Tags } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { createTag, useTags } from "./api";
import { useDbMutation } from "@/lib/query";

/** Multi-select for tags. With `allowCreate`, typing a new name offers to create a custom tag. */
export function TagPicker({
  value,
  onChange,
  allowCreate = false,
  placeholder = "Tag",
}: {
  value: string[];
  onChange: (ids: string[]) => void;
  allowCreate?: boolean;
  placeholder?: string;
}) {
  const { data: tags = [] } = useTags();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const create = useDbMutation(createTag);

  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
  const trimmed = search.trim();
  const exists = tags.some((t) => t.name.toLowerCase() === trimmed.toLowerCase());
  const selected = tags.filter((t) => value.includes(t.id));

  const groups = [
    { label: "Portata", items: tags.filter((t) => t.isSystem) },
    { label: "Personalizzati", items: tags.filter((t) => !t.isSystem) },
  ].filter((g) => g.items.length);

  return (
    <Popover open={open} onOpenChange={(o) => (setOpen(o), o || setSearch(""))}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="justify-start gap-1.5 py-1.5 font-normal">
          <Tags className="text-muted-foreground" />
          {selected.length === 0 ? (
            <span className="text-muted-foreground">{placeholder}</span>
          ) : (
            <span className="flex flex-wrap gap-1">
              {selected.map((t) => (
                <Badge key={t.id} variant={t.isSystem ? "default" : "secondary"}>
                  {t.name}
                </Badge>
              ))}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="start">
        <Command>
          <CommandInput placeholder={allowCreate ? "Cerca o crea…" : "Cerca tag…"} value={search} onValueChange={setSearch} />
          <CommandList>
            <CommandEmpty>Nessun tag.</CommandEmpty>
            {groups.map((g) => (
              <CommandGroup key={g.label} heading={g.label}>
                {g.items.map((t) => (
                  <CommandItem key={t.id} value={t.name} onSelect={() => toggle(t.id)}>
                    <Check className={cn(value.includes(t.id) ? "opacity-100" : "opacity-0")} />
                    {t.name}
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
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
                    Crea tag «{trimmed}»
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

export function TagBadges({ tags }: { tags: { id: string; name: string; isSystem: boolean }[] }) {
  return (
    <div className="flex flex-wrap gap-1">
      {tags.map((t) => (
        <Badge key={t.id} variant={t.isSystem ? "default" : "secondary"}>
          {t.name}
        </Badge>
      ))}
    </div>
  );
}
