import { ArrowLeft } from '@medusajs/icons';
import { Button, Heading, Switch, Text, toast, usePrompt } from '@medusajs/ui';
import { Link, useParams } from 'react-router-dom';
import { Empty, Section, SectionRow, TwoColumnPage } from '@/components/common/section';
import { Photos } from '@/components/common/photos';
import { Status } from '@/components/common/status';
import { useMember, useUpdateMember, type MemberUpdate } from '@/hooks/api/members';
import { MemberWallet } from '@/routes/members/member-wallet';
import { formatDate, formatDateTime, formatPrice, formatRating, MISSION_STATUS, PROFESSION, RUN_STATUS, VEHICLE } from '@/lib/format';

export const MemberDetail = () => {
  const { id = '' } = useParams();
  const { data, isLoading, error } = useMember(id);
  const update = useUpdateMember(id);
  const prompt = usePrompt();
  if (isLoading) return <Text size="small">Chargement…</Text>;
  if (error || !data) return <Text size="small">{error?.message ?? 'Membre introuvable.'}</Text>;
  const { member: m, published, taken, reviews, withdrawals, no_shows = [] } = data;

  const save = (body: MemberUpdate, done: string) => update.mutate(body, { onSuccess: () => toast.success(done), onError: (e) => toast.error(e.message) });

  const toggleSuspend = async () => {
    const suspend = m.status !== 'suspended';
    const ok = await prompt({
      title: suspend ? `Suspendre ${m.first_name}` : `Réactiver ${m.first_name}`,
      description: suspend ? 'Le compte ne pourra plus publier ni accepter de mission. Les missions en cours continuent.' : 'Le compte pourra de nouveau publier et accepter des missions.',
      confirmText: suspend ? 'Suspendre' : 'Réactiver',
      cancelText: 'Annuler',
      variant: suspend ? 'danger' : 'confirmation',
    });
    if (ok) save(suspend ? { status: 'suspended' } : { status: 'active', suspended_until: null }, suspend ? 'Compte suspendu.' : 'Compte réactivé.');
  };

  const verifierText = m.verifier ? `${m.verifier.via === 'pro' ? 'Preuve professionnelle' : 'Test Traiku'} depuis le ${formatDate(m.verifier.since)}${m.verifier.in_review ? ', à vérifier' : ''}` : 'Aucun';

  return (
    <>
      <Link to="/members" className="flex items-center gap-x-1 txt-compact-small text-ui-fg-subtle hover:text-ui-fg-base">
        <ArrowLeft /> Membres
      </Link>
      <TwoColumnPage
        main={
          <>
            <Section
              title={
                <div>
                  <Heading>{[m.first_name, m.last_name].filter(Boolean).join(' ')}</Heading>
                  <Text size="small" className="text-ui-fg-subtle">
                    Inscription le {formatDate(m.created_at)}
                  </Text>
                </div>
              }
              actions={<Status {...(m.status === 'suspended' ? { label: 'Compte suspendu', tone: 'red' as const } : { label: 'Compte actif', tone: 'green' as const })} />}
            >
              <SectionRow label="Téléphone" value={`${m.phone}${m.verified_phone ? ' · vérifié' : ''}`} />
              <SectionRow label="Email" value={m.email} />
              <SectionRow label="Note" value={m.rating_count ? `${formatRating(m.rating)}, ${m.rating_count} avis` : 'Pas encore de note'} />
              <SectionRow label="Missions faites" value={m.missions_done} />
              <SectionRow label="Déplacement" value={m.vehicle ? VEHICLE[m.vehicle] : null} />
              <SectionRow label="Métiers" value={m.professions.length ? m.professions.map((p) => PROFESSION[p] ?? p).join(', ') : null} />
              <SectionRow label="Missions rendues en 30 jours" value={withdrawals.filter((w) => Date.now() - new Date(w).getTime() < 30 * 86400000).length} />
              <SectionRow label="Clients absents déclarés en 30 jours" value={no_shows.filter((w) => Date.now() - new Date(w).getTime() < 30 * 86400000).length} />
              {m.suspended_until && <SectionRow label="Suspension jusqu’au" value={formatDateTime(m.suspended_until)} />}
              {m.bio && <SectionRow label="Présentation" value={m.bio} />}
            </Section>
            <Section title="Missions publiées">
              {published.length ? (
                published.map((p) => (
                  <div key={p.id} className="flex items-center justify-between px-6 py-3">
                    <Link to={`/missions/${p.id}`} className="txt-compact-small text-ui-fg-interactive hover:text-ui-fg-interactive-hover">
                      {p.title}
                    </Link>
                    <div className="flex items-center gap-x-4">
                      <Text size="small" className="text-ui-fg-subtle">
                        {formatPrice(p.price, p.currency_code)}
                      </Text>
                      <Status {...(MISSION_STATUS[p.status] ?? { label: p.status, tone: 'neutral' })} />
                    </div>
                  </div>
                ))
              ) : (
                <Empty>Aucune mission publiée.</Empty>
              )}
            </Section>
            <Section title="Missions faites en tant que Traikeur">
              {taken.length ? (
                taken.map((r) => (
                  <div key={r.id} className="flex items-center justify-between px-6 py-3">
                    <Link to={`/missions/${r.mission_id}`} className="txt-compact-small text-ui-fg-interactive hover:text-ui-fg-interactive-hover">
                      {r.mission?.title ?? r.mission_id}
                    </Link>
                    <div className="flex items-center gap-x-4">
                      <Text size="small" className="text-ui-fg-subtle">
                        {formatDate(r.accepted_at)}
                      </Text>
                      <Status {...(r.locked_at ? { label: 'Bloquée', tone: 'red' as const } : (RUN_STATUS[r.status] ?? { label: r.status, tone: 'neutral' as const }))} />
                    </div>
                  </div>
                ))
              ) : (
                <Empty>Aucune mission acceptée.</Empty>
              )}
            </Section>
            <Section title="Pièce d’identité et selfie">
              {data.identity_checks.length ? (
                <>
                  <div className="divide-y">
                    <SectionRow label="Pièce" value={data.identity_checks[0].document_label} />
                    <SectionRow
                      label="Statut"
                      value={{ pending: 'À vérifier', verified: 'Vérifiée', refused: `Refusée : ${data.identity_checks[0].reason ?? ''}`, replaced: 'Remplacée' }[data.identity_checks[0].status]}
                    />
                    <SectionRow label="Envoyée le" value={formatDateTime(data.identity_checks[0].created_at)} />
                  </div>
                  <Photos
                    title="Photos"
                    items={[data.identity_checks[0].selfie_url, data.identity_checks[0].front_url, data.identity_checks[0].back_url, ...data.identity_checks[0].poses.map((p) => p.url)].map((url) => ({ url }))}
                  />
                  {data.identity_checks[0].status === 'pending' && (
                    <div className="px-6 pb-4">
                      <Link to="/verifications" className="txt-compact-small text-ui-fg-interactive">
                        La vérifier dans Vérifications
                      </Link>
                    </div>
                  )}
                </>
              ) : (
                <Empty>Pas encore envoyée.</Empty>
              )}
            </Section>
            {data.credentials.length > 0 && (
              <Section title="Justificatifs de métier">
                <div className="divide-y">
                  {data.credentials.map((c) => (
                    <SectionRow key={c.id} label={c.profession} value={`${c.title ?? 'Justificatif'} · ${{ pending: 'à vérifier', approved: 'validé', refused: 'refusé' }[c.status]}`} />
                  ))}
                </div>
              </Section>
            )}
          </>
        }
        side={
          <>
            <Section title="Vérifications">
              <div className="flex items-center justify-between gap-x-4 px-6 py-4">
                <div>
                  <Text size="small" weight="plus">
                    Identité vérifiée
                  </Text>
                  <Text size="small" className="text-ui-fg-subtle">
                    Après contrôle de la pièce d’identité.
                  </Text>
                </div>
                <Switch checked={m.verified_id} onCheckedChange={(v) => save({ verified_id: v }, v ? 'Identité marquée vérifiée.' : 'Identité marquée non vérifiée.')} />
              </div>
              <div className="flex flex-col gap-y-3 px-6 py-4">
                <div>
                  <Text size="small" weight="plus">
                    Certificat de vérification
                  </Text>
                  <Text size="small" className="text-ui-fg-subtle">
                    {verifierText}
                  </Text>
                </div>
                <div className="flex gap-x-2">
                  {(!m.verifier || m.verifier.in_review) && (
                    <Button size="small" variant="secondary" onClick={() => save({ verifier: { via: m.verifier?.via ?? 'pro', since: new Date().toISOString() } }, 'Certificat accordé.')}>
                      Accorder
                    </Button>
                  )}
                  {m.verifier && (
                    <Button size="small" variant="secondary" onClick={() => save({ verifier: null }, 'Certificat retiré.')}>
                      Retirer
                    </Button>
                  )}
                </div>
              </div>
            </Section>
            <MemberWallet memberId={m.id} firstName={m.first_name} />
            <Section title="Compte">
              <div className="px-6 py-4">
                <Button size="small" variant={m.status === 'suspended' ? 'secondary' : 'danger'} onClick={toggleSuspend} isLoading={update.isPending}>
                  {m.status === 'suspended' ? 'Réactiver le compte' : 'Suspendre le compte'}
                </Button>
              </div>
            </Section>
            <Section title="Avis reçus">
              {reviews.length ? (
                reviews.map((r) => (
                  <div key={r.id} className="flex flex-col gap-y-1 px-6 py-3">
                    <Text size="small" weight="plus">
                      {formatRating(r.rating)} · en tant que {r.role === 'traveler' ? 'Traikeur' : 'demandeur'}
                    </Text>
                    {r.comment && (
                      <Text size="small" className="text-ui-fg-subtle">
                        {r.comment}
                      </Text>
                    )}
                    <Text size="xsmall" className="text-ui-fg-muted">
                      {formatDate(r.created_at)}
                    </Text>
                  </div>
                ))
              ) : (
                <Empty>Pas encore d’avis.</Empty>
              )}
            </Section>
          </>
        }
      />
    </>
  );
};
