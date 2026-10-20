/** Preserve zero and decimal bounds; malformed URLs must not silently widen a search. */
export function priceBound(value: string | null): number | undefined {
  if (value === null || value.trim() === '') return undefined;
  const text = value.trim();
  if (text.length > 40 || !/^[0-9]+(?:\.[0-9]+)?$/.test(text)) return NaN;
  const number = Number(text);
  return Number.isFinite(number) && number <= 1_000_000 ? number : NaN;
}
export function priceFilterError(min?: number, max?: number): string {
  if ((min !== undefined && !Number.isFinite(min)) || (max !== undefined && !Number.isFinite(max))) return 'Please use a valid price between ₹0 and ₹10,00,000.';
  return min !== undefined && max !== undefined && min > max ? 'Minimum price must not exceed maximum price.' : '';
}
