import { describe, expect, it } from "vitest";
import { aggregate, displayQuantity, formatQuantity, toDisplayUnit, type UnitLike } from "./units";
import { scaleFactor } from "./scaling";

const g: UnitLike = { id: "unit-g", symbol: "g", dimension: "mass", factorToBase: 1 };
const kg: UnitLike = { id: "unit-kg", symbol: "kg", dimension: "mass", factorToBase: 1000 };
const ml: UnitLike = { id: "unit-ml", symbol: "ml", dimension: "volume", factorToBase: 1 };
const pz: UnitLike = { id: "unit-pcs", symbol: "pz", dimension: "other", factorToBase: 1 };
const clove: UnitLike = { id: "unit-clove", symbol: "spicchio", dimension: "other", factorToBase: 1 };

describe("scaleFactor", () => {
  it("scales by guests over base servings", () => {
    expect(scaleFactor(40, 4)).toBe(10);
  });
  it("applies the quantity coefficient", () => {
    expect(scaleFactor(40, 4, 0.8)).toBeCloseTo(8);
  });
  it("returns 0 for invalid base servings", () => {
    expect(scaleFactor(10, 0)).toBe(0);
  });
});

describe("toDisplayUnit", () => {
  it("switches to kg from 1000 g", () => {
    expect(toDisplayUnit(1500, "mass")).toEqual({ quantity: 1.5, unit: expect.objectContaining({ symbol: "kg" }) });
    expect(toDisplayUnit(999, "mass")?.unit.symbol).toBe("g");
  });
  it("does not convert 'other'", () => {
    expect(toDisplayUnit(3, "other")).toBeNull();
  });
});

describe("aggregate", () => {
  it("sums mixed mass units of the same ingredient", () => {
    const out = aggregate([
      { ingredientId: "flour", ingredientName: "Farina", quantity: 500, unit: g },
      { ingredientId: "flour", ingredientName: "Farina", quantity: 1, unit: kg },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].quantity).toBe(1.5);
    expect(out[0].unit.symbol).toBe("kg");
  });

  it("keeps incompatible dimensions and different 'other' units apart", () => {
    const out = aggregate([
      { ingredientId: "garlic", ingredientName: "Aglio", quantity: 2, unit: clove },
      { ingredientId: "garlic", ingredientName: "Aglio", quantity: 1, unit: pz },
      { ingredientId: "garlic", ingredientName: "Aglio", quantity: 10, unit: g },
      { ingredientId: "milk", ingredientName: "Latte", quantity: 200, unit: ml },
    ]);
    expect(out.map((l) => `${l.ingredientName} ${l.quantity} ${l.unit.symbol}`).sort()).toEqual([
      "Aglio 1 pz",
      "Aglio 10 g",
      "Aglio 2 spicchio",
      "Latte 200 ml",
    ]);
  });
});

describe("formatQuantity", () => {
  it("uses Italian decimals", () => {
    expect(formatQuantity(1.5, kg)).toBe("1,5 kg");
  });
  it("hides the number for q.b.", () => {
    expect(formatQuantity(3, { id: "unit-qb", symbol: "q.b." })).toBe("q.b.");
  });
});

describe("displayQuantity", () => {
  it("moves to a readable unit", () => {
    expect(displayQuantity(2500, g)).toBe("2,5 kg");
    expect(displayQuantity(0.25, kg)).toBe("250 g");
    expect(displayQuantity(3, pz)).toBe("3 pz");
  });
});
