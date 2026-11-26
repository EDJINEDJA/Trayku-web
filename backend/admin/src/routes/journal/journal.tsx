import { Heading, Text } from '@medusajs/ui';
import { useQuery } from '@tanstack/react-query';
import { ListTable, type Column } from '@/components/common/list-table';
import { Section } from '@/components/common/section';
import { useListParams } from '@/components/common/use-page';
import { api } from '@/lib/client';
import { formatDateTime } from '@/lib/format';

type Action = { id: string; actor_id: string; actor_type: string; email: string | null; method: string; path: string; status: number; ip: string | null; created_at: string };

const PAGE = 50;
const VERB: Record<string, string> = { POST: 'Modification', DELETE: 'Suppression', PUT: 'Modification', PATCH: 'Modification' };

const columns: Column<Action>[] = [
  { key: 'at', header: 'Le', render: (a) => formatDateTime(a.created_at) },
  { key: 'who', header: 'Par', render: (a) => a.email ?? (a.actor_type === 'api-key' ? 'Clé secrète' : a.actor_id) },
  { key: 'what', header: 'Action', render: (a) => VERB[a.method] ?? a.method },
  { key: 'path', header: 'Sur', render: (a) => <span className="txt-compact-small font-mono">{a.path.replace(/^\/admin/, '')}</span> },
  { key: 'ip', header: 'Depuis', render: (a) => a.ip ?? '—' },
];

/** Every change made by the team in the admin, newest first. */
export const Journal = () => {
  const { page, setPage } = useListParams();
  const { data, isLoading } = useQuery({
    queryKey: ['user-actions', page],
    queryFn: () => api<{ actions: Action[]; count: number }>('/admin/user-actions', { query: { limit: PAGE, offset: page * PAGE } }),
    placeholderData: (prev) => prev,
  });
  return (
    <Section
      title={
        <div>
          <Heading>Journal</Heading>
          <Text size="small" className="text-ui-fg-subtle">
            Chaque modification faite par l’équipe, avec qui, quand et d’où.
          </Text>
        </div>
      }
    >
      <ListTable columns={columns} rows={data?.actions ?? []} count={data?.count ?? 0} pageSize={PAGE} pageIndex={page} onPageChange={setPage} empty="Rien pour l’instant." loading={isLoading} />
    </Section>
  );
};
