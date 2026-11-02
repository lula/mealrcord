import { useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * Number input that shows a proposed value until the user types their own.
 * `value` is the user's value (null = use `proposed`). Clearing the field
 * goes back to the proposed value when the field loses focus.
 */
export function ProposedNumberInput({
  value,
  proposed,
  onChange,
  onBlur,
  className,
  ...props
}: Omit<React.ComponentProps<typeof Input>, "value" | "onChange" | "type"> & {
  value: number | null | undefined;
  proposed: number | null | undefined;
  onChange: (value: number | null) => void;
}) {
  // Raw text while editing, so the field can be emptied before typing a new number.
  const [draft, setDraft] = useState<string | null>(null);
  const own = value != null;
  const shown = draft ?? (own ? String(value) : proposed != null && Number.isFinite(proposed) ? String(proposed) : "");

  return (
    <Input
      {...props}
      type="number"
      className={cn(!own && draft === null && "text-muted-foreground", className)}
      value={shown}
      onFocus={(e) => {
        setDraft(shown);
        e.target.select();
      }}
      onChange={(e) => {
        setDraft(e.target.value);
        onChange(e.target.value === "" ? null : e.target.valueAsNumber);
      }}
      onBlur={(e) => {
        setDraft(null);
        onBlur?.(e);
      }}
    />
  );
}
