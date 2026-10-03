/** Next.js delivers repeated query keys (`?q=a&q=b`) as arrays; pages only accept one value. */
export type SearchParamValue = string | string[] | undefined;

export function firstParam(value: SearchParamValue): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
