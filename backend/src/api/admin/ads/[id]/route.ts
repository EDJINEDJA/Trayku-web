import { TraikuError } from '@traiku/framework';
import type { AuthenticatedTraikuRequest, TraikuResponse } from '@traiku/framework/http';
import { adminAds } from '../../../../lib/ads';
import { AD_MODULE, type AdModuleService } from '../../../../modules/ad';
import { deleteAdWorkflow, updateAdWorkflow } from '../../../../workflows/ads';
import type { Infer, UpdateAd } from '../../../utils/validators';

const found = async (req: AuthenticatedTraikuRequest<unknown>) => {
  const [ad] = await req.scope.resolve<AdModuleService>(AD_MODULE).listAds({ id: String(req.params.id) }, { take: 1 });
  if (!ad) throw new TraikuError(TraikuError.Types.NOT_FOUND, 'Publicité introuvable.');
  return ad;
};

export const GET = async (req: AuthenticatedTraikuRequest, res: TraikuResponse) => {
  const [ad] = await adminAds(req.scope, [await found(req)]);
  res.json({ ad });
};

/** Its picture, link, dates, or put on / off (`active`). */
export const POST = async (req: AuthenticatedTraikuRequest<Infer<typeof UpdateAd>>, res: TraikuResponse) => {
  const ad = await found(req);
  const { result } = await updateAdWorkflow(req.scope).run({ input: { id: ad.id, update: req.validatedBody } });
  const [out] = await adminAds(req.scope, [result]);
  res.json({ ad: out });
};

/** Removed from the app at once; its counters are kept (soft delete). */
export const DELETE = async (req: AuthenticatedTraikuRequest, res: TraikuResponse) => {
  const ad = await found(req);
  await deleteAdWorkflow(req.scope).run({ input: { id: ad.id } });
  res.json({ id: ad.id, object: 'ad', deleted: true });
};
