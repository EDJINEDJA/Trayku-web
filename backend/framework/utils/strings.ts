export const toPascalCase = (s: string) => s.replace(/(^|[_\-\s]+)([a-z0-9])/gi, (_, __, c: string) => c.toUpperCase());
export const toCamelCase = (s: string) => {
  const p = toPascalCase(s);
  return p.charAt(0).toLowerCase() + p.slice(1);
};
export const toSnakeCase = (s: string) =>
  s
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[-\s]+/g, '_')
    .toLowerCase();
export const lowerCaseFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

/** English plural, the same rules as the `Plural` type below, so generated method names match their types. */
export function pluralize(s: string): string {
  if (/[aeou]y$/i.test(s)) return s + 's';
  if (/y$/i.test(s)) return s.slice(0, -1) + 'ies';
  if (/(s|x|z|ch|sh)$/i.test(s)) return s + 'es';
  return s + 's';
}

export type Plural<K extends string> = K extends `${string}${'ay' | 'ey' | 'oy' | 'uy'}`
  ? `${K}s`
  : K extends `${infer S}y`
    ? `${S}ies`
    : K extends `${string}${'s' | 'x' | 'z' | 'ch' | 'sh'}`
      ? `${K}es`
      : `${K}s`;
