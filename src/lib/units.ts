import type { Dimension } from "@/db/schema";

export type UnitLike = {
  id: string;
  symbol: string;
  dimension: Dimension;
  factorToBase: number;
};

export type QuantityLine = {
  ingredientId: string;
  ingredientName: string;
  quantity: number;
  unit: UnitLike;
};

export type AggregatedLine = {
  key: string;
  ingredientId: string;
  ingredientName: string;
  /** Quantity in the unit given by `unit`. */
  quantity: number;
  unit: UnitLike;
};

export const QB_UNIT_ID = "unit-qb";
/** Unit used when none is chosen. */
export const DEFAULT_UNIT_ID = "unit-g";

/** Units shown for summed quantities, smallest first. */
const DISPLAY_UNITS: Record<Exclude<Dimension, "other">, UnitLike[]> = {
  mass: [
    { id: "unit-g", symbol: "g", dimension: "mass", factorToBase: 1 },
    { id: "unit-kg", symbol: "kg", dimension: "mass", factorToBase: 1000 },
  ],
  volume: [
    { id: "unit-ml", symbol: "ml", dimension: "volume", factorToBase: 1 },
    { id: "unit-l", symbol: "l", dimension: "volume", factorToBase: 1000 },
  ],
};

/** Picks the largest display unit the amount reaches (1500 g -> 1.5 kg). */
export function toDisplayUnit(baseQty: number, dimension: Dimension): { quantity: number; unit: UnitLike } | null {
  if (dimension === "other") return null;
  const candidates = DISPLAY_UNITS[dimension];
  let best = candidates[0];
  for (const u of candidates) if (baseQty >= u.factorToBase) best = u;
  return { quantity: baseQty / best.factorToBase, unit: best };
}

/**
 * Sums quantities per ingredient. Mass and volume are summed across units;
 * 'other' units (pz, spicchio, ...) are summed only with the same unit.
 */
export function aggregate(lines: QuantityLine[]): AggregatedLine[] {
  const groups = new Map<string, AggregatedLine & { base: number }>();
  for (const l of lines) {
    const convertible = l.unit.dimension !== "other";
    const key = `${l.ingredientId}:${convertible ? l.unit.dimension : l.unit.id}`;
    const g = groups.get(key);
    const base = convertible ? l.quantity * l.unit.factorToBase : l.quantity;
    if (g) g.base += base;
    else groups.set(key, { key, ingredientId: l.ingredientId, ingredientName: l.ingredientName, quantity: 0, unit: l.unit, base });
  }
  return [...groups.values()]
    .map(({ base, ...g }) => {
      const display = toDisplayUnit(base, g.unit.dimension);
      return display ? { ...g, ...display } : { ...g, quantity: base };
    })
    .sort((a, b) => a.ingredientName.localeCompare(b.ingredientName, "it"));
}

const numberFormat = new Intl.NumberFormat("it-IT", { maximumFractionDigits: 2 });

export function formatNumber(n: number): string {
  return numberFormat.format(n);
}

/** "1,5 kg", "3 pz", "q.b." */
export function formatQuantity(quantity: number, unit: Pick<UnitLike, "id" | "symbol">): string {
  if (unit.id === QB_UNIT_ID) return "q.b.";
  return `${formatNumber(quantity)} ${unit.symbol}`;
}

/** Formats one quantity, moving mass/volume to a readable unit (2500 g -> "2,5 kg"). */
export function displayQuantity(quantity: number, unit: UnitLike): string {
  if (unit.id === QB_UNIT_ID) return "q.b.";
  const display = toDisplayUnit(quantity * unit.factorToBase, unit.dimension);
  return display ? formatQuantity(display.quantity, display.unit) : formatQuantity(quantity, unit);
}
