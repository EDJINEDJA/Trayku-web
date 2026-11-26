import type { TraikuRequest, TraikuResponse } from '@traiku/framework/http';
import { COUNTRIES, DEFAULT_COUNTRY } from '../../../lib/countries';
import { ID_DOCUMENTS, TRADES } from '../../../lib/identity';
import { currencyOf, getPricing, regionOfCountry, regionOfMember } from '../../../lib/regions';
import { MEMBER_MODULE, type MemberModuleService } from '../../../modules/member';
import { LISTING_BRANDS, LISTING_HIDDEN, LISTING_MODELS, LISTING_SPECS } from '../../../lib/listing-specs';
import { runningAds } from '../../../lib/ads';

/**
 * What the app offers: the countries for the phone, the identity documents accepted, the trades,
 * the region (currency) with its price scale (the signed-in member's, else ?country's), and the
 * fields asked about an object to check, by kind of product, and the paid ads running now.
 */
export const GET = async (req: TraikuRequest<unknown, { country?: string }>, res: TraikuResponse) => {
  const memberId = req.auth_context?.actor_id;
  const member = memberId ? await req.scope.resolve<MemberModuleService>(MEMBER_MODULE).retrieveMember(memberId).catch(() => null) : null;
  const region = member ? await regionOfMember(req.scope, member) : await regionOfCountry(req.scope, typeof req.query.country === 'string' ? req.query.country : null);
  // Short and private: the region is the member's; a new scale reaches the apps within minutes.
  // In development, never kept: a change of the lists (listing-specs) shows at once.
  res.setHeader('Cache-Control', process.env.NODE_ENV === 'production' ? 'private, max-age=300' : 'no-store');
  res.json({
    countries: COUNTRIES,
    default_country: DEFAULT_COUNTRY,
    id_documents: ID_DOCUMENTS,
    trades: TRADES,
    // As Medusa's store: the region (null before any is created: the euro and its defaults).
    region: region ? { id: region.id, name: region.name, currency_code: region.currency_code } : null,
    currency_code: currencyOf(region),
    pricing: await getPricing(req.scope, region?.id),
    listing_specs: LISTING_SPECS,
    listing_brands: LISTING_BRANDS,
    listing_models: LISTING_MODELS,
    listing_hidden: LISTING_HIDDEN,
    ads: await runningAds(req.scope),
  });
};
