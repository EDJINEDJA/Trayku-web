import { TraikuError } from '@traiku/framework';
import type { AuthenticatedTraikuRequest, TraikuResponse } from '@traiku/framework/http';
import { retrieveRegion } from '../../../../lib/regions';
import { deleteRegionsWorkflow, updateRegionsWorkflow } from '../../../../workflows/regions';
import type { Infer, UpdateRegion } from '../../../utils/validators';

const found = async (req: AuthenticatedTraikuRequest<unknown>) => {
  const region = await retrieveRegion(req.scope, String(req.params.id));
  if (!region) throw new TraikuError(TraikuError.Types.NOT_FOUND, 'Région introuvable.');
  return region;
};

export const GET = async (req: AuthenticatedTraikuRequest, res: TraikuResponse) => {
  res.json({ region: await found(req) });
};

/** Its name, currency, countries or metadata, as Medusa's POST /admin/regions/:id. */
export const POST = async (req: AuthenticatedTraikuRequest<Infer<typeof UpdateRegion>>, res: TraikuResponse) => {
  const region = await found(req);
  await updateRegionsWorkflow(req.scope).run({ input: { id: region.id, update: req.validatedBody } });
  res.json({ region: await retrieveRegion(req.scope, region.id) });
};

/** As Medusa's DELETE /admin/regions/:id: its countries fall back on France's region; its missions keep their prices. */
export const DELETE = async (req: AuthenticatedTraikuRequest, res: TraikuResponse) => {
  const region = await found(req);
  await deleteRegionsWorkflow(req.scope).run({ input: { ids: [region.id] } });
  res.json({ id: region.id, object: 'region', deleted: true });
};
