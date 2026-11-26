import type { AuthenticatedTraikuRequest, TraikuResponse } from '@traiku/framework/http';
import { PAYOUT_MODULE, type PayoutModuleService } from '../../../modules/payout';
import { payees } from '../../utils/admin-payouts';
import { payoutView } from '../../utils/payouts';

type Query = { status: 'pending' | 'paid' | 'failed' | 'canceled' | 'all'; limit: number; offset: number };

/** The payouts, newest first, with who they went to and the provider's error when one failed. */
export const GET = async (req: AuthenticatedTraikuRequest<unknown, Query>, res: TraikuResponse) => {
  const { status, limit, offset } = req.validatedQuery;
  const svc = req.scope.resolve<PayoutModuleService>(PAYOUT_MODULE);
  const [rows, count] = await svc.listAndCountPayouts(status === 'all' ? {} : { status }, { take: limit, skip: offset, order: { created_at: 'DESC' } });
  const people = await payees(
    req.scope,
    rows.map((p) => p.member_id)
  );
  res.json({ payouts: rows.map((p) => ({ ...payoutView(p), member: people[p.member_id] ?? null, external_id: p.external_id, provider_id: p.provider_id })), count, provider_id: svc.provider.id, mode: svc.provider.mode });
};
