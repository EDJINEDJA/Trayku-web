import type { AuthenticatedTraikuRequest, TraikuResponse } from '@traiku/framework/http';
import { PAYOUT_MODULE, type PayoutModuleService } from '../../../../modules/payout';
import { payees } from '../../../utils/admin-payouts';

/**
 * What is owed to the Traikeurs: per member and currency, what waits (a dispute, the delay) and what
 * is available, with their account's state. Most available first.
 */
export const GET = async (req: AuthenticatedTraikuRequest<unknown, { limit: number; offset: number }>, res: TraikuResponse) => {
  const svc = req.scope.resolve<PayoutModuleService>(PAYOUT_MODULE);
  const open = await svc.listEarnings({ status: ['pending', 'available'] }, { take: 20000 });
  const by = new Map<string, { member_id: string; currency_code: string; pending: number; available: number; count: number }>();
  for (const e of open) {
    const key = `${e.member_id}:${e.currency_code}`;
    const b = by.get(key) ?? { member_id: e.member_id, currency_code: e.currency_code, pending: 0, available: 0, count: 0 };
    if (e.status === 'available' && !e.payout_id) b.available += Number(e.amount);
    else b.pending += Number(e.amount);
    b.count += 1;
    by.set(key, b);
  }
  const all = [...by.values()].sort((a, b) => b.available - a.available || b.pending - a.pending);
  const page = all.slice(req.validatedQuery.offset, req.validatedQuery.offset + req.validatedQuery.limit);
  const ids = page.map((b) => b.member_id);
  const [people, accounts] = await Promise.all([payees(req.scope, ids), ids.length ? svc.listPayoutAccounts({ member_id: ids }) : Promise.resolve([])]);
  res.json({
    balances: page.map((b) => {
      const a = accounts.find((x) => x.member_id === b.member_id);
      return {
        ...b,
        pending: Number(b.pending.toFixed(2)),
        available: Number(b.available.toFixed(2)),
        member: people[b.member_id] ?? null,
        account: a ? { status: a.status, hold: a.hold, bank_last4: a.bank_last4 } : null,
      };
    }),
    count: all.length,
  });
};
