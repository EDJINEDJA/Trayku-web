import type { AuthenticatedTraikuRequest, TraikuResponse } from '@traiku/framework/http';
import { listRegions, retrieveRegion } from '../../../lib/regions';
import { createRegionsWorkflow } from '../../../workflows/regions';
import type { CreateRegion, Infer } from '../../utils/validators';

/** The regions with their countries, as Medusa's GET /admin/regions. */
export const GET = async (req: AuthenticatedTraikuRequest, res: TraikuResponse) => {
  const regions = await listRegions(req.scope);
  res.json({ regions, count: regions.length });
};

/** A new region, as Medusa's POST /admin/regions: its scale starts from its minimum wage. */
export const POST = async (req: AuthenticatedTraikuRequest<Infer<typeof CreateRegion>>, res: TraikuResponse) => {
  const { result } = await createRegionsWorkflow(req.scope).run({ input: { regions: [req.validatedBody] } });
  res.status(201).json({ region: await retrieveRegion(req.scope, result[0]) });
};
