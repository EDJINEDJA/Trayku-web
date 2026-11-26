import { Modules, TraikuError, type UserModuleService } from '@traiku/framework';
import type { AuthenticatedTraikuRequest, TraikuResponse } from '@traiku/framework/http';
import { AREAS, getPricing, listRegions, regionDefaults, regionOfCountry } from '../../../lib/regions';
import { PRICING_MODULE, type PricingModuleService } from '../../../modules/pricing';
import { savePriceScaleWorkflow } from '../../../workflows/pricing';
import type { Infer, SavePricing } from '../../utils/validators';

/** A region's price scale in force, its defaults, its saved versions (newest first), and the regions. */
export const GET = async (req: AuthenticatedTraikuRequest<unknown, { region_id?: string }>, res: TraikuResponse) => {
  const regions = await listRegions(req.scope);
  const asked = typeof req.query.region_id === 'string' ? req.query.region_id : null;
  const region = (asked ? regions.find((r) => r.id === asked) : await regionOfCountry(req.scope, null)) ?? regions[0];
  if (!region) throw new TraikuError(TraikuError.Types.NOT_FOUND, 'Aucune région : créez-en une dans Paramètres, Régions.');
  const versions = await req.scope.resolve<PricingModuleService>(PRICING_MODULE).listPriceScales({ region_id: region.id }, { take: 20, order: { created_at: 'DESC' }, select: ['id', 'updated_by', 'note', 'created_at'] });
  const ids = [...new Set(versions.map((v) => v.updated_by).filter((v): v is string => !!v))];
  const people = ids.length ? await req.scope.resolve<UserModuleService>(Modules.USER).listUsers({ id: ids }, { select: ['id', 'email'] }) : [];
  res.json({
    regions,
    areas: AREAS,
    region,
    pricing: await getPricing(req.scope, region.id),
    defaults: regionDefaults(region),
    history: versions.map((v) => ({ id: v.id, note: v.note, created_at: v.created_at, by: people.find((p) => p.id === v.updated_by)?.email ?? null })),
  });
};

/** Saves a new version of a region's scale: in force at once for its new missions (those published keep their prices). */
export const POST = async (req: AuthenticatedTraikuRequest<Infer<typeof SavePricing>>, res: TraikuResponse) => {
  await savePriceScaleWorkflow(req.scope).run({ input: { ...req.validatedBody, updated_by: req.auth_context.actor_id } });
  res.json({ pricing: await getPricing(req.scope, req.validatedBody.region_id) });
};
