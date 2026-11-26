import { ArrowLeft } from '@medusajs/icons';
import { Button, Heading, Text, toast, usePrompt } from '@medusajs/ui';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Section } from '@/components/common/section';
import { useDeleteRegion, useRegion, useUpdateRegion } from '@/hooks/api/regions';
import { RegionForm } from './region-form';

/** A region, as Medusa's detail page: its form, its prices (Tarifs) and its deletion. */
export const RegionDetail = () => {
  const { id = '' } = useParams();
  const { data, isLoading, error } = useRegion(id);
  const update = useUpdateRegion(id);
  const remove = useDeleteRegion();
  const prompt = usePrompt();
  const navigate = useNavigate();
  if (isLoading) return <Text size="small">Chargement…</Text>;
  if (error || !data) return <Text size="small">{error?.message ?? 'Région introuvable.'}</Text>;
  const r = data.region;

  const askDelete = async () => {
    const ok = await prompt({
      title: `Supprimer ${r.name}`,
      description: 'Ses pays passent dans la région de la France. Les missions déjà publiées gardent leur devise et leurs prix.',
      confirmText: 'Supprimer',
      cancelText: 'Annuler',
      variant: 'danger',
    });
    if (ok) remove.mutate(r.id, { onSuccess: () => (toast.success('Région supprimée.'), navigate('/settings/regions')), onError: (e) => toast.error(e.message) });
  };

  return (
    <>
      <Link to="/settings/regions" className="flex items-center gap-x-1 txt-compact-small text-ui-fg-subtle hover:text-ui-fg-base">
        <ArrowLeft /> Régions
      </Link>
      <Section
        title={
          <div>
            <Heading>{r.name}</Heading>
            <Text size="small" className="text-ui-fg-subtle">
              {r.currency_code} · {r.countries.length} pays
            </Text>
          </div>
        }
        actions={
          <>
            <Button size="small" variant="secondary" onClick={() => navigate(`/pricing?region_id=${r.id}`)}>
              Tarifs de la région
            </Button>
            <Button size="small" variant="danger" onClick={askDelete} isLoading={remove.isPending}>
              Supprimer
            </Button>
          </>
        }
      >
        <div className="px-6 py-4">
          <RegionForm
            key={r.id}
            region={r}
            saving={update.isPending}
            onSubmit={(body) => update.mutate(body, { onSuccess: () => toast.success('Région enregistrée.'), onError: (e) => toast.error(e.message) })}
          />
        </div>
      </Section>
    </>
  );
};
