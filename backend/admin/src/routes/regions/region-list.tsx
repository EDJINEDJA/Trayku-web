import { Button, Drawer, Heading, Text, toast } from '@medusajs/ui';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ListTable, type Column } from '@/components/common/list-table';
import { Section } from '@/components/common/section';
import { useCreateRegion, useRegions } from '@/hooks/api/regions';
import type { Region } from '@/lib/types';
import { AREAS, RegionForm } from './region-form';

/** Paramètres, Régions, as Medusa's: each region, its currency and countries; a click opens it. */
export const RegionList = () => {
  const { data, isLoading } = useRegions();
  const create = useCreateRegion();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const columns: Column<Region>[] = [
    { key: 'name', header: 'Région', render: (r) => r.name },
    { key: 'area', header: 'Zone', render: (r) => (r.metadata?.area ? AREAS[r.metadata.area] : '—') },
    { key: 'currency', header: 'Devise', render: (r) => r.currency_code },
    { key: 'countries', header: 'Pays', render: (r) => (r.countries.length > 4 ? `${r.countries.slice(0, 4).join(', ')} et ${r.countries.length - 4} autres` : r.countries.join(', ') || '—') },
  ];
  // Grouped by area, as the selector of Tarifs.
  const rows = [...(data?.regions ?? [])].sort((a, b) => (a.metadata?.area ?? 'z').localeCompare(b.metadata?.area ?? 'z') || a.name.localeCompare(b.name));
  return (
    <Section
      title={
        <div>
          <Heading>Régions</Heading>
          <Text size="small" className="text-ui-fg-subtle">
            Une région a sa devise, ses pays et ses tarifs. Un membre est dans la région du pays de son téléphone ; un pays sans région suit celle de la France.
          </Text>
        </div>
      }
      actions={
        <Drawer open={open} onOpenChange={setOpen}>
          <Drawer.Trigger asChild>
            <Button size="small" variant="secondary">
              Créer une région
            </Button>
          </Drawer.Trigger>
          <Drawer.Content className="max-w-2xl">
            <Drawer.Header>
              <Drawer.Title>Créer une région</Drawer.Title>
            </Drawer.Header>
            <Drawer.Body className="overflow-y-auto">
              <RegionForm
                saving={create.isPending}
                onSubmit={(body) =>
                  create.mutate(body, {
                    onSuccess: ({ region }) => (setOpen(false), toast.success('Région créée : réglez ses tarifs.'), navigate(`/settings/regions/${region.id}`)),
                    onError: (e) => toast.error(e.message),
                  })
                }
              />
            </Drawer.Body>
          </Drawer.Content>
        </Drawer>
      }
    >
      <ListTable
        columns={columns}
        rows={rows}
        count={rows.length}
        pageSize={rows.length || 1}
        pageIndex={0}
        onPageChange={() => {}}
        onRowClick={(r) => navigate(`/settings/regions/${r.id}`)}
        empty="Aucune région."
        loading={isLoading}
      />
    </Section>
  );
};
