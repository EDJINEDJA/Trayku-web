import type { TraikuRequest, TraikuResponse } from '@traiku/framework/http';
import { BRAND_MODULE, brandKey, type BrandModuleService } from '../../../modules/brand';

/** Once typed by this many missions, a chain a requester wrote is offered to the others too. */
const OFFER_AFTER = 3;
const KINDS = ['store', 'relay', 'drive', 'pressing', 'other'] as const;

/** 0: the name starts with what is typed; 1: one of its words does; 2: it is only inside. */
const rank = (name: string, key: string, q: string) =>
  !q || key.startsWith(q) ? 0 : name.split(/[\s.\-'’&]+/).some((w) => brandKey(w).startsWith(q)) ? 1 : 2;

/**
 * GET /app/brands?q=ler&kind=store: the chains to offer as one types the « Enseigne », the most likely
 * first: the name starting with what is typed, then one of its words starting with it (« mer » →
 * Leroy Merlin), then the rest; within each, the most used. Without q: the most used.
 */
export const GET = async (req: TraikuRequest, res: TraikuResponse) => {
  const q = brandKey(String(req.query.q ?? '')).slice(0, 40);
  const kind = KINDS.find((k) => k === req.query.kind);
  const rows = await req.scope.resolve<BrandModuleService>(BRAND_MODULE).listBrands(
    { ...(q && { key: { $ilike: `%${q}%` } }), ...(kind && { kind }) },
    { take: 60, order: { uses: 'DESC' } }
  );
  const brands = rows
    .filter((b) => b.listed || b.uses >= OFFER_AFTER)
    .sort((a, b) => rank(a.name, a.key, q) - rank(b.name, b.key, q) || b.uses - a.uses || a.name.localeCompare(b.name, 'fr'))
    .slice(0, 8)
    .map(({ name, kind }) => ({ name, kind }));
  res.setHeader('Cache-Control', 'public, max-age=60');
  res.json({ brands });
};
