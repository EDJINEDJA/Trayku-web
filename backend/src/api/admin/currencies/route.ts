import type { AuthenticatedTraikuRequest, TraikuResponse } from '@traiku/framework/http';
import { CURRENCY_MODULE, type CurrencyModuleService } from '../../../modules/currency';

/** The currencies a region can use, as Medusa's GET /admin/currencies. */
export const GET = async (req: AuthenticatedTraikuRequest, res: TraikuResponse) => {
  const currencies = await req.scope.resolve<CurrencyModuleService>(CURRENCY_MODULE).listCurrencies({}, { order: { code: 'ASC' } });
  res.json({ currencies, count: currencies.length });
};
