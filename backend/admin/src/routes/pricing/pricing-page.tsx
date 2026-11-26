import { Button, Heading, Input, Label, Select, Text, clx, toast, usePrompt } from '@medusajs/ui';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Section } from '@/components/common/section';
import { usePricing, useSavePricing } from '@/hooks/api/pricing';
import { formatDateTime, formatPrice } from '@/lib/format';
import type { PriceLevel, Pricing } from '@/lib/types';

/**
 * Tarifs: every number the prices, Traiku's fees and the cancellations are computed from. Saved, a
 * new version is in force at once for the new missions (those published keep theirs) and the apps
 * read it within minutes. The backend checks every field.
 */

const LEVELS: PriceLevel[] = ['simple', 'skilled', 'expert'];

/** The parts of the page, one shown at a time; the draft and the save bar are shared. */
const TABS = [
  { id: 'apercu', label: 'Aperçu' },
  { id: 'base', label: 'Base et niveaux' },
  { id: 'services', label: 'Services' },
  { id: 'livraisons', label: 'Livraisons' },
  { id: 'surplace', label: 'Sur place' },
  { id: 'annulations', label: 'Annulations et règles' },
  { id: 'historique', label: 'Historique' },
] as const;
type Tab = (typeof TABS)[number]['id'];
/** To the region's step (0,50 €, 25 FCFA); to the currency's unit (the cent, the franc). */
const stepOf = (p: Pricing, v: number) => Number((Math.round(v / p.rounding) * p.rounding).toFixed(6));
const unitOf = (p: Pricing, v: number) => (p.rounding >= 1 ? Math.round(v) : Math.round(v * 100) / 100);
const pct = (r: number) => `${Math.round(r * 1000) / 10} %`;

/** The same computations as the backend (lib/pricing.ts) and the app (services/pricing.ts). */
const levelPrice = (p: Pricing, level: PriceLevel, bonus = 0) => {
  const base = stepOf(p, (p.smic_hourly * p.levels[level].factor * p.base_minutes) / 60);
  return Math.max(p.min_price, stepOf(p, base + stepOf(p, (base * bonus) / 100)));
};
const stepPrice = (p: Pricing, level: PriceLevel) => stepOf(p, (p.smic_hourly * p.levels[level].factor * p.step_minutes) / 60);
const split = (p: Pricing, price: number) => {
  const service = unitOf(p, Math.max(p.fees.service_min, price * p.fees.service_rate));
  const commission = unitOf(p, price * p.fees.traikeur_rate);
  const paid = unitOf(p, price + service + p.fees.insurance);
  const kept = unitOf(p, service + p.fees.insurance + commission);
  return {
    service,
    insurance: p.fees.insurance,
    commission,
    paid,
    traikeur: unitOf(p, price - commission),
    kept,
    keptShare: paid ? kept / paid : 0,
  };
};

// ── Fields ──────────────────────────────────────────────────────────────────

/** A number; `percent`: typed as a percentage, kept as a rate (15 → 0.15). */
const NumField = ({
  label,
  hint,
  value,
  onChange,
  unit,
  percent,
  step,
}: {
  label: string;
  hint?: string;
  value: number;
  onChange: (v: number) => void;
  unit?: string;
  percent?: boolean;
  step?: number;
}) => {
  const shown = percent ? Math.round(value * 1000) / 10 : value;
  const [text, setText] = useState(String(shown));
  useEffect(() => setText(String(shown)), [shown]);
  return (
    <div className="flex flex-col gap-y-1">
      {label && (
        <Label size="small" weight="plus">
          {label}
        </Label>
      )}
      <div className="flex items-center gap-x-2">
        <Input
          type="number"
          size="small"
          step={step ?? (percent ? 0.5 : 0.01)}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            const v = Number(e.target.value.replace(',', '.'));
            if (e.target.value !== '' && Number.isFinite(v)) onChange(percent ? v / 100 : v);
          }}
          className="w-28"
        />
        <Text size="small" className="text-ui-fg-subtle">
          {percent ? '%' : unit}
        </Text>
      </div>
      {hint && (
        <Text size="xsmall" className="text-ui-fg-muted">
          {hint}
        </Text>
      )}
    </div>
  );
};

const LevelSelect = ({ value, onChange, p, inherit }: { value: PriceLevel | undefined; onChange: (v: PriceLevel | undefined) => void; p: Pricing; inherit?: string }) => (
  <Select value={value ?? 'inherit'} onValueChange={(v) => onChange(v === 'inherit' ? undefined : (v as PriceLevel))} size="small">
    <Select.Trigger>
      <Select.Value />
    </Select.Trigger>
    <Select.Content>
      {inherit && <Select.Item value="inherit">{inherit}</Select.Item>}
      {LEVELS.map((l) => (
        <Select.Item key={l} value={l}>
          {p.levels[l].label} (×{p.levels[l].factor})
        </Select.Item>
      ))}
    </Select.Content>
  </Select>
);

/** A block of fields on a grid, with the sentence that says what they do. */
const Block = ({ title, intro, children }: { title: string; intro: ReactNode; children: ReactNode }) => (
  <Section title={title}>
    <div className="px-6 py-4">
      <Text size="small" className="text-ui-fg-subtle">
        {intro}
      </Text>
    </div>
    <div className="grid grid-cols-1 gap-4 px-6 py-4 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
  </Section>
);

const Row = ({ cells, head, className }: { cells: ReactNode[]; head?: boolean; className?: string }) => (
  <div className={clx('grid grid-cols-[2fr_1fr_1fr_1fr] items-center gap-x-4 px-6 py-3', head && 'txt-compact-small-plus text-ui-fg-subtle', className)}>
    {cells.map((c, i) => (
      <div key={i} className={clx('txt-compact-small', i > 0 && 'text-right')}>
        {c}
      </div>
    ))}
  </div>
);

// ── Page ────────────────────────────────────────────────────────────────────

export const PricingPage = () => {
  const [params, setParams] = useSearchParams();
  const tab: Tab = TABS.some((t) => t.id === params.get('tab')) ? (params.get('tab') as Tab) : 'apercu';
  const setTab = (id: Tab) => setParams((p) => (p.set('tab', id), p), { replace: true });
  // The region in the address (?region_id=, from its page in Paramètres), else France's.
  const regionParam = params.get('region_id');
  const { data, isLoading, error } = usePricing(regionParam);
  const regionId = data?.region.id ?? regionParam;
  const save = useSavePricing();
  const prompt = usePrompt();
  const [draft, setDraft] = useState<Pricing | null>(null);
  const [note, setNote] = useState('');
  const [example, setExample] = useState(10);
  useEffect(() => {
    if (data && !draft) setDraft(structuredClone(data.pricing));
  }, [data, draft]);
  /** Another region: its own scale in the form. */
  const switchRegion = async (id: string) => {
    if (id === regionId) return;
    if (
      dirty &&
      !(await prompt({
        title: 'Changer de région',
        description: 'Les modifications non enregistrées de cette région seront perdues.',
        confirmText: 'Changer',
        cancelText: 'Rester',
      }))
    )
      return;
    setDraft(null);
    setParams((q) => (q.set('region_id', id), q), { replace: true });
  };
  const dirty = useMemo(() => !!data && !!draft && JSON.stringify(data.pricing) !== JSON.stringify(draft), [data, draft]);

  if (isLoading || (!draft && !error)) return <Text size="small">Chargement…</Text>;
  if (error || !data || !draft) return <Text size="small">{error?.message ?? 'Tarifs introuvables.'}</Text>;
  const p = draft;
  /** Changes one part of the draft. */
  const set = (fn: (d: Pricing) => void) =>
    setDraft((d) => {
      const next = structuredClone(d!);
      fn(next);
      return next;
    });

  const submit = () =>
    save.mutate(
      { region_id: data.region.id, pricing: p, note: note.trim() || null },
      {
        onSuccess: ({ pricing }) => {
          setDraft(structuredClone(pricing));
          setNote('');
          toast.success('Tarifs enregistrés : en vigueur pour les nouvelles missions.');
        },
        onError: (e) => toast.error(e.message),
      },
    );
  const reset = async () => {
    const ok = await prompt({
      title: 'Revenir aux valeurs par défaut',
      description: 'Le brouillon reprend les valeurs d’origine. Rien n’est enregistré tant que vous ne cliquez pas sur Enregistrer.',
      confirmText: 'Reprendre',
      cancelText: 'Annuler',
    });
    if (ok) setDraft(structuredClone(data.defaults));
  };

  const currency = data.region.currency_code;
  const money = (v?: number | null) => formatPrice(v, currency);
  const ex = split(p, example);
  const families = Object.entries(p.families);
  const services = Object.entries(p.services);

  return (
    <>
      {/* ── Save bar ── */}
      <Section
        title={
          <div>
            <div className="flex items-center gap-x-3">
              <Heading>Tarifs</Heading>
              <Select value={data.region.id} onValueChange={switchRegion} size="small">
                <Select.Trigger className="w-72">
                  <Select.Value />
                </Select.Trigger>
                <Select.Content>
                  {/* By area: Europe, Afrique, Monde arabe, Asie, Amériques, then the others */}
                  {[...Object.entries(data.areas), ['', 'Autres']].map(([area, label]) => {
                    const list = data.regions.filter((r) => (r.metadata?.area ?? '') === area);
                    return (
                      list.length > 0 && (
                        <Select.Group key={area || 'other'}>
                          <Select.Label>{label}</Select.Label>
                          {list.map((r) => (
                            <Select.Item key={r.id} value={r.id}>
                              {r.name} · {r.currency_code}
                            </Select.Item>
                          ))}
                        </Select.Group>
                      )
                    );
                  })}
                </Select.Content>
              </Select>
              <Link to={`/settings/regions/${data.region.id}`} className="txt-compact-small text-ui-fg-interactive hover:underline">
                Modifier la région
              </Link>
            </div>
            <Text size="small" className="text-ui-fg-subtle">
              Tous les chiffres du calcul des prix, des frais Traiku et des annulations. Enregistrés, ils s’appliquent aux nouvelles missions ; les missions déjà publiées gardent leurs prix.
            </Text>
          </div>
        }
        actions={
          <>
            <Button size="small" variant="secondary" onClick={reset}>
              Valeurs par défaut
            </Button>
            <Button size="small" variant="secondary" disabled={!dirty} onClick={() => setDraft(structuredClone(data.pricing))}>
              Annuler les changements
            </Button>
            <Button size="small" disabled={!dirty} isLoading={save.isPending} onClick={submit}>
              Enregistrer
            </Button>
          </>
        }
      >
        <div className="flex items-center gap-x-3 px-6 py-4">
          <Label size="small" htmlFor="note">
            Note de version
          </Label>
          <Input id="note" size="small" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex. SMIC au 1er janvier, ménage revalorisé" className="max-w-md" />
          {dirty && (
            <Text size="small" className="text-ui-fg-interactive">
              Modifications non enregistrées
            </Text>
          )}
        </div>
      </Section>

      {/* ── Tabs: one part of the scale at a time ── */}
      <nav className="flex flex-wrap gap-1 rounded-lg border bg-ui-bg-base p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={clx(
              'rounded-md px-3 py-1.5 txt-compact-small-plus text-ui-fg-subtle transition-fg hover:bg-ui-bg-subtle-hover',
              tab === t.id && 'bg-ui-bg-subtle text-ui-fg-base shadow-elevation-card-rest',
            )}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {tab === 'apercu' && (
        <>
          {/* ── What Traiku earns ── */}
          <Section title="Ce que Traiku gagne">
            <div className="flex flex-col gap-y-2 px-6 py-4">
              <Text size="small" className="text-ui-fg-subtle">
                Pour une mission au prix P : le demandeur paie P plus les frais de service ({pct(p.fees.service_rate)} de P, au moins {money(p.fees.service_min)}) et le fonds de garantie (
                {money(p.fees.insurance)}), montrés ensemble comme frais de service. Le Traikeur reçoit P moins la commission ({pct(p.fees.traikeur_rate)} de P), pareil sur le temps en plus. Traiku
                garde les frais de service, la commission et le fonds de garantie, qui sert à régler les litiges et dédommagements.
              </Text>
              <div className="flex items-center gap-x-2">
                <Label size="small">Exemple, prix de la mission</Label>
                <Input type="number" size="small" value={example} onChange={(e) => setExample(Math.max(0, Number(e.target.value) || 0))} className="w-24" />
                <Text size="small">{currency}</Text>
              </div>
            </div>
            <Row head cells={['', 'Demandeur paie', 'Traikeur reçoit', 'Traiku garde']} />
            <Row cells={['Prix de la mission', money(example), money(ex.traikeur), money(ex.commission)]} />
            <Row cells={['Frais de service', money(ex.service), '—', money(ex.service)]} />
            <Row cells={['Fonds de garantie (dans les frais de service affichés)', money(ex.insurance), '—', money(ex.insurance)]} />
            <Row
              className="bg-ui-bg-subtle"
              cells={[
                <strong key="t">Total</strong>,
                <strong key="a">{money(ex.paid)}</strong>,
                <strong key="b">{money(ex.traikeur)}</strong>,
                <strong key="c">{`${money(ex.kept)} (${pct(ex.keptShare)} du payé)`}</strong>,
              ]}
            />
            <div className="px-6 py-4">
              <Text size="small" weight="plus">
                Pour {p.base_minutes} min, par niveau
              </Text>
            </div>
            <Row head cells={['Niveau', 'Demandeur paie', 'Traikeur reçoit', 'Traiku garde']} />
            {LEVELS.map((l) => {
              const s = split(p, levelPrice(p, l));
              return <Row key={l} cells={[`${p.levels[l].label} · ${money(levelPrice(p, l))}`, money(s.paid), money(s.traikeur), money(s.kept)]} />;
            })}
          </Section>

          {/* ── Fees ── */}
          <Block
            title="Frais et commission Traiku"
            intro="Les frais de service et le fonds de garantie s’ajoutent au prix, payés par le demandeur, qui les voit en une seule ligne « Frais de service ». La commission est retenue sur ce que gagne le Traikeur (prix et temps en plus)."
          >
            <NumField label="Frais de service" percent value={p.fees.service_rate} onChange={(v) => set((d) => void (d.fees.service_rate = v))} hint="Part du prix, payée par le demandeur" />
            <NumField label="Frais de service minimum" unit={currency} value={p.fees.service_min} onChange={(v) => set((d) => void (d.fees.service_min = v))} />
            <NumField
              label="Fonds de garantie par mission"
              unit={currency}
              value={p.fees.insurance}
              onChange={(v) => set((d) => void (d.fees.insurance = v))}
              hint="Payé par le demandeur, inclus dans les frais de service qu’il voit. Sert à régler les litiges."
            />
            <NumField
              label="Commission sur le Traikeur"
              percent
              value={p.fees.traikeur_rate}
              onChange={(v) => set((d) => void (d.fees.traikeur_rate = v))}
              hint="Retenue sur le prix et le temps en plus"
            />
          </Block>
        </>
      )}

      {tab === 'base' && (
        <>
          {/* ── Base ── */}
          <Block
            title="Base du calcul"
            intro={`Une mission est prévue pour ${p.base_minutes} min d’un particulier payé sur la base du SMIC, multiplié par le niveau de la tâche. Le demandeur peut monter ou baisser le prix conseillé, jamais sous le minimum.`}
          >
            <NumField
              label="SMIC horaire brut"
              unit={`${currency} / h`}
              value={p.smic_hourly}
              onChange={(v) => set((d) => void (d.smic_hourly = v))}
              hint={data.region.metadata?.wage_note ?? 'Salaire minimum local : à vérifier'}
            />
            <NumField label="Prix minimum d’une mission" unit={currency} value={p.min_price} onChange={(v) => set((d) => void (d.min_price = v))} />
            <NumField label="Arrondi des prix conseillés" unit={currency} value={p.rounding} onChange={(v) => set((d) => void (d.rounding = v))} hint="0,50 en euro, 25 en FCFA" />
            <NumField label="Durée d’une mission" unit="min" step={5} value={p.base_minutes} onChange={(v) => set((d) => void (d.base_minutes = Math.round(v)))} />
            <NumField label="Tranche de temps en plus" unit="min" step={5} value={p.step_minutes} onChange={(v) => set((d) => void (d.step_minutes = Math.round(v)))} />
            <NumField label="Temps en plus maximum" unit="min" step={5} value={p.max_extra_minutes} onChange={(v) => set((d) => void (d.max_extra_minutes = Math.round(v)))} />
          </Block>

          {/* ── Levels ── */}
          <Section title="Niveaux de tâche">
            <div className="px-6 py-4">
              <Text size="small" className="text-ui-fg-subtle">
                Le coefficient multiplie le SMIC. Prix conseillé pour {p.base_minutes} min, puis par tranche de {p.step_minutes} min en plus.
              </Text>
            </div>
            {LEVELS.map((l) => (
              <div key={l} className="grid grid-cols-1 items-end gap-4 px-6 py-4 lg:grid-cols-[1fr_1fr_2fr_1fr]">
                <div className="flex flex-col gap-y-1">
                  <Label size="small" weight="plus">
                    Nom
                  </Label>
                  <Input size="small" value={p.levels[l].label} onChange={(e) => set((d) => void (d.levels[l].label = e.target.value))} />
                </div>
                <NumField label="Coefficient" unit="× SMIC" step={0.05} value={p.levels[l].factor} onChange={(v) => set((d) => void (d.levels[l].factor = v))} />
                <div className="flex flex-col gap-y-1">
                  <Label size="small" weight="plus">
                    Exemples montrés aux Traikeurs
                  </Label>
                  <Input size="small" value={p.levels[l].examples} onChange={(e) => set((d) => void (d.levels[l].examples = e.target.value))} />
                </div>
                <Text size="small">
                  {money(levelPrice(p, l))} · +{money(stepPrice(p, l))} / {p.step_minutes} min
                </Text>
              </div>
            ))}
          </Section>

          {/* ── Urgency ── */}
          <Block title="Dès que possible" intro="Ajouté au prix conseillé quand le demandeur choisit « Dès que possible ».">
            <NumField label="Petit service" unit={currency} value={p.urgent} onChange={(v) => set((d) => void (d.urgent = v))} />
            <NumField label="Intervention d’un pro" unit={currency} value={p.trade_urgent} onChange={(v) => set((d) => void (d.trade_urgent = v))} />
          </Block>
        </>
      )}

      {tab === 'services' && (
        <>
          {/* ── Families ── */}
          <Section title="Familles de petits services">
            <div className="px-6 py-4">
              <Text size="small" className="text-ui-fg-subtle">
                Le niveau de chaque famille. Un service peut avoir le sien, juste en dessous.
              </Text>
            </div>
            <div className="grid grid-cols-1 gap-4 px-6 py-4 sm:grid-cols-2 lg:grid-cols-3">
              {families.map(([key, f]) => (
                <div key={key} className="flex flex-col gap-y-1">
                  <Label size="small" weight="plus">
                    {f.label}
                  </Label>
                  <LevelSelect p={p} value={f.level} onChange={(v) => set((d) => void (d.families[key].level = v ?? 'simple'))} />
                </div>
              ))}
            </div>
          </Section>

          {/* ── Services one by one ── */}
          <Section title="Services, un par un">
            <div className="px-6 py-4">
              <Text size="small" className="text-ui-fg-subtle">
                Revalorisez un service : son propre niveau, ou un bonus en % sur son prix conseillé (−20 pour baisser). Les services à prix fixe (photos, pros) ont leur prix. Le prix affiché est celui
                d’une mission de {p.base_minutes} min.
              </Text>
            </div>
            <div className="grid grid-cols-[2fr_1.5fr_1fr_1fr] gap-x-4 px-6 py-3 txt-compact-small-plus text-ui-fg-subtle">
              <div>Service</div>
              <div>Niveau</div>
              <div>Bonus ou prix</div>
              <div className="text-right">Prix conseillé</div>
            </div>
            {services.map(([id, s]) => {
              const fixed = s.price !== undefined;
              const level = s.level ?? (s.family ? p.families[s.family]?.level : undefined) ?? 'simple';
              return (
                <div key={id} className="grid grid-cols-[2fr_1.5fr_1fr_1fr] items-center gap-x-4 px-6 py-2">
                  <div>
                    <Text size="small" weight="plus">
                      {s.title}
                    </Text>
                    <Text size="xsmall" className="text-ui-fg-muted">
                      {s.family ? p.families[s.family]?.label : s.group}
                    </Text>
                  </div>
                  <div>
                    {fixed ? (
                      <Text size="small" className="text-ui-fg-muted">
                        Prix fixe
                      </Text>
                    ) : (
                      <LevelSelect
                        p={p}
                        value={s.level}
                        inherit={`Celui de la famille (${p.levels[s.family ? (p.families[s.family]?.level ?? 'simple') : 'simple'].label})`}
                        onChange={(v) => set((d) => void (d.services[id].level = v))}
                      />
                    )}
                  </div>
                  <div>
                    {fixed ? (
                      <NumField label="" unit={currency} value={s.price!} onChange={(v) => set((d) => void (d.services[id].price = v))} />
                    ) : (
                      <NumField label="" percent={false} unit="%" step={5} value={s.bonus ?? 0} onChange={(v) => set((d) => void (d.services[id].bonus = v))} />
                    )}
                  </div>
                  <Text size="small" className="text-right">
                    {money(fixed ? s.price! : levelPrice(p, level, s.bonus ?? 0))}
                  </Text>
                </div>
              );
            })}
          </Section>
        </>
      )}

      {tab === 'livraisons' && (
        <>
          {/* ── Parcels ── */}
          <Block title="Livraison de colis" intro={`Prise en charge, puis par km jusqu’au seuil, moins cher au-delà ; plus la taille, le poids, fragile, urgent (moins de 4 h).`}>
            <NumField label="Prise en charge" unit={currency} value={p.transport.pickup} onChange={(v) => set((d) => void (d.transport.pickup = v))} />
            <NumField label="Par km" unit={currency} value={p.transport.per_km} onChange={(v) => set((d) => void (d.transport.per_km = v))} />
            <NumField label="Seuil" unit="km" step={10} value={p.transport.km_threshold} onChange={(v) => set((d) => void (d.transport.km_threshold = v))} />
            <NumField label="Par km au-delà du seuil" unit={currency} value={p.transport.per_km_beyond} onChange={(v) => set((d) => void (d.transport.per_km_beyond = v))} />
            <NumField label="Fragile" unit={currency} value={p.transport.fragile} onChange={(v) => set((d) => void (d.transport.fragile = v))} />
            <NumField label="Urgent" unit={currency} value={p.transport.urgent} onChange={(v) => set((d) => void (d.transport.urgent = v))} />
            {(['S', 'M', 'L', 'XL', 'XXL'] as const).map((size) => (
              <NumField key={size} label={`Taille ${size}`} unit={currency} value={p.transport.sizes[size]} onChange={(v) => set((d) => void (d.transport.sizes[size] = v))} />
            ))}
            <NumField label="À la porte (chaque bout)" unit={currency} value={p.transport.handling.door} onChange={(v) => set((d) => void (d.transport.handling.door = v))} />
            <NumField label="Jusqu’à l’intérieur (chaque bout)" unit={currency} value={p.transport.handling.room} onChange={(v) => set((d) => void (d.transport.handling.room = v))} />
            <NumField label="Par étage sans ascenseur" unit={currency} value={p.transport.handling.floor} onChange={(v) => set((d) => void (d.transport.handling.floor = v))} />
            {p.transport.weights.map((w, i) => (
              <NumField key={i} label={`Plus de ${w.over_kg} kg`} unit={currency} value={w.extra} onChange={(v) => set((d) => void (d.transport.weights[i].extra = v))} />
            ))}
          </Block>

          {/* ── Click & Collect ── */}
          <Block title="Click & Collect" intro="Prise en charge, puis par km (compté jusqu’au maximum) ; plus la taille (en chariots), les articles lourds, urgent.">
            <NumField label="Prise en charge" unit={currency} value={p.clickcollect.pickup} onChange={(v) => set((d) => void (d.clickcollect.pickup = v))} />
            <NumField label="Par km" unit={currency} value={p.clickcollect.per_km} onChange={(v) => set((d) => void (d.clickcollect.per_km = v))} />
            <NumField label="Km comptés au plus" unit="km" step={5} value={p.clickcollect.max_km} onChange={(v) => set((d) => void (d.clickcollect.max_km = v))} />
            <NumField label="Articles lourds" unit={currency} value={p.clickcollect.heavy} onChange={(v) => set((d) => void (d.clickcollect.heavy = v))} />
            <NumField label="Urgent" unit={currency} value={p.clickcollect.urgent} onChange={(v) => set((d) => void (d.clickcollect.urgent = v))} />
            {(['1', '2-5', '6-9', '10+'] as const).map((b) => (
              <NumField key={b} label={{ '1': 'Un panier', '2-5': 'Un demi-chariot', '6-9': 'Un chariot plein', '10+': 'Deux chariots ou plus' }[b]} unit={currency} value={p.clickcollect.bags[b]} onChange={(v) => set((d) => void (d.clickcollect.bags[b] = v))} />
            ))}
          </Block>
        </>
      )}

      {tab === 'surplace' && (
        <>
          {/* ── On site ── */}
          <Block
            title="Vérifications et photos sur place"
            intro="Déplacement, puis par minute sur place ; plus les points à vérifier au-delà des inclus, les photos demandées, l’appel vidéo. Objet refusé : une part du prix pour la vérification seule. Véhicule ramené : une prise en main, puis par km conduit."
          >
            <NumField label="Déplacement" unit={currency} value={p.onsite.travel} onChange={(v) => set((d) => void (d.onsite.travel = v))} />
            <NumField label="Par minute sur place" unit={currency} value={p.onsite.per_minute} onChange={(v) => set((d) => void (d.onsite.per_minute = v))} />
            <NumField label="Points inclus" unit="points" step={1} value={p.onsite.free_checks} onChange={(v) => set((d) => void (d.onsite.free_checks = Math.round(v)))} />
            <NumField label="Par point en plus" unit={currency} value={p.onsite.per_check} onChange={(v) => set((d) => void (d.onsite.per_check = v))} />
            {p.onsite.photos.map((ph, i) => (
              <NumField key={i} label={`${ph.from} photos et plus`} unit={currency} value={ph.extra} onChange={(v) => set((d) => void (d.onsite.photos[i].extra = v))} />
            ))}
            <NumField label="Urgent" unit={currency} value={p.onsite.urgent} onChange={(v) => set((d) => void (d.onsite.urgent = v))} />
            <NumField label="Appel vidéo" unit={currency} value={p.onsite.live_call} onChange={(v) => set((d) => void (d.onsite.live_call = v))} />
            <NumField label="Diagnostic électronique (véhicule)" unit={currency} value={p.onsite.obd} onChange={(v) => set((d) => void (d.onsite.obd = v))} />
            <NumField label="Objet refusé, part du prix" percent value={p.onsite.verify_only_share} onChange={(v) => set((d) => void (d.onsite.verify_only_share = v))} />
            <NumField label="Objet refusé, minimum" unit={currency} value={p.onsite.verify_only_min} onChange={(v) => set((d) => void (d.onsite.verify_only_min = v))} />
            <NumField label="Véhicule ramené, prise en main" unit={currency} value={p.onsite.drive.pickup} onChange={(v) => set((d) => void (d.onsite.drive.pickup = v))} />
            <NumField label="Véhicule ramené, par km" unit={currency} value={p.onsite.drive.per_km} onChange={(v) => set((d) => void (d.onsite.drive.per_km = v))} />
          </Block>
        </>
      )}

      {tab === 'annulations' && (
        <>
          {/* ── Cancellations ── */}
          <Block
            title="Annulations"
            intro="Gratuit avant qu’un Traikeur accepte et pendant les premières minutes. Ensuite, une part du prix selon le temps restant ; le Traikeur en reçoit une partie. Les frais Traiku sont toujours remboursés."
          >
            <NumField
              label="Minutes gratuites après l’acceptation"
              unit="min"
              step={1}
              value={p.cancellation.grace_minutes}
              onChange={(v) => set((d) => void (d.cancellation.grace_minutes = Math.round(v)))}
            />
            <NumField label="Seuil" unit="h avant" step={1} value={p.cancellation.late_hours} onChange={(v) => set((d) => void (d.cancellation.late_hours = v))} />
            <NumField label="Frais, plus tôt que le seuil" percent value={p.cancellation.share_early} onChange={(v) => set((d) => void (d.cancellation.share_early = v))} />
            <NumField label="Frais, après le seuil" percent value={p.cancellation.share_late} onChange={(v) => set((d) => void (d.cancellation.share_late = v))} />
            <NumField label="Frais minimum" unit={currency} value={p.cancellation.min_fee} onChange={(v) => set((d) => void (d.cancellation.min_fee = v))} />
            <NumField label="Part des frais pour le Traikeur" percent value={p.cancellation.to_traikeur} onChange={(v) => set((d) => void (d.cancellation.to_traikeur = v))} />
          </Block>

          {/* ── New Traikeurs ── */}
          <Block
            title="Nouveaux Traikeurs"
            intro="Un nouveau Traikeur prend une mission à la fois : il doit terminer celle en cours avant d’en accepter une autre, jusqu’à ce nombre de missions faites. 0 : pas de limite."
          >
            <NumField
              label="Missions une à la fois"
              unit="missions"
              step={1}
              value={p.newcomers.one_at_a_time}
              onChange={(v) => set((d) => void (d.newcomers.one_at_a_time = Math.max(0, Math.round(v))))}
            />
          </Block>
        </>
      )}

      {tab === 'historique' && (
        <>
          {/* ── History ── */}
          <Section title="Historique">
            {data.history.length === 0 ? (
              <div className="px-6 py-4">
                <Text size="small" className="text-ui-fg-muted">
                  Aucune version enregistrée : les valeurs par défaut s’appliquent.
                </Text>
              </div>
            ) : (
              data.history.map((h, i) => (
                <div key={h.id} className="flex items-center justify-between gap-x-4 px-6 py-3">
                  <Text size="small">
                    {formatDateTime(h.created_at)}
                    {i === 0 ? ' · en vigueur' : ''}
                    {h.note ? ` · ${h.note}` : ''}
                  </Text>
                  <Text size="small" className="text-ui-fg-muted">
                    {h.by ?? '—'}
                  </Text>
                </div>
              ))
            )}
          </Section>
        </>
      )}
    </>
  );
};
