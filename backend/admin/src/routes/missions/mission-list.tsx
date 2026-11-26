import { Heading, Input, Tabs, Text } from '@medusajs/ui';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ListTable, type Column } from '@/components/common/list-table';
import { Section } from '@/components/common/section';
import { Status } from '@/components/common/status';
import { useListParams } from '@/components/common/use-page';
import { useMissions } from '@/hooks/api/missions';
import { CATEGORY, formatDateTime, formatPrice, MISSION_STATUS } from '@/lib/format';
import type { Mission } from '@/lib/types';

const PAGE = 20;
const TABS = [
  { value: 'review', label: 'À valider' },
  { value: 'open', label: 'Ouvertes' },
  { value: 'accepted', label: 'Acceptées' },
  { value: 'picked_up', label: 'En route' },
  { value: 'delivered', label: 'Terminées' },
  { value: 'cancelled', label: 'Annulées' },
  { value: 'all', label: 'Toutes' },
];

const columns: Column<Mission>[] = [
  {
    key: 'title',
    header: 'Mission',
    render: (m) => (
      <div className="flex flex-col">
        <span className="txt-compact-small-plus">{m.title}</span>
        <span className="txt-compact-xsmall text-ui-fg-muted">{CATEGORY[m.category] ?? m.category}</span>
      </div>
    ),
  },
  { key: 'requester', header: 'Demandeur', render: (m) => m.requester?.first_name ?? '—' },
  { key: 'place', header: 'Lieu', render: (m) => m.pickup.city ?? m.pickup.label },
  { key: 'price', header: 'Prix', render: (m) => formatPrice(m.price, m.currency_code) },
  { key: 'deadline', header: 'Échéance', render: (m) => formatDateTime(m.deadline) },
  { key: 'status', header: 'Statut', render: (m) => <Status {...(MISSION_STATUS[m.status] ?? { label: m.status, tone: 'neutral' })} /> },
];

export const MissionList = () => {
  const navigate = useNavigate();
  const { page, tab, q, setPage, setTab, setQ } = useListParams({ tab: 'review' });
  const [search, setSearch] = useState(q);
  useEffect(() => {
    const t = setTimeout(() => search !== q && setQ(search), 300);
    return () => clearTimeout(t);
  }, [search, q, setQ]);
  const { data, isLoading } = useMissions({ status: tab === 'all' ? undefined : tab, q, limit: PAGE, offset: page * PAGE });

  return (
    <Section
      title={
        <div>
          <Heading>Missions</Heading>
          <Text size="small" className="text-ui-fg-subtle">
            Les titres libres attendent votre validation avant d’être visibles.
          </Text>
        </div>
      }
    >
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
          <Input size="small" type="search" placeholder="Rechercher un titre" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>
      <ListTable
        columns={columns}
        rows={data?.missions ?? []}
        count={data?.count ?? 0}
        pageSize={PAGE}
        pageIndex={page}
        onPageChange={setPage}
        onRowClick={(m) => navigate(`/missions/${m.id}`)}
        empty="Aucune mission ici."
        loading={isLoading}
      />
    </Section>
  );
};
