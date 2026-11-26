import { Button, Drawer, Heading, Label, Switch, Text, Textarea, toast } from '@medusajs/ui';
import { useState } from 'react';
import { ListTable, type Column } from '@/components/common/list-table';
import { Section } from '@/components/common/section';
import { Status } from '@/components/common/status';
import { useAnswerSupport, useSupportRequests } from '@/hooks/api/support';
import { formatDateTime, type Tone } from '@/lib/format';
import type { AdminSupportRequest } from '@/lib/types';

const TOPIC: Record<AdminSupportRequest['topic'], string> = {
  mission: 'Une mission',
  payment: 'Paiement et cagnotte',
  account: 'Mon compte',
  safety: 'Sécurité',
  other: 'Autre',
};
const STATE: Record<AdminSupportRequest['status'], { label: string; tone: Tone }> = {
  open: { label: 'À répondre', tone: 'orange' },
  answered: { label: 'Répondue', tone: 'green' },
  closed: { label: 'Close', tone: 'neutral' },
};

/** A question, and the answer sent to the member (shown in the app, under « Aide et support »). */
const Answer = ({ request, trigger }: { request: AdminSupportRequest; trigger: React.ReactNode }) => {
  const answer = useAnswerSupport();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(request.answer ?? '');
  const [close, setClose] = useState(false);
  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <Drawer.Trigger asChild>{trigger}</Drawer.Trigger>
      <Drawer.Content>
        <Drawer.Header>
          <Drawer.Title>{TOPIC[request.topic]}</Drawer.Title>
        </Drawer.Header>
        <Drawer.Body className="flex flex-col gap-y-4">
          <div>
            <Text size="small" className="text-ui-fg-subtle">
              {request.member?.first_name ?? 'Un membre'}, le {formatDateTime(request.created_at)}
            </Text>
            <Text className="mt-1 whitespace-pre-wrap">{request.message}</Text>
          </div>
          <div className="flex flex-col gap-y-1">
            <Label htmlFor="answer" size="small">
              Votre réponse
            </Label>
            <Textarea id="answer" rows={6} value={text} onChange={(e) => setText(e.target.value)} />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="close" size="small">
              Clore la demande
            </Label>
            <Switch id="close" checked={close} onCheckedChange={setClose} />
          </div>
        </Drawer.Body>
        <Drawer.Footer>
          <Drawer.Close asChild>
            <Button size="small" variant="secondary">
              Annuler
            </Button>
          </Drawer.Close>
          <Button
            size="small"
            disabled={!text.trim()}
            isLoading={answer.isPending}
            onClick={() =>
              answer.mutate(
                { id: request.id, answer: text, close },
                {
                  onSuccess: () => {
                    toast.success('Réponse envoyée.');
                    setOpen(false);
                  },
                  onError: (e) => toast.error(e.message),
                }
              )
            }
          >
            Envoyer
          </Button>
        </Drawer.Footer>
      </Drawer.Content>
    </Drawer>
  );
};

/** Support: the members' questions from the app, the open ones first. */
export const SupportList = () => {
  const { data, isLoading } = useSupportRequests();
  const columns: Column<AdminSupportRequest>[] = [
    { key: 'topic', header: 'Sujet', render: (r) => <span className="txt-compact-small-plus">{TOPIC[r.topic]}</span> },
    { key: 'member', header: 'Membre', render: (r) => r.member?.first_name ?? '—' },
    { key: 'message', header: 'Message', render: (r) => <span className="line-clamp-2 max-w-md">{r.message}</span> },
    { key: 'at', header: 'Le', render: (r) => formatDateTime(r.created_at) },
    { key: 'status', header: 'Statut', render: (r) => <Status {...STATE[r.status]} /> },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (r) => (
        <Answer
          request={r}
          trigger={
            <Button size="small" variant="transparent">
              {r.status === 'open' ? 'Répondre' : 'Voir'}
            </Button>
          }
        />
      ),
    },
  ];
  const rows = data?.requests ?? [];
  return (
    <Section
      title={
        <div>
          <Heading>Support</Heading>
          <Text size="small" className="text-ui-fg-subtle">
            Les questions envoyées depuis « Aide et support » dans l’app. La réponse s’affiche au membre dans l’app.
          </Text>
        </div>
      }
    >
      <ListTable columns={columns} rows={rows} count={rows.length} pageSize={Math.max(rows.length, 1)} pageIndex={0} onPageChange={() => {}} empty="Aucune question." loading={isLoading} />
    </Section>
  );
};
