/** Match the iPhone's decimal separator; grouping, exponents and ambiguous formats are rejected. */
export function nativeAmountText(value: string, separator: unknown): string {
  if (separator !== '.' && separator !== ',') throw new Error('Unsupported decimal separator.');
  const pattern = separator === ',' ? /^\d+(?:,\d+)?$/ : /^\d+(?:\.\d+)?$/;
  if (!pattern.test(value)) throw new Error('Enter a valid amount using your iPhone’s decimal separator.');
  return value.replace(',', '.');
}
