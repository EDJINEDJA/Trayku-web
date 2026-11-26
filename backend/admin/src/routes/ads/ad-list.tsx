import { Button, Drawer, Heading, Input, Label, Switch, Text, toast, usePrompt } from '@medusajs/ui';
import { useRef, useState } from 'react';
import { ListTable, type Column } from '@/components/common/list-table';
import { Section } from '@/components/common/section';
import { Status } from '@/components/common/status';
import { useAds, useDeleteAd, useSaveAd, useUploadImage, type AdBody } from '@/hooks/api/ads';
import { formatDateTime, type Tone } from '@/lib/format';
import type { AdminAd } from '@/lib/types';

/** The pictures the app shows: 1280 × 400 (3.2 : 1). */
const RATIO = 3.2;
const percent = new Intl.NumberFormat('fr-FR', { style: 'percent', maximumFractionDigits: 1 });
const count = new Intl.NumberFormat('fr-FR');

/** Where an ad stands now. */
function stateOf(ad: AdminAd): { label: string; tone: Tone } {
  const now = Date.now();
  if (!ad.active) return { label: 'En pause', tone: 'neutral' };
  if (ad.starts_at && new Date(ad.starts_at).getTime() > now) return { label: 'Programmée', tone: 'blue' };
  if (ad.ends_at && new Date(ad.ends_at).getTime() <= now) return { label: 'Terminée', tone: 'neutral' };
  return { label: 'En ligne', tone: 'green' };
}

/** An ISO date as the date-time field wants it (local time), and back. */
const toLocal = (iso: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};
const fromLocal = (v: string) => (v ? new Date(v).toISOString() : null);

const EMPTY: AdBody = { sponsor: '', title: '', image_file_id: '', url: 'https://', starts_at: null, ends_at: null, active: true };

/** A new ad, or one changed: the picture first, then who pays, the link and the dates. */
const AdForm = ({ ad, trigger }: { ad?: AdminAd; trigger: React.ReactNode }) => {
  const save = useSaveAd();
  const upload = useUploadImage();
  const file = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState<AdBody>(EMPTY);
  const [preview, setPreview] = useState<string | null>(null);
  const [ratio, setRatio] = useState<number | null>(null);
  const set = <K extends keyof AdBody>(k: K, v: AdBody[K]) => setBody((b) => ({ ...b, [k]: v }));

  const onOpen = (o: boolean) => {
    setOpen(o);
    if (!o) return;
    setBody(ad ? { sponsor: ad.sponsor, title: ad.title, image_file_id: ad.image_file_id, url: ad.url, starts_at: ad.starts_at, ends_at: ad.ends_at, active: ad.active } : EMPTY);
    setPreview(ad?.image_url ?? null);
    setRatio(null);
  };

  const pick = (f: File | undefined) => {
    if (!f) return;
    upload.mutate(f, {
      onSuccess: ({ id, url }) => {
        set('image_file_id', id);
        setPreview(url);
      },
      onError: (e) => toast.error(e.message),
    });
  };

  const ok = body.image_file_id && body.sponsor.trim() && body.title.trim() && /^https:\/\/.+\..+/.test(body.url.trim());
  const submit = () =>
    save.mutate(
      { id: ad?.id, body: { ...body, url: body.url.trim() } },
      {
        onSuccess: () => {
          toast.success(ad ? 'Publicité enregistrée.' : 'Publicité créée.');
          setOpen(false);
        },
        onError: (e) => toast.error(e.message),
      }
    );

  return (
    <Drawer open={open} onOpenChange={onOpen}>
      <Drawer.Trigger asChild>{trigger}</Drawer.Trigger>
      <Drawer.Content>
        <Drawer.Header>
          <Drawer.Title>{ad ? 'Modifier la publicité' : 'Nouvelle publicité'}</Drawer.Title>
        </Drawer.Header>
        <Drawer.Body className="flex flex-col gap-y-5 overflow-y-auto">
          <div className="flex flex-col gap-y-2">
            <Label size="small">Image</Label>
            <div className="overflow-hidden rounded-lg border border-ui-border-base bg-ui-bg-subtle" style={{ aspectRatio: String(RATIO) }}>
              {preview && (
                <img
                  src={preview}
                  alt=""
                  className="h-full w-full object-cover"
                  onLoad={(e) => setRatio(e.currentTarget.naturalWidth / e.currentTarget.naturalHeight)}
                />
              )}
            </div>
            <input ref={file} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
            <div className="flex items-center gap-x-3">
              <Button size="small" variant="secondary" onClick={() => file.current?.click()} isLoading={upload.isPending}>
                {preview ? 'Changer l’image' : 'Choisir une image'}
              </Button>
              <Text size="small" className="text-ui-fg-subtle">
                1280 × 400 pixels, JPEG, PNG ou WebP
              </Text>
            </div>
            {ratio !== null && Math.abs(ratio - RATIO) > 0.15 && (
              <Text size="small" className="text-ui-fg-error">
                Cette image n’a pas le bon format, elle sera recadrée dans l’app.
              </Text>
            )}
          </div>

          <div className="flex flex-col gap-y-1">
            <Label htmlFor="sponsor" size="small">
              Annonceur
            </Label>
            <Input id="sponsor" value={body.sponsor} onChange={(e) => set('sponsor', e.target.value)} placeholder="Garage Martin" />
            <Text size="small" className="text-ui-fg-subtle">
              Pour vous et la facture, jamais affiché dans l’app.
            </Text>
          </div>

          <div className="flex flex-col gap-y-1">
            <Label htmlFor="title" size="small">
              Description de l’image
            </Label>
            <Input id="title" value={body.title} onChange={(e) => set('title', e.target.value)} placeholder="Vidange à 49 € chez Garage Martin" />
            <Text size="small" className="text-ui-fg-subtle">
              Lue aux personnes aveugles à la place de l’image.
            </Text>
          </div>

          <div className="flex flex-col gap-y-1">
            <Label htmlFor="url" size="small">
              Lien ouvert au toucher
            </Label>
            <Input id="url" value={body.url} onChange={(e) => set('url', e.target.value)} placeholder="https://" />
          </div>

          <div className="grid grid-cols-2 gap-x-3">
            <div className="flex flex-col gap-y-1">
              <Label htmlFor="starts" size="small">
                Début
              </Label>
              <Input id="starts" type="datetime-local" value={toLocal(body.starts_at)} onChange={(e) => set('starts_at', fromLocal(e.target.value))} />
            </div>
            <div className="flex flex-col gap-y-1">
              <Label htmlFor="ends" size="small">
                Fin
              </Label>
              <Input id="ends" type="datetime-local" value={toLocal(body.ends_at)} onChange={(e) => set('ends_at', fromLocal(e.target.value))} />
            </div>
          </div>
          <Text size="small" className="-mt-3 text-ui-fg-subtle">
            Vides, elle commence tout de suite et ne s’arrête pas.
          </Text>

          <div className="flex items-center justify-between">
            <Label htmlFor="active" size="small">
              En ligne
            </Label>
            <Switch id="active" checked={body.active} onCheckedChange={(v) => set('active', v)} />
          </div>
        </Drawer.Body>
        <Drawer.Footer>
          <Drawer.Close asChild>
            <Button size="small" variant="secondary">
              Annuler
            </Button>
          </Drawer.Close>
          <Button size="small" onClick={submit} disabled={!ok} isLoading={save.isPending}>
            {ad ? 'Enregistrer' : 'Créer'}
          </Button>
        </Drawer.Footer>
      </Drawer.Content>
    </Drawer>
  );
};

/** Publicités: the ads of the app, their dates, views, clicks and reports; created and changed here. */
export const AdList = () => {
  const { data, isLoading } = useAds();
  const save = useSaveAd();
  const remove = useDeleteAd();
  const prompt = usePrompt();

  const onDelete = async (ad: AdminAd) => {
    const ok = await prompt({
      title: `Supprimer la publicité de « ${ad.sponsor} »`,
      description: 'Elle disparaît de l’app dans les 5 minutes. Ses vues et clics restent comptés.',
      confirmText: 'Supprimer',
      cancelText: 'Annuler',
      variant: 'danger',
    });
    if (ok) remove.mutate(ad.id, { onSuccess: () => toast.success('Publicité supprimée.'), onError: (e) => toast.error(e.message) });
  };
  const toggle = (ad: AdminAd) =>
    save.mutate(
      { id: ad.id, body: { active: !ad.active } },
      { onSuccess: () => toast.success(ad.active ? 'Publicité mise en pause.' : 'Publicité remise en ligne.'), onError: (e) => toast.error(e.message) }
    );

  const columns: Column<AdminAd>[] = [
    {
      key: 'image',
      header: 'Image',
      render: (a) => (
        <div className="w-32 overflow-hidden rounded border border-ui-border-base bg-ui-bg-subtle" style={{ aspectRatio: String(RATIO) }}>
          {a.image_url && <img src={a.image_url} alt={a.title} className="h-full w-full object-cover" />}
        </div>
      ),
    },
    { key: 'sponsor', header: 'Annonceur', render: (a) => <span className="txt-compact-small-plus">{a.sponsor}</span> },
    {
      key: 'period',
      header: 'Période',
      render: (a) => (
        <span className="txt-compact-small text-ui-fg-subtle">
          {a.starts_at ? formatDateTime(a.starts_at) : 'Dès maintenant'}
          <br />
          {a.ends_at ? `au ${formatDateTime(a.ends_at)}` : 'sans fin'}
        </span>
      ),
    },
    { key: 'state', header: 'Statut', render: (a) => <Status {...stateOf(a)} /> },
    { key: 'views', header: 'Vues', className: 'text-right', render: (a) => count.format(a.views) },
    { key: 'clicks', header: 'Clics', className: 'text-right', render: (a) => count.format(a.clicks) },
    { key: 'rate', header: 'Taux de clic', className: 'text-right', render: (a) => percent.format(a.click_rate) },
    {
      key: 'reports',
      header: 'Signalements',
      className: 'text-right',
      render: (a) => <span className={a.reports > 0 ? 'text-ui-fg-error txt-compact-small-plus' : undefined}>{count.format(a.reports)}</span>,
    },
    {
      key: 'actions',
      header: '',
      className: 'text-right whitespace-nowrap',
      render: (a) => (
        <span className="inline-flex gap-x-1">
          <AdForm
            ad={a}
            trigger={
              <Button size="small" variant="transparent">
                Modifier
              </Button>
            }
          />
          <Button size="small" variant="transparent" onClick={() => toggle(a)}>
            {a.active ? 'Pause' : 'Reprendre'}
          </Button>
          <Button size="small" variant="transparent" onClick={() => onDelete(a)}>
            Supprimer
          </Button>
        </span>
      ),
    },
  ];
  const ads = data?.ads ?? [];
  return (
    <Section
      title={
        <div>
          <Heading>Publicités</Heading>
          <Text size="small" className="text-ui-fg-subtle">
            Une image de 1280 × 400 au-dessus des messages de l’app, marquée « Publicité ». Les vues et clics servent à facturer les annonceurs.
          </Text>
        </div>
      }
      actions={
        <AdForm
          trigger={
            <Button size="small" variant="secondary">
              Nouvelle publicité
            </Button>
          }
        />
      }
    >
      <ListTable columns={columns} rows={ads} count={ads.length} pageSize={Math.max(ads.length, 1)} pageIndex={0} onPageChange={() => {}} empty="Aucune publicité." loading={isLoading} />
    </Section>
  );
};
