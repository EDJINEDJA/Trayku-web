import { Button, Input, Label, Text, toast, usePrompt } from '@medusajs/ui';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Empty, Section, SectionRow } from '@/components/common/section';
import { Status } from '@/components/common/status';
import { useCancelMissionEarnings, useHoldPayouts, useMemberWallet, usePayMember } from '@/hooks/api/payouts';
import { EARNING_KIND, EARNING_STATUS, formatDate, formatPrice, PAYOUT_ACCOUNT, PAYOUT_STATUS } from '@/lib/format';

/**
 * A member's money, as the team needs it: their account where earnings go, what they have, the last
 * earnings (with « Annuler » for a mission whose dispute went against them) and payouts; send now,
 * or stop their transfers.
 */
export const MemberWallet = ({ memberId, firstName }: { memberId: string; firstName: string }) => {
  const { data, isLoading } = useMemberWallet(memberId);
  const pay = usePayMember();
  const hold = useHoldPayouts(memberId);
  const cancel = useCancelMissionEarnings();
  const prompt = usePrompt();
  const [reason, setReason] = useState('');
  if (isLoading || !data) return null;
  const { account, balances, earnings, payouts } = data;
  const main = balances[0];

  const send = async () => {
    const ok = await prompt({ title: `Virer à ${firstName}`, description: 'Tout son disponible part vers son compte. Ce n’est pas réversible.', confirmText: 'Virer', cancelText: 'Annuler' });
    if (ok) pay.mutate(memberId, { onSuccess: () => toast.success('Virement envoyé.'), onError: (e) => toast.error(e.message) });
  };
  const cancelMission = async (missionId: string, title: string | null) => {
    const ok = await prompt({
      title: 'Annuler ce gain',
      description: `Le gain de « ${title ?? 'la mission'} » ne sera pas versé, par exemple après un litige tranché contre le Traikeur. Un gain déjà versé ne change pas.`,
      confirmText: 'Annuler le gain',
      cancelText: 'Garder',
      variant: 'danger',
    });
    if (ok) cancel.mutate(missionId, { onSuccess: (r) => toast.success(r.canceled ? 'Gain annulé.' : 'Rien à annuler.'), onError: (e) => toast.error(e.message) });
  };

  return (
    <Section title="Cagnotte et virements">
      <SectionRow label="Compte de versement" value={<Status {...PAYOUT_ACCOUNT[account.status]} label={`${PAYOUT_ACCOUNT[account.status].label}${account.bank_last4 ? ` · •••• ${account.bank_last4}` : ''}`} />} />
      {account.currently_due.length > 0 && <SectionRow label="Demandé par le prestataire" value={account.currently_due.join(', ')} />}
      <SectionRow label="Disponible" value={main ? formatPrice(main.available, main.currency_code) : '—'} />
      <SectionRow label="En attente" value={main ? formatPrice(main.pending, main.currency_code) : '—'} />
      <SectionRow label="Déjà versé" value={main ? formatPrice(main.paid, main.currency_code) : '—'} />
      <div className="flex flex-col gap-y-3 px-6 py-4">
        {account.hold ? (
          <>
            <Text size="small" className="text-ui-fg-subtle">
              Virements suspendus{account.hold_reason ? `, ${account.hold_reason}` : ''}.
            </Text>
            <div>
              <Button size="small" variant="secondary" isLoading={hold.isPending} onClick={() => hold.mutate({ hold: false }, { onSuccess: () => toast.success('Virements autorisés.'), onError: (e) => toast.error(e.message) })}>
                Autoriser les virements
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="flex gap-x-2">
              <Button size="small" variant="secondary" onClick={send} isLoading={pay.isPending} disabled={!main?.available || account.status !== 'active'}>
                Virer le disponible
              </Button>
            </div>
            {account.status !== 'none' && (
              <div className="flex items-end gap-x-2">
                <div className="flex flex-1 flex-col gap-y-1">
                  <Label htmlFor="hold-reason" size="small">
                    Raison de la suspension
                  </Label>
                  <Input id="hold-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Litige en cours, vérification…" />
                </div>
                <Button
                  size="small"
                  variant="danger"
                  disabled={!reason.trim()}
                  isLoading={hold.isPending}
                  onClick={() => hold.mutate({ hold: true, reason: reason.trim() }, { onSuccess: () => (setReason(''), toast.success('Virements suspendus.')), onError: (e) => toast.error(e.message) })}
                >
                  Suspendre
                </Button>
              </div>
            )}
          </>
        )}
      </div>
      <div className="px-6 py-4">
        <Text size="small" weight="plus" className="mb-2">
          Derniers gains
        </Text>
        {earnings.length ? (
          <div className="flex flex-col divide-y">
            {earnings.slice(0, 10).map((e) => (
              <div key={e.id} className="flex items-center justify-between gap-x-3 py-2">
                <div className="min-w-0">
                  <Link to={`/missions/${e.mission_id}`} className="txt-compact-small text-ui-fg-interactive">
                    {e.title ?? e.mission_id}
                  </Link>
                  <Text size="xsmall" className="text-ui-fg-muted">
                    {EARNING_KIND[e.kind] ?? e.kind} · {formatDate(e.created_at)}
                  </Text>
                </div>
                <div className="flex shrink-0 items-center gap-x-3">
                  <Status {...(EARNING_STATUS[e.status] ?? { label: e.status, tone: 'neutral' })} />
                  <span className="txt-compact-small-plus">{formatPrice(e.amount, e.currency_code)}</span>
                  {e.status !== 'paid' && (
                    <Button size="small" variant="transparent" onClick={() => cancelMission(e.mission_id, e.title)}>
                      Annuler
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <Empty>Pas encore de gain.</Empty>
        )}
      </div>
      <div className="px-6 py-4">
        <Text size="small" weight="plus" className="mb-2">
          Virements
        </Text>
        {payouts.length ? (
          <div className="flex flex-col divide-y">
            {payouts.slice(0, 10).map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-x-3 py-2">
                <Text size="xsmall" className="text-ui-fg-subtle">
                  {formatDate(p.created_at)} · {p.by_team ? 'par l’équipe' : 'demandé'}
                  {p.error ? ` · ${p.error}` : ''}
                </Text>
                <div className="flex shrink-0 items-center gap-x-3">
                  <Status {...(PAYOUT_STATUS[p.status] ?? { label: p.status, tone: 'neutral' })} />
                  <span className="txt-compact-small-plus">{formatPrice(p.amount, p.currency_code)}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <Empty>Aucun virement.</Empty>
        )}
      </div>
    </Section>
  );
};
