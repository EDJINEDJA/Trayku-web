import type { AuthenticatedTraikuRequest, TraikuResponse } from '@traiku/framework/http';
import { PAYOUT_MODULE, type PayoutModuleService } from '../../../../modules/payout';
import { payees } from '../../../utils/admin-payouts';

/** A cell of the CSV: quoted, quotes doubled, and never read as a formula by a spreadsheet. */
const cell = (v: unknown) => {
  const s = v === null || v === undefined ? '' : String(v);
  return `"${(/^[=+\-@]/.test(s) ? `'${s}` : s).replace(/"/g, '""')}"`;
};

/** The payouts sent between two dates (inclusive), as a CSV for the accounts. */
export const GET = async (req: AuthenticatedTraikuRequest<unknown, { from: string; to: string }>, res: TraikuResponse) => {
  const from = new Date(`${req.validatedQuery.from}T00:00:00Z`);
  const to = new Date(`${req.validatedQuery.to}T23:59:59.999Z`);
  const svc = req.scope.resolve<PayoutModuleService>(PAYOUT_MODULE);
  const rows = await svc.listPayouts({ created_at: { $gte: from, $lte: to } }, { order: { created_at: 'ASC' }, take: 50000 });
  const people = await payees(
    req.scope,
    rows.map((p) => p.member_id)
  );
  const head = ['Date', 'Virement', 'Membre', 'Prénom', 'Nom', 'Montant', 'Devise', 'Statut', 'Référence fournisseur', 'Envoyé par l’équipe', 'Erreur'];
  const lines = rows.map((p) => {
    const m = people[p.member_id];
    return [p.created_at.toISOString(), p.id, p.member_id, m?.first_name, m?.last_name, Number(p.amount).toFixed(2), p.currency_code, p.status, p.external_id, p.created_by ? 'oui' : 'non', p.error].map(cell).join(';');
  });
  res
    .type('text/csv; charset=utf-8')
    .setHeader('Content-Disposition', `attachment; filename="virements-${req.validatedQuery.from}-${req.validatedQuery.to}.csv"`)
    .send(`﻿${[head.map(cell).join(';'), ...lines].join('\r\n')}`);
};
