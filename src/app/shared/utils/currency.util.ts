// Falls back to the raw currency code for anything beyond PEN/USD, so an unmapped
// currency still renders something meaningful instead of a wrong hardcoded symbol.
export function getCurrencySymbol(currency: string): string {
  if (currency === 'PEN') return 'S/';
  if (currency === 'USD') return 'US$';
  return currency;
}
