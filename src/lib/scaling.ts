/** Multiplier that turns a recipe's base quantities into quantities for `guests`. */
export function scaleFactor(guests: number, baseServings: number, coefficient = 1): number {
  if (baseServings <= 0) return 0;
  return (guests / baseServings) * coefficient;
}
