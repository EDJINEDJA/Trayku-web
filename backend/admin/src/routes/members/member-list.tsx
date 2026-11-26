import { Heading, Input, Tabs } from '@medusajs/ui';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ListTable, type Column } from '@/components/common/list-table';
import { Section } from '@/components/common/section';
import { Status } from '@/components/common/status';
import { useListParams } from '@/components/common/use-page';
import { useMembers } from '@/hooks/api/members';
import { formatDate, formatRating } from '@/lib/format';
import type { Member } from '@/lib/types';

const PAGE = 20;
const TABS = [
  { value: 'all', label: 'Tous' },
  { value: 'verifier_review', label: 'Certificats à vérifier' },
  { value: 'suspended', label: 'Suspendus' },
];

const columns: Column<Member>[] = [
  { key: 'name', header: 'Membre', render: (m) => <span className="txt-compact-small-plus">{[m.first_name, m.last_name].filter(Boolean).join(' ')}</span> },
  { key: 'phone', header: 'Téléphone', render: (m) => m.phone },
  { key: 'rating', header: 'Note', render: (m) => (m.rating_count ? `${formatRating(m.rating)} (${m.rating_count})` : '—') },
  { key: 'done', header: 'Missions faites', render: (m) => m.missions_done },
  { key: 'id', header: 'Identité', render: (m) => (m.verified_id ? 'Vérifiée' : 'Non vérifiée') },
  { key: 'since', header: 'Inscription', render: (m) => formatDate(m.created_at) },
  { key: 'status', header: 'Statut', render: (m) => <Status {...(m.status === 'suspended' ? { label: 'Compte suspendu', tone: 'red' as const } : { label: 'Compte actif', tone: 'green' as const })} /> },
];

export const MemberList = () => {
  const navigate = useNavigate();
  const { page, tab, q, setPage, setTab, setQ } = useListParams({ tab: 'all' });
  const [search, setSearch] = useState(q);
  useEffect(() => {
    const t = setTimeout(() => search !== q && setQ(search), 300);
    return () => clearTimeout(t);
  }, [search, q, setQ]);
  const { data, isLoading } = useMembers({ status: tab === 'all' ? undefined : tab, q, limit: PAGE, offset: page * PAGE });

  return (
    <Section title={<Heading>Membres</Heading>}>
      <div className="flex flex-col gap-y-3 px-6 py-4 md:flex-row md:items-center md:justify-between">
        <Tabs value={tab} onValueChange={setTab}>
          <Tabs.List>
            {TABS.map((t) => (
              <Tabs.Trigger key={t.value} value={t.value}>
                {t.label}
              </Tabs.Trigger>
            ))}
          </Tabs.List>
        </Tabs>
        <div className="md:w-[260px]">
          <Input size="small" type="search" placeholder="Prénom ou téléphone" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>
      <ListTable
        columns={columns}
        rows={data?.members ?? []}
        count={data?.count ?? 0}
        pageSize={PAGE}
        pageIndex={page}
        onPageChange={setPage}
        onRowClick={(m) => navigate(`/members/${m.id}`)}
        empty="Aucun membre ici."
        loading={isLoading}
      />
    </Section>
  );
};
