import { ArrowLeft } from '@medusajs/icons';
import { Button, Drawer, Heading, Label, Text, Textarea, toast, usePrompt } from '@medusajs/ui';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Photos } from '@/components/common/photos';
import { Empty, Section, SectionRow, TwoColumnPage } from '@/components/common/section';
import { Status } from '@/components/common/status';
import { useMission, useReviewMission, useUnlockRun } from '@/hooks/api/missions';
import { CATEGORY, DISPUTE_REASON, DISPUTE_STATUS, formatDateTime, formatPrice, formatRating, MISSION_STATUS, RUN_EVENT, RUN_STATUS, RUN_STEP } from '@/lib/format';
import type { Mission, Person, Run } from '@/lib/types';

const PersonRow = ({ label, person }: { label: string; person: Person | null }) => (
  <SectionRow
    label={label}
    value={
      person ? (
        <Link to={`/members/${person.id}`} className="text-ui-fg-interactive hover:text-ui-fg-interactive-hover">
          {person.first_name} · {person.rating ? formatRating(person.rating) : 'pas encore de note'} · {person.missions_done} missions
        </Link>
      ) : (
        '—'
      )
    }
  />
);

/** The team approves a free title, or refuses it with a note the requester sees. */
const ReviewActions = ({ mission }: { mission: Mission }) => {
  const review = useReviewMission(mission.id);
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const approve = () =>
    review.mutate({ approve: true }, { onSuccess: () => toast.success('Mission validée : elle est visible des Traikeurs.'), onError: (e) => toast.error(e.message) });
  const refuse = () =>
    review.mutate(
      { approve: false, note },
      {
        onSuccess: () => {
          setOpen(false);
          toast.success('Mission refusée.');
        },
        onError: (e) => toast.error(e.message),
      }
    );
  return (
    <Section title="À valider">
      <div className="flex flex-col gap-y-3 px-6 py-4">
        <Text size="small" className="text-ui-fg-subtle">
          Ce titre a été écrit librement. Vérifiez que la mission est permise et claire avant de la publier.
        </Text>
        <div className="flex gap-x-2">
          <Button size="small" onClick={approve} isLoading={review.isPending}>
            Valider
          </Button>
          <Drawer open={open} onOpenChange={setOpen}>
            <Drawer.Trigger asChild>
              <Button size="small" variant="secondary">
                Refuser
              </Button>
            </Drawer.Trigger>
            <Drawer.Content>
              <Drawer.Header>
                <Drawer.Title>Refuser la mission</Drawer.Title>
              </Drawer.Header>
              <Drawer.Body className="flex flex-col gap-y-2">
                <Label htmlFor="note" size="small">
                  Raison, envoyée au demandeur
                </Label>
                <Textarea id="note" rows={5} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Par exemple : le transport d’animaux n’est pas permis." />
              </Drawer.Body>
              <Drawer.Footer>
                <Drawer.Close asChild>
                  <Button size="small" variant="secondary">
                    Annuler
                  </Button>
                </Drawer.Close>
                <Button size="small" variant="danger" onClick={refuse} disabled={!note.trim()} isLoading={review.isPending}>
                  Refuser
                </Button>
              </Drawer.Footer>
            </Drawer.Content>
          </Drawer>
        </div>
      </div>
    </Section>
  );
};

/** A run: its state, its history in order, its face checks and photos; unlock after 3 wrong codes. */
const RunSection = ({ run, missionId }: { run: Run; missionId: string }) => {
  const unlock = useUnlockRun(missionId);
  const prompt = usePrompt();
  const onUnlock = async () => {
    const ok = await prompt({
      title: 'Redonner des essais',
      description: 'Vérifiez d’abord avec le demandeur et le Traikeur que la bonne personne est sur place.',
      confirmText: 'Débloquer',
      cancelText: 'Annuler',
      variant: 'confirmation',
    });
    if (ok) unlock.mutate(run.id, { onSuccess: () => toast.success('Mission débloquée.'), onError: (e) => toast.error(e.message) });
  };
  return (
    <Section
      title={
        <div>
          <Heading level="h2">Déroulé avec {run.traveler?.first_name ?? 'le Traikeur'}</Heading>
          <Text size="small" className="text-ui-fg-subtle">
            {RUN_STEP[run.step] ?? run.step}
          </Text>
        </div>
      }
      actions={
        <>
          <Status {...(run.locked ? { label: 'Bloquée', tone: 'red' as const } : (RUN_STATUS[run.status] ?? { label: run.status, tone: 'neutral' as const }))} />
          {run.locked && (
            <Button size="small" variant="secondary" onClick={onUnlock} isLoading={unlock.isPending}>
              Débloquer
            </Button>
          )}
        </>
      }
    >
      <PersonRow label="Traikeur" person={run.traveler} />
      <SectionRow label="Acceptée" value={formatDateTime(run.accepted_at)} />
      <SectionRow label="Codes" value={`prise en charge ${run.pickup_code} · remise ${run.dropoff_code} · ${run.code_attempts} essai(s) faux`} />
      {run.report && <SectionRow label="Rapport" value={[run.report.verdict, run.report.summary].filter(Boolean).join(' · ')} />}
      {run.decision && <SectionRow label="Réponse au rapport" value={run.decision === 'accepted' ? 'Achat validé' : run.decision === 'refused' ? 'Achat refusé' : 'Pas de réponse'} />}
      {/* Compared with the selfie the Traikeur was verified with at sign-up. */}
      <Photos title="Selfie de l’inscription" items={run.reference_selfie ? [{ url: run.reference_selfie }] : []} />
      <Photos title="Vérifications du visage" items={run.faces.map((f) => ({ url: f.url, at: f.at, live: true }))} />
      <Photos title="Prise en charge" items={run.pickup_photo ? [run.pickup_photo] : []} />
      <Photos title="En arrivant" items={run.before_photos} />
      <Photos title="Une fois fini" items={run.work_photos} />
      <Photos title="Remise" items={run.dropoff_photo ? [run.dropoff_photo] : []} />
      <div className="px-6 py-4">
        <Text size="small" weight="plus" leading="compact" className="mb-3 text-ui-fg-subtle">
          Historique
        </Text>
        <ol className="flex flex-col gap-y-3 border-l pl-4">
          {run.events.map((e) => (
            <li key={e.id} className="relative">
              <span className="absolute -left-[21px] top-1.5 size-2 rounded-full bg-ui-tag-neutral-icon" />
              <Text size="small" leading="compact">
                {RUN_EVENT[e.type] ?? e.type}
              </Text>
              <Text size="xsmall" className="text-ui-fg-muted">
                {formatDateTime(e.created_at)}
                {e.actor_id && e.actor_id === run.traveler_id ? ' · Traikeur' : ''}
              </Text>
            </li>
          ))}
        </ol>
      </div>
    </Section>
  );
};

export const MissionDetail = () => {
  const { id = '' } = useParams();
  const { data, isLoading, error } = useMission(id);
  if (isLoading) return <Text size="small">Chargement…</Text>;
  if (error || !data) return <Text size="small">{error?.message ?? 'Mission introuvable.'}</Text>;
  const { mission: m, runs, disputes, conversations } = data;
  const transport = m.mode === 'transport';

  return (
    <>
      <Link to="/missions" className="flex items-center gap-x-1 txt-compact-small text-ui-fg-subtle hover:text-ui-fg-base">
        <ArrowLeft /> Missions
      </Link>
      <TwoColumnPage
        main={
          <>
            <Section
              title={
                <div>
                  <Heading>{m.title}</Heading>
                  <Text size="small" className="text-ui-fg-subtle">
                    {CATEGORY[m.category] ?? m.category} · publiée le {formatDateTime(m.created_at)}
                  </Text>
                </div>
              }
              actions={<Status {...(MISSION_STATUS[m.status] ?? { label: m.status, tone: 'neutral' })} />}
            >
              {m.description && <SectionRow label="Description" value={m.description} />}
              <SectionRow label={transport ? 'Prise en charge' : 'Lieu'} value={[m.pickup.label, m.pickup_note].filter(Boolean).join(' — ')} />
              {transport && <SectionRow label="Remise" value={[m.dropoff.label, m.dropoff_note].filter(Boolean).join(' — ')} />}
              <SectionRow label="Échéance" value={`${m.window_start ? `${formatDateTime(m.window_start)} → ` : ''}${formatDateTime(m.deadline)}`} />
              <SectionRow label="Rémunération" value={`${formatPrice(m.price, m.currency_code)}${m.verify_only_price ? ` · ${formatPrice(m.verify_only_price, m.currency_code)} si l’objet est refusé` : ''}`} />
              {transport && <SectionRow label="Objet" value={`taille ${m.size} · ${m.weight_kg} kg${m.fragile ? ' · fragile' : ''} · valeur déclarée ${formatPrice(m.declared_value, m.currency_code)}`} />}
              {m.order && <SectionRow label="Commande" value={`${m.order.store} · au nom de ${m.order.name} · n° ${m.order.ref} · ${{ '1': 'un panier', '2-5': 'un demi-chariot', '6-9': 'un chariot plein', '10+': 'deux chariots ou plus' }[m.order.bags] ?? `${m.order.bags} sacs`}${m.order.heavy ? ', lourd' : ''}`} />}
              {m.seller && <SectionRow label="Vendeur" value={[m.seller.pseudo, m.seller.phone, `code ${m.seller_code ?? '—'}`].filter(Boolean).join(' · ')} />}
              {m.purchase && <SectionRow label="Achat" value={`${formatPrice(m.purchase.price, m.currency_code)}${m.purchase.url ? ` · ${m.purchase.url}` : ''}`} />}
              {m.listing && <SectionRow label="Annonce" value={[m.listing.brand, m.listing.model, m.listing.condition, m.listing.defects].filter(Boolean).join(' · ')} />}
              {m.checklist?.length ? <SectionRow label="Points demandés" value={m.checklist.join(' · ')} /> : null}
              {(m.handler_phone || m.sender_name) && <SectionRow label="Remet l’objet" value={[m.sender_name, m.handler_phone].filter(Boolean).join(' · ')} />}
              {(m.recipient_name || m.recipient_phone) && <SectionRow label="Destinataire" value={[m.recipient_name, m.recipient_phone].filter(Boolean).join(' · ')} />}
              {m.review_note && <SectionRow label="Note de l’équipe" value={m.review_note} />}
              {m.cancelled_at && <SectionRow label="Annulée" value={`${formatDateTime(m.cancelled_at)}${m.cancel_fee ? ` · frais ${formatPrice(m.cancel_fee, m.currency_code)}` : ''}`} />}
            </Section>
            {runs.length ? runs.map((r) => <RunSection key={r.id} run={r} missionId={m.id} />) : null}
          </>
        }
        side={
          <>
            {m.status === 'review' && <ReviewActions mission={m} />}
            <Section title="Demandeur">
              <PersonRow label="Membre" person={m.requester} />
            </Section>
            <Section title="Litiges">
              {disputes.length ? (
                disputes.map((d) => (
                  <div key={d.id} className="flex flex-col gap-y-1 px-6 py-4">
                    <div className="flex items-center justify-between">
                      <Text size="small" weight="plus">
                        {DISPUTE_REASON[d.reason] ?? d.reason}
                      </Text>
                      <Status {...(DISPUTE_STATUS[d.status] ?? { label: d.status, tone: 'neutral' })} />
                    </div>
                    <Text size="small" className="text-ui-fg-subtle">
                      {d.message}
                    </Text>
                    {d.resolution && (
                      <Text size="small" className="text-ui-fg-muted">
                        Réponse : {d.resolution}
                      </Text>
                    )}
                  </div>
                ))
              ) : (
                <Empty>Aucun problème signalé.</Empty>
              )}
            </Section>
            <Section title="Conversations">
              {conversations.length ? (
                conversations.map((c) => (
                  <div key={c.id} className="flex items-center justify-between px-6 py-4">
                    <Link to={`/conversations/${c.id}`} className="txt-compact-small text-ui-fg-interactive hover:text-ui-fg-interactive-hover">
                      Lire la conversation
                    </Link>
                    <Text size="xsmall" className="text-ui-fg-muted">
                      {c.reported_at ? 'signalée' : c.blocked_by ? 'bloquée' : ''}
                    </Text>
                  </div>
                ))
              ) : (
                <Empty>Pas encore de conversation.</Empty>
              )}
            </Section>
          </>
        }
      />
    </>
  );
};
