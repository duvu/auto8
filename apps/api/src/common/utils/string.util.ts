/**
 * Trims whitespace and returns null for empty/null/undefined values.
 */
export function optionalString(value: string | null | undefined): string | null {
  return value?.trim() || null;
}
