import type { AuthenticatedTraikuRequest, TraikuResponse } from '@traiku/framework/http';
import { adminAds } from '../../../lib/ads';
import { AD_MODULE, type AdModuleService } from '../../../modules/ad';
import { createAdWorkflow } from '../../../workflows/ads';
import type { CreateAd, Infer } from '../../utils/validators';

/** Every ad, the newest first, with its views, clicks and reports. */
export const GET = async (req: AuthenticatedTraikuRequest, res: TraikuResponse) => {
  const ads = await req.scope.resolve<AdModuleService>(AD_MODULE).listAds({}, { order: { created_at: 'DESC' } });
  res.json({ ads: await adminAds(req.scope, ads), count: ads.length });
};

/** A new ad: its picture sent before (POST /admin/uploads). */
export const POST = async (req: AuthenticatedTraikuRequest<Infer<typeof CreateAd>>, res: TraikuResponse) => {
  const { result } = await createAdWorkflow(req.scope).run({ input: req.validatedBody });
  const [ad] = await adminAds(req.scope, [result]);
  res.status(201).json({ ad });
};
