import { Button, Drawer, Heading, Label, Tabs, Text, Textarea, toast } from '@medusajs/ui';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ListTable, type Column } from '@/components/common/list-table';
import { Section, SectionRow } from '@/components/common/section';
import { Status } from '@/components/common/status';
import { useListParams } from '@/components/common/use-page';
import { useCredentials, useIdentityChecks, useReviewCredential, useReviewIdentity } from '@/hooks/api/verifications';
import { formatDate, formatDateTime } from '@/lib/format';
import type { Credential, IdentityCheck } from '@/lib/types';

const PAGE = 20;
const KINDS = [
  { value: 'identity', label: 'Identités' },
  { value: 'credentials', label: 'Justificatifs de métier' },
];
const STATES: Record<string, { label: string; tone: 'green' | 'orange' | 'red' | 'neutral' }> = {
  pending: { label: 'À vérifier', tone: 'orange' },
  verified: { label: 'Vérifiée', tone: 'green' },
  approved: { label: 'Validé', tone: 'green' },
  refused: { label: 'Refusé', tone: 'red' },
  replaced: { label: 'Remplacée', tone: 'neutral' },
};
const fullName = (m: { first_name: string; last_name: string | null } | null) => (m ? [m.first_name, m.last_name].filter(Boolean).join(' ') : '—');

const identityColumns: Column<IdentityCheck>[] = [
  { key: 'who', header: 'Membre', render: (c) => <span className="txt-compact-small-plus">{fullName(c.member)}</span> },
  { key: 'doc', header: 'Pièce', render: (c) => c.document_label },
  { key: 'at', header: 'Envoyée le', render: (c) => formatDateTime(c.created_at) },
  { key: 'status', header: 'Statut', render: (c) => <Status {...(STATES[c.status] ?? { label: c.status, tone: 'neutral' })} /> },
];

const credentialColumns: Column<Credential>[] = [
  { key: 'who', header: 'Membre', render: (c) => <span className="txt-compact-small-plus">{fullName(c.member)}</span> },
  { key: 'trade', header: 'Métier', render: (c) => c.profession },
  { key: 'title', header: 'Justificatif', render: (c) => c.title ?? '—' },
  { key: 'at', header: 'Envoyé le', render: (c) => formatDateTime(c.created_at) },
  { key: 'status', header: 'Statut', render: (c) => <Status {...(STATES[c.status] ?? { label: c.status, tone: 'neutral' })} /> },
];

/** A large photo, opened full size on a click. */
const Shot = ({ label, url }: { label: string; url: string | null }) => (
  <div className="flex flex-1 flex-col gap-y-1">
    <Text size="xsmall" className="text-ui-fg-subtle">
      {label}
    </Text>
    {url ? (
      <a href={url} target="_blank" rel="noreferrer">
        <img src={url} alt={label} className="aspect-[4/3] w-full rounded-md border object-contain bg-ui-bg-subtle" />
      </a>
    ) : (
      <div className="aspect-[4/3] w-full rounded-md border bg-ui-bg-subtle" />
    )}
  </div>
);

/** Approve, or refuse with the reason the member reads to try again. */
const Decision = ({ pending, onDecide, busy, approveLabel }: { pending: boolean; onDecide: (approve: boolean, reason: string) => void; busy: boolean; approveLabel: string }) => {
  const [reason, setReason] = useState('');
  if (!pending) return null;
  return (
    <>
      <div className="flex flex-col gap-y-1 px-6 pb-4">
        <Label htmlFor="reason" size="small">
          Motif si refusé, lu par le membre
        </Label>
        <Textarea id="reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Par exemple : la photo de la pièce est floue, reprenez-la à la lumière." />
      </div>
      <Drawer.Footer>
        <Button size="small" variant="danger" onClick={() => onDecide(false, reason)} disabled={!reason.trim()} isLoading={busy}>
          Refuser
        </Button>
        <Button size="small" onClick={() => onDecide(true, '')} isLoading={busy}>
          {approveLabel}
        </Button>
      </Drawer.Footer>
    </>
  );
};

const IdentityDrawer = ({ check, onClose }: { check: IdentityCheck; onClose: () => void }) => {
  const review = useReviewIdentity();
  const decide = (approve: boolean, reason: string) =>
    review.mutate(
      { id: check.id, approve, reason: reason || undefined },
      {
        onSuccess: () => {
          toast.success(approve ? 'Identité vérifiée.' : 'Vérification refusée : le membre peut recommencer.');
          onClose();
        },
        onError: (e) => toast.error(e.message),
      }
    );
  return (
    <Drawer open onOpenChange={(o) => !o && onClose()}>
      <Drawer.Content className="max-w-3xl">
        <Drawer.Header>
          <Drawer.Title>Identité de {fullName(check.member)}</Drawer.Title>
        </Drawer.Header>
        <Drawer.Body className="flex flex-col gap-y-4 overflow-y-auto p-0">
          <div className="divide-y">
            <SectionRow label="Membre" value={check.member ? <Link to={`/members/${check.member.id}`} className="text-ui-fg-interactive">{fullName(check.member)}</Link> : '—'} />
            <SectionRow label="Né le, selon le compte" value={check.member?.birth_date ? formatDate(check.member.birth_date) : '—'} />
            <SectionRow label="Pièce" value={check.document_label} />
            <SectionRow label="Envoyée le" value={formatDateTime(check.created_at)} />
            {check.reason && <SectionRow label="Motif du refus" value={check.reason} />}
          </div>
          <div className="flex flex-col gap-y-3 px-6">
            <Text size="small" className="text-ui-fg-subtle">
              Vérifiez : le visage du selfie est celui de la pièce, et c’est bien la même personne qui tourne la tête sur les poses (pas une photo ni un écran) ; le nom et la date de naissance sont ceux du compte ; la pièce est valide, entière, non modifiée.
            </Text>
            <div className="flex gap-3">
              <Shot label="Selfie" url={check.selfie_url} />
              <Shot label="Recto" url={check.front_url} />
            </div>
            {check.back_url && (
              <div className="flex gap-3">
                <Shot label="Verso" url={check.back_url} />
                <div className="flex-1" />
              </div>
            )}
            {check.poses.length > 0 && (
              <div className="grid grid-cols-4 gap-3">
                {check.poses.map((p) => (
                  <Shot key={p.pose} label={p.label} url={p.url} />
                ))}
              </div>
            )}
          </div>
        </Drawer.Body>
        <Decision pending={check.status === 'pending'} onDecide={decide} busy={review.isPending} approveLabel="C’est bien la même personne" />
      </Drawer.Content>
    </Drawer>
  );
};

const CredentialDrawer = ({ credential, onClose }: { credential: Credential; onClose: () => void }) => {
  const review = useReviewCredential();
  const decide = (approve: boolean, reason: string) =>
    review.mutate(
      { id: credential.id, approve, reason: reason || undefined },
      {
        onSuccess: () => {
          toast.success(approve ? 'Certificat de vérificateur accordé.' : 'Justificatif refusé.');
          onClose();
        },
        onError: (e) => toast.error(e.message),
      }
    );
  return (
    <Drawer open onOpenChange={(o) => !o && onClose()}>
      <Drawer.Content className="max-w-3xl">
        <Drawer.Header>
          <Drawer.Title>Justificatif de {fullName(credential.member)}</Drawer.Title>
        </Drawer.Header>
        <Drawer.Body className="flex flex-col gap-y-4 overflow-y-auto p-0">
          <div className="divide-y">
            <SectionRow label="Membre" value={credential.member ? <Link to={`/members/${credential.member.id}`} className="text-ui-fg-interactive">{fullName(credential.member)}</Link> : '—'} />
            <SectionRow label="Identité" value={credential.member?.verified_id ? 'Vérifiée' : 'Pas encore vérifiée : vérifiez-la d’abord'} />
            <SectionRow label="Métier" value={credential.profession} />
            <SectionRow label="Justificatif" value={credential.title ?? '—'} />
            {credential.reason && <SectionRow label="Motif du refus" value={credential.reason} />}
          </div>
          <div className="flex flex-col gap-y-2 px-6">
            <Text size="small" className="text-ui-fg-subtle">
              Le nom est celui du membre, le document est lisible et correspond au métier.
            </Text>
            {credential.files.map((url, i) => (
              <a key={url} href={url} target="_blank" rel="noreferrer" className="text-ui-fg-interactive txt-compact-small">
                Ouvrir le fichier {i + 1}
              </a>
            ))}
          </div>
        </Drawer.Body>
        <Decision pending={credential.status === 'pending'} onDecide={decide} busy={review.isPending} approveLabel="Accorder le certificat" />
      </Drawer.Content>
    </Drawer>
  );
};

/** Identity checks and trade proofs to review, the oldest first. */
export const VerificationList = () => {
  const { page, tab, setPage, setTab } = useListParams({ tab: 'identity' });
  const [status, setStatus] = useState('pending');
  const identity = useIdentityChecks({ status, limit: PAGE, offset: page * PAGE });
  const credentials = useCredentials({ status: status === 'verified' ? 'approved' : status, limit: PAGE, offset: page * PAGE });
  const [check, setCheck] = useState<IdentityCheck | null>(null);
  const [credential, setCredential] = useState<Credential | null>(null);
  return (
    <Section
      title={
        <div>
          <Heading>Vérifications</Heading>
          <Text size="small" className="text-ui-fg-subtle">
            Pièces d’identité et justificatifs de métier, les plus anciens d’abord.
          </Text>
        </div>
      }
    >
      <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
        <Tabs value={tab} onValueChange={setTab}>
          <Tabs.List>
            {KINDS.map((k) => (
              <Tabs.Trigger key={k.value} value={k.value}>
                {k.label}
              </Tabs.Trigger>
            ))}
          </Tabs.List>
        </Tabs>
        <Tabs value={status} onValueChange={(v) => (setStatus(v), setPage(0))}>
          <Tabs.List>
            <Tabs.Trigger value="pending">À vérifier</Tabs.Trigger>
            <Tabs.Trigger value="verified">Validés</Tabs.Trigger>
            <Tabs.Trigger value="refused">Refusés</Tabs.Trigger>
          </Tabs.List>
        </Tabs>
      </div>
      {tab === 'credentials' ? (
        <ListTable columns={credentialColumns} rows={credentials.data?.credentials ?? []} count={credentials.data?.count ?? 0} pageSize={PAGE} pageIndex={page} onPageChange={setPage} onRowClick={setCredential} empty="Aucun justificatif ici." loading={credentials.isLoading} />
      ) : (
        <ListTable columns={identityColumns} rows={identity.data?.identity_checks ?? []} count={identity.data?.count ?? 0} pageSize={PAGE} pageIndex={page} onPageChange={setPage} onRowClick={setCheck} empty="Aucune pièce ici." loading={identity.isLoading} />
      )}
      {check && <IdentityDrawer check={check} onClose={() => setCheck(null)} />}
      {credential && <CredentialDrawer credential={credential} onClose={() => setCredential(null)} />}
    </Section>
  );
};
