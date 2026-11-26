import { Button, Heading, Input, Label, Tabs, Text, toast, usePrompt } from '@medusajs/ui';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ListTable, type Column } from '@/components/common/list-table';
import { Section } from '@/components/common/section';
import { Status } from '@/components/common/status';
import { useListParams } from '@/components/common/use-page';
import { downloadPayouts, useBalances, usePayMember, usePayouts, useRetryPayout } from '@/hooks/api/payouts';
import { formatDateTime, formatPrice, PAYOUT_ACCOUNT, PAYOUT_STATUS } from '@/lib/format';
import type { AdminBalance, AdminPayout, Payee } from '@/lib/types';

const PAGE = 20;
const TABS = [
  { value: 'due', label: 'À verser' },
  { value: 'failed', label: 'Échoués' },
  { value: 'all', label: 'Tous les virements' },
];

const name = (m: Payee | null) => (m ? [m.first_name, m.last_name].filter(Boolean).join(' ') : '—');
const MemberLink = ({ m }: { m: Payee | null }) =>
  m ? (
    <Link to={`/members/${m.id}`} className="text-ui-fg-interactive" onClick={(e) => e.stopPropagation()}>
      {name(m)}
    </Link>
  ) : (
    '—'
  );

/** What is owed: per member, what is available (sent on their request, or by the team here) and what waits. */
const Balances = () => {
  const { page, setPage } = useListParams();
  const { data, isLoading } = useBalances({ limit: PAGE, offset: page * PAGE });
  const pay = usePayMember();
  const prompt = usePrompt();
  const send = async (b: AdminBalance) => {
    const ok = await prompt({
      title: `Virer ${formatPrice(b.available, b.currency_code)} à ${name(b.member)}`,
      description: b.member?.tax_info ? 'Tout son disponible part vers son compte. Ce n’est pas réversible.' : 'Ses informations fiscales manquent (DAC7). Tout son disponible part quand même vers son compte. Ce n’est pas réversible.',
      confirmText: 'Virer',
      cancelText: 'Annuler',
    });
    if (!ok) return;
    pay.mutate(b.member_id, {
      onSuccess: (r) => (r.payouts.some((p) => p.status === 'failed') ? toast.error(`Virement refusé par le fournisseur : ${r.payouts.find((p) => p.error)?.error ?? ''}`) : toast.success('Virement envoyé.')),
      onError: (e) => toast.error(e.message),
    });
  };
  const columns: Column<AdminBalance & { id: string }>[] = [
    { key: 'member', header: 'Traikeur', render: (b) => <MemberLink m={b.member} /> },
    { key: 'available', header: 'Disponible', render: (b) => <span className="txt-compact-small-plus">{formatPrice(b.available, b.currency_code)}</span> },
    { key: 'pending', header: 'En attente', render: (b) => formatPrice(b.pending, b.currency_code) },
    {
      key: 'account',
      header: 'Compte',
      render: (b) =>
        b.account?.hold ? (
          <Status label="Suspendu" tone="red" />
        ) : (
          <Status {...(PAYOUT_ACCOUNT[b.account?.status ?? 'none'] ?? PAYOUT_ACCOUNT.none)} label={`${PAYOUT_ACCOUNT[b.account?.status ?? 'none'].label}${b.account?.bank_last4 ? ` · •••• ${b.account.bank_last4}` : ''}`} />
        ),
    },
    { key: 'tax', header: 'Fiscal', render: (b) => (b.member?.tax_info ? 'Renseigné' : <Status label="Manquant" tone="orange" />) },
    {
      key: 'action',
      header: '',
      render: (b) =>
        b.available > 0 && b.account?.status === 'active' && !b.account.hold ? (
          <Button size="small" variant="secondary" onClick={() => send(b)} isLoading={pay.isPending && pay.variables === b.member_id}>
            Virer
          </Button>
        ) : null,
    },
  ];
  const rows = (data?.balances ?? []).map((b) => ({ ...b, id: `${b.member_id}:${b.currency_code}` }));
  return <ListTable columns={columns} rows={rows} count={data?.count ?? 0} pageSize={PAGE} pageIndex={page} onPageChange={setPage} empty="Rien à verser." loading={isLoading} />;
};

/** The payouts sent, failed ones first to read: the provider's reason, and « Relancer ». */
const Payouts = ({ status }: { status: string }) => {
  const { page, setPage } = useListParams();
  const { data, isLoading } = usePayouts({ status, limit: PAGE, offset: page * PAGE });
  const retry = useRetryPayout();
  const columns: Column<AdminPayout>[] = [
    { key: 'member', header: 'Traikeur', render: (p) => <MemberLink m={p.member} /> },
    { key: 'amount', header: 'Montant', render: (p) => <span className="txt-compact-small-plus">{formatPrice(p.amount, p.currency_code)}</span> },
    { key: 'status', header: 'Statut', render: (p) => <Status {...(PAYOUT_STATUS[p.status] ?? { label: p.status, tone: 'neutral' })} /> },
    { key: 'by', header: 'Demandé par', render: (p) => (p.by_team ? 'L’équipe' : 'Le Traikeur') },
    { key: 'at', header: 'Le', render: (p) => formatDateTime(p.created_at) },
    { key: 'ref', header: 'Référence', render: (p) => <span className="txt-compact-xsmall text-ui-fg-subtle">{p.external_id ?? p.error ?? '—'}</span> },
    {
      key: 'action',
      header: '',
      render: (p) =>
        p.status === 'failed' ? (
          <Button
            size="small"
            variant="secondary"
            isLoading={retry.isPending && retry.variables === p.id}
            onClick={() => retry.mutate(p.id, { onSuccess: () => toast.success('Virement relancé.'), onError: (e) => toast.error(e.message) })}
          >
            Relancer
          </Button>
        ) : null,
    },
  ];
  return <ListTable columns={columns} rows={data?.payouts ?? []} count={data?.count ?? 0} pageSize={PAGE} pageIndex={page} onPageChange={setPage} empty="Aucun virement ici." loading={isLoading} />;
};

/** The payouts of a period, as a CSV for the accounts. */
const Export = () => {
  const today = new Date().toISOString().slice(0, 10);
  const [from, setFrom] = useState(`${today.slice(0, 7)}-01`);
  const [to, setTo] = useState(today);
  const [busy, setBusy] = useState(false);
  const go = async () => {
    setBusy(true);
    try {
      await downloadPayouts(from, to);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex flex-wrap items-end gap-3 px-6 py-4">
      <div className="flex flex-col gap-y-1">
        <Label htmlFor="from" size="small">
          Du
        </Label>
        <Input id="from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
      </div>
      <div className="flex flex-col gap-y-1">
        <Label htmlFor="to" size="small">
          Au
        </Label>
        <Input id="to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
      </div>
      <Button size="small" variant="secondary" onClick={go} isLoading={busy} disabled={!from || !to || from > to}>
        Exporter en CSV
      </Button>
    </div>
  );
};

export const PayoutList = () => {
  const { tab, setTab } = useListParams({ tab: 'due' });
  const { data } = usePayouts({ status: 'failed', limit: 1, offset: 0 });
  return (
    <div className="flex flex-col gap-y-3">
      <Section
        title={
          <div>
            <Heading>Virements</Heading>
            <Text size="small" className="text-ui-fg-subtle">
              Les gains sont disponibles 48 h après la mission, sauf litige ouvert. Le Traikeur les retire depuis l’app, ou l’équipe les vire ici.
              {data?.mode === 'test' && ' Mode test, aucun argent réel ne circule.'}
            </Text>
          </div>
        }
      >
        <div className="px-6 py-4">
          <Tabs value={tab} onValueChange={setTab}>
            <Tabs.List>
              {TABS.map((t) => (
                <Tabs.Trigger key={t.value} value={t.value}>
                  {t.value === 'failed' && data?.count ? `${t.label} (${data.count})` : t.label}
                </Tabs.Trigger>
              ))}
            </Tabs.List>
          </Tabs>
        </div>
        {tab === 'due' ? <Balances /> : <Payouts status={tab === 'failed' ? 'failed' : 'all'} />}
      </Section>
      <Section title="Export comptable">
        <Export />
      </Section>
    </div>
  );
};
