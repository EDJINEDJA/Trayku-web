import type { TraikuRequest, TraikuResponse } from '@traiku/framework/http';
import { PAYOUT_MODULE, type PayoutModuleService } from '../../../../../modules/payout';
import { appAddress, payoutReturnSigned, payoutReturnUrl } from '../../../../utils/payouts';

const page = (text: string) =>
  `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Trayku</title><p style="font:16px system-ui;padding:24px">${text} Vous pouvez revenir dans l’app Trayku.</p>`;

/**
 * The Traikeur back from the provider's page, in the phone's browser: the account is looked at, then
 * the browser goes back into the app. `refresh`: the provider's link expired, a new one is opened.
 * Only with the address this server signed for that member.
 */
export const GET = async (req: TraikuRequest, res: TraikuResponse) => {
  const svc = req.scope.resolve<PayoutModuleService>(PAYOUT_MODULE);
  const member = String(req.query.member ?? '');
  if (!payoutReturnSigned(req.scope, member, req.query.sig)) return res.status(400).type('html').send(page('Ce lien n’est pas valide.'));
  const account = await svc.accountOf(member);
  const to = appAddress(req.query.to);
  if (account && req.query.refresh) {
    const base = `${req.protocol}://${req.get('host')}`;
    const url = await svc
      .onboardingLink(account, { return_url: payoutReturnUrl(req.scope, base, svc.provider.id, member, false, to), refresh_url: payoutReturnUrl(req.scope, base, svc.provider.id, member, true, to) })
      .catch(() => null);
    if (url) return res.redirect(303, url);
  }
  const synced = account ? await svc.syncAccount(account.id).catch(() => account) : null;
  const status = synced?.status ?? 'none';
  if (to) return res.redirect(303, `${to}${to.includes('?') ? '&' : '?'}${new URLSearchParams({ status })}`);
  res.type('html').send(page(status === 'active' ? 'Votre compte est prêt à recevoir vos gains.' : 'Votre compte n’est pas encore complet.'));
};
