import { ArrowLeft } from '@medusajs/icons';
import { Heading, Text, clx } from '@medusajs/ui';
import { Link, useParams } from 'react-router-dom';
import { Section } from '@/components/common/section';
import { useConversation } from '@/hooks/api/conversations';
import { formatDateTime } from '@/lib/format';

/** A conversation as both people saw it, for a dispute or a report. */
export const ConversationDetail = () => {
  const { id = '' } = useParams();
  const { data, isLoading, error } = useConversation(id);
  if (isLoading) return <Text size="small">Chargement…</Text>;
  if (error || !data) return <Text size="small">{error?.message ?? 'Conversation introuvable.'}</Text>;
  const { conversation: c, urls } = data;
  const messages = [...c.messages].sort((a, b) => a.created_at.localeCompare(b.created_at));
  return (
    <>
      <Link to={`/missions/${c.mission_id}`} className="flex items-center gap-x-1 txt-compact-small text-ui-fg-subtle hover:text-ui-fg-base">
        <ArrowLeft /> Mission
      </Link>
      <Section
        title={
          <div>
            <Heading>Conversation</Heading>
            <Text size="small" className="text-ui-fg-subtle">
              À gauche le demandeur, à droite le Traikeur.{c.reported_at ? ` Signalée le ${formatDateTime(c.reported_at)}.` : ''}
              {c.blocked_by ? ' Bloquée.' : ''}
            </Text>
          </div>
        }
      >
        <div className="flex flex-col gap-y-3 px-6 py-4">
          {messages.map((m) =>
            m.sender_id === null ? (
              <Text key={m.id} size="xsmall" className="text-center text-ui-fg-muted">
                {m.body} · {formatDateTime(m.created_at)}
              </Text>
            ) : (
              <div key={m.id} className={clx('flex max-w-[70%] flex-col gap-y-1', m.sender_id === c.member_b && 'self-end items-end')}>
                <div className={clx('rounded-lg border px-3 py-2', m.sender_id === c.member_b ? 'bg-ui-bg-base' : 'bg-ui-bg-component')}>
                  {m.file_id && urls[m.file_id] && <img src={urls[m.file_id]} alt="" className="mb-2 max-h-60 rounded-md" />}
                  {m.body && <Text size="small">{m.body}</Text>}
                </div>
                <Text size="xsmall" className="text-ui-fg-muted">
                  {formatDateTime(m.created_at)}
                </Text>
              </div>
            )
          )}
          {!messages.length && (
            <Text size="small" className="text-ui-fg-muted">
              Aucun message.
            </Text>
          )}
        </div>
      </Section>
    </>
  );
};
