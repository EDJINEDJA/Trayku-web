/** The inspection report (a json the app writes): its photos are files sent with /app/uploads. */

/** The file ids anywhere in a report (its photos, step by step). */
export function reportFileIds(v: unknown, out: string[] = [], depth = 0): string[] {
  if (!v || typeof v !== 'object' || depth > 6) return out;
  if (Array.isArray(v)) v.forEach((x) => reportFileIds(x, out, depth + 1));
  else {
    const o = v as Record<string, unknown>;
    if (typeof o.file_id === 'string') out.push(o.file_id);
    Object.values(o).forEach((x) => reportFileIds(x, out, depth + 1));
  }
  return out;
}

