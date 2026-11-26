import type { TraikuRequest, TraikuResponse } from '@traiku/framework/http';
import { listRegions } from '../../../lib/regions';

/** The regions and their currencies, as Medusa's GET /store/regions. */
export const GET = async (req: TraikuRequest, res: TraikuResponse) => {
  res.setHeader('Cache-Control', 'public, max-age=300');
  const regions = await listRegions(req.scope);
  res.json({ regions: regions.map(({ id, name, currency_code, countries }) => ({ id, name, currency_code, countries })), count: regions.length });
};
