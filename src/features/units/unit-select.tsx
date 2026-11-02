import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DIMENSIONS } from "@/db/schema";
import { DIMENSION_LABELS, useUnits } from "./api";

export function UnitSelect({ value, onChange, className }: { value: string; onChange: (id: string) => void; className?: string }) {
  const { data: units = [] } = useUnits();
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={className}>
        <SelectValue placeholder="Unità" />
      </SelectTrigger>
      <SelectContent>
        {DIMENSIONS.map((d) => (
          <SelectGroup key={d}>
            <SelectLabel>{DIMENSION_LABELS[d]}</SelectLabel>
            {units
              .filter((u) => u.dimension === d)
              .map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.symbol}
                </SelectItem>
              ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  );
}
