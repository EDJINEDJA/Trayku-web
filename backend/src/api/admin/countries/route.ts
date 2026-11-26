import type { AuthenticatedTraikuRequest, TraikuResponse } from '@traiku/framework/http';
import { REGION_MODULE, type RegionModuleService } from '../../../modules/region';

/** The countries and the region each is in, for the region form. */
export const GET = async (req: AuthenticatedTraikuRequest, res: TraikuResponse) => {
  const countries = await req.scope.resolve<RegionModuleService>(REGION_MODULE).listCountries({}, { order: { display_name: 'ASC' } });
  res.json({ countries: countries.map((c) => ({ iso_2: c.iso_2, display_name: c.display_name, dial: c.dial, region_id: c.region_id })) });
};
