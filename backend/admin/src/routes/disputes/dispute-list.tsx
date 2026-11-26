import { Button, Drawer, Heading, Label, Select, Tabs, Text, Textarea, toast } from '@medusajs/ui';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ListTable, type Column } from '@/components/common/list-table';
import { Section, SectionRow } from '@/components/common/section';
import { Status } from '@/components/common/status';
import { useListParams } from '@/components/common/use-page';
import { useDisputes, useResolveDispute } from '@/hooks/api/disputes';
import { DISPUTE_REASON, DISPUTE_STATUS, formatDateTime } from '@/lib/format';
import type { Dispute } from '@/lib/types';

const PAGE = 20;
const TABS = [
  { value: 'open', label: 'Ouverts' },
  { value: 'resolved', label: 'Résolus' },
  { value: 'rejected', label: 'Rejetés' },
];

const columns: Column<Dispute>[] = [
  { key: 'reason', header: 'Problème', render: (d) => <span className="txt-compact-small-plus">{DISPUTE_REASON[d.reason] ?? d.reason}</span> },
  { key: 'mission', header: 'Mission', render: (d) => d.mission?.title ?? '—' },
  { key: 'by', header: 'Signalé par', render: (d) => d.opener?.first_name ?? '—' },
  { key: 'at', header: 'Le', render: (d) => formatDateTime(d.created_at) },
  { key: 'status', header: 'Statut', render: (d) => <Status {...(DISPUTE_STATUS[d.status] ?? { label: d.status, tone: 'neutral' })} /> },
];

/** A file: what was reported, a link to the mission's full record, and the answer that closes it. */
const DisputeDrawer = ({ dispute, onClose }: { dispute: Dispute; onClose: () => void }) => {
  const resolve = useResolveDispute();
  const [status, setStatus] = useState<'resolved' | 'rejected'>('resolved');
  const [resolution, setResolution] = useState('');
  const submit = () =>
    resolve.mutate(
      { id: dispute.id, status, resolution },
      {
        onSuccess: () => {
          toast.success('Dossier clos.');
          onClose();
        },
        onError: (e) => toast.error(e.message),
      }
    );
  return (
    <Drawer open onOpenChange={(o) => !o && onClose()}>
      <Drawer.Content>
        <Drawer.Header>
          <Drawer.Title>{DISPUTE_REASON[dispute.reason] ?? dispute.reason}</Drawer.Title>
        </Drawer.Header>
        <Drawer.Body className="flex flex-col gap-y-4 overflow-y-auto p-0">
          <div className="divide-y">
            <SectionRow label="Mission" value={dispute.mission ? <Link to={`/missions/${dispute.mission.id}`} className="text-ui-fg-interactive">{dispute.mission.title}</Link> : '—'} />
            <SectionRow label="Signalé par" value={dispute.opener?.first_name} />
            <SectionRow label="Le" value={formatDateTime(dispute.created_at)} />
            <SectionRow label="Message" value={dispute.message} />
            {dispute.resolution && <SectionRow label="Réponse" value={dispute.resolution} />}
          </div>
          {dispute.status === 'open' && (
            <div className="flex flex-col gap-y-3 px-6 pb-6">
              <Text size="small" className="text-ui-fg-subtle">
                Avant de répondre, lisez le dossier de la mission : historique, vérifications du visage, photos et conversation.
              </Text>
              <div className="flex flex-col gap-y-1">
                <Label size="small">Décision</Label>
                <Select value={status} onValueChange={(v) => setStatus(v as 'resolved' | 'rejected')}>
                  <Select.Trigger>
                    <Select.Value />
                  </Select.Trigger>
                  <Select.Content>
                    <Select.Item value="resolved">Résolu</Select.Item>
                    <Select.Item value="rejected">Rejeté</Select.Item>
                  </Select.Content>
                </Select>
              </div>
              <div className="flex flex-col gap-y-1">
                <Label htmlFor="resolution" size="small">
                  Réponse, envoyée aux deux personnes
                </Label>
                <Textarea id="resolution" rows={5} value={resolution} onChange={(e) => setResolution(e.target.value)} />
              </div>
            </div>
          )}
        </Drawer.Body>
        {dispute.status === 'open' && (
          <Drawer.Footer>
            <Drawer.Close asChild>
              <Button size="small" variant="secondary">
                Annuler
              </Button>
            </Drawer.Close>
            <Button size="small" onClick={submit} disabled={!resolution.trim()} isLoading={resolve.isPending}>
              Clore le dossier
            </Button>
          </Drawer.Footer>
        )}
      </Drawer.Content>
    </Drawer>
  );
};

export const DisputeList = () => {
  const { page, tab, setPage, setTab } = useListParams({ tab: 'open' });
  const { data, isLoading } = useDisputes({ status: tab, limit: PAGE, offset: page * PAGE });
  const [selected, setSelected] = useState<Dispute | null>(null);
  return (
    <Section
      title={
        <div>
          <Heading>Litiges</Heading>
          <Text size="small" className="text-ui-fg-subtle">
            Les plus anciens d’abord.
          </Text>
        </div>
      }
    >
      <div className="px-6 py-4">
        <Tabs value={tab} onValueChange={setTab}>
          <Tabs.List>
            {TABS.map((t) => (
              <Tabs.Trigger key={t.value} value={t.value}>
                {t.label}
              </Tabs.Trigger>
            ))}
          </Tabs.List>
        </Tabs>
      </div>
      <ListTable columns={columns} rows={data?.disputes ?? []} count={data?.count ?? 0} pageSize={PAGE} pageIndex={page} onPageChange={setPage} onRowClick={setSelected} empty="Aucun litige ici." loading={isLoading} />
      {selected && <DisputeDrawer dispute={selected} onClose={() => setSelected(null)} />}
    </Section>
  );
};
