import { Button, Code, Copy, Drawer, Heading, Input, Label, Select, Text, toast, usePrompt } from '@medusajs/ui';
import { useState } from 'react';
import { ListTable, type Column } from '@/components/common/list-table';
import { Section } from '@/components/common/section';
import { Status } from '@/components/common/status';
import { useApiKeys, useCreateApiKey, useRevokeApiKey } from '@/hooks/api/api-keys';
import { formatDateTime } from '@/lib/format';
import type { ApiKey } from '@/lib/types';

/** A new key: the publishable one goes in the apps; the secret one is shown once, for a server. */
const CreateKey = () => {
  const create = useCreateApiKey();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [type, setType] = useState<ApiKey['type']>('publishable');
  const [created, setCreated] = useState<ApiKey | null>(null);
  const close = (o: boolean) => {
    setOpen(o);
    if (!o) {
      setCreated(null);
      setTitle('');
    }
  };
  const submit = () => create.mutate({ title, type }, { onSuccess: ({ api_key }) => setCreated(api_key), onError: (e) => toast.error(e.message) });
  return (
    <Drawer open={open} onOpenChange={close}>
      <Drawer.Trigger asChild>
        <Button size="small" variant="secondary">
          Créer une clé
        </Button>
      </Drawer.Trigger>
      <Drawer.Content>
        <Drawer.Header>
          <Drawer.Title>Créer une clé</Drawer.Title>
        </Drawer.Header>
        <Drawer.Body className="flex flex-col gap-y-4">
          {created ? (
            <>
              <Text size="small">{created.type === 'secret' ? 'Copiez la clé maintenant : elle ne sera plus affichée.' : 'Copiez la clé dans la configuration de l’app.'}</Text>
              <div className="flex items-center gap-x-2">
                <Code className="break-all">{created.token}</Code>
                <Copy content={created.token} />
              </div>
            </>
          ) : (
            <>
              <div className="flex flex-col gap-y-1">
                <Label htmlFor="title" size="small">
                  Nom
                </Label>
                <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="App mobile, site principal…" />
              </div>
              <div className="flex flex-col gap-y-1">
                <Label size="small">Type</Label>
                <Select value={type} onValueChange={(v) => setType(v as ApiKey['type'])}>
                  <Select.Trigger>
                    <Select.Value />
                  </Select.Trigger>
                  <Select.Content>
                    <Select.Item value="publishable">Publique, pour les apps</Select.Item>
                    <Select.Item value="secret">Secrète, pour un serveur</Select.Item>
                  </Select.Content>
                </Select>
              </div>
            </>
          )}
        </Drawer.Body>
        <Drawer.Footer>
          <Drawer.Close asChild>
            <Button size="small" variant="secondary">
              {created ? 'Fermer' : 'Annuler'}
            </Button>
          </Drawer.Close>
          {!created && (
            <Button size="small" onClick={submit} disabled={!title.trim()} isLoading={create.isPending}>
              Créer
            </Button>
          )}
        </Drawer.Footer>
      </Drawer.Content>
    </Drawer>
  );
};

export const ApiKeyList = () => {
  const { data, isLoading } = useApiKeys();
  const revoke = useRevokeApiKey();
  const prompt = usePrompt();
  const onRevoke = async (k: ApiKey) => {
    const ok = await prompt({
      title: `Révoquer « ${k.title} »`,
      description: 'Les apps ou serveurs qui l’utilisent seront refusés dans la minute. Ce n’est pas réversible.',
      confirmText: 'Révoquer',
      cancelText: 'Annuler',
      variant: 'danger',
    });
    if (ok) revoke.mutate(k.id, { onSuccess: () => toast.success('Clé révoquée.'), onError: (e) => toast.error(e.message) });
  };
  const columns: Column<ApiKey>[] = [
    { key: 'title', header: 'Nom', render: (k) => <span className="txt-compact-small-plus">{k.title}</span> },
    { key: 'type', header: 'Type', render: (k) => (k.type === 'publishable' ? 'Publique' : 'Secrète') },
    {
      key: 'token',
      header: 'Clé',
      render: (k) => (
        <span className="flex items-center gap-x-1">
          <Code>{k.type === 'publishable' ? `${k.token.slice(0, 12)}…` : k.redacted}</Code>
          {k.type === 'publishable' && <Copy content={k.token} />}
        </span>
      ),
    },
    { key: 'used', header: 'Dernière utilisation', render: (k) => (k.type === 'secret' ? formatDateTime(k.last_used_at) : '—') },
    { key: 'status', header: 'Statut', render: (k) => <Status {...(k.revoked_at ? { label: 'Révoquée', tone: 'neutral' as const } : { label: 'Active', tone: 'green' as const })} /> },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (k) =>
        !k.revoked_at && (
          <Button size="small" variant="transparent" onClick={() => onRevoke(k)}>
            Révoquer
          </Button>
        ),
    },
  ];
  const keys = data?.api_keys ?? [];
  return (
    <Section
      title={
        <div>
          <Heading>Clés API</Heading>
          <Text size="small" className="text-ui-fg-subtle">
            La clé publique identifie l’app mobile dans l’en-tête x-publishable-api-key. La clé secrète donne un accès complet à un serveur.
          </Text>
        </div>
      }
      actions={<CreateKey />}
    >
      <ListTable columns={columns} rows={keys} count={keys.length} pageSize={Math.max(keys.length, 1)} pageIndex={0} onPageChange={() => {}} empty="Aucune clé." loading={isLoading} />
    </Section>
  );
};
