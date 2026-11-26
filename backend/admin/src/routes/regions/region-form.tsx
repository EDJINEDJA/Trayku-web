import { Button, Checkbox, Input, Label, Select, Text, Textarea, toast } from '@medusajs/ui';
import { useMemo, useState } from 'react';
import { useCountries, useCurrencies, type RegionBody } from '@/hooks/api/regions';
import type { Area, Region } from '@/lib/types';

export const AREAS: Record<Area, string> = { europe: 'Europe', afrique: 'Afrique', 'monde-arabe': 'Monde arabe', asie: 'Asie', ameriques: 'Amériques' };

/**
 * A region's form, as Medusa's: its name, currency and countries; then where its price scale starts
 * (the local minimum wage, the step prices are rounded to, the source). A country already in another
 * region is shown with it and can't be ticked: take it out of that one first.
 */
export const RegionForm = ({ region, saving, onSubmit }: { region?: Region; saving: boolean; onSubmit: (body: RegionBody) => void }) => {
  const currencies = useCurrencies();
  const countries = useCountries();
  const [name, setName] = useState(region?.name ?? '');
  const [currency, setCurrency] = useState(region?.currency_code ?? '');
  const [picked, setPicked] = useState<string[]>(region?.countries ?? []);
  const [area, setArea] = useState<Area | ''>(region?.metadata?.area ?? '');
  const [wage, setWage] = useState(region?.metadata?.minimum_wage ? String(region.metadata.minimum_wage) : '');
  const [rounding, setRounding] = useState(region?.metadata?.rounding ? String(region.metadata.rounding) : '');
  const [note, setNote] = useState(region?.metadata?.wage_note ?? '');
  const [query, setQuery] = useState('');

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (countries.data?.countries ?? []).filter((c) => !q || c.display_name.toLowerCase().includes(q) || c.iso_2.toLowerCase() === q);
  }, [countries.data, query]);
  const toggle = (iso: string) => setPicked((p) => (p.includes(iso) ? p.filter((x) => x !== iso) : [...p, iso]));
  const num = (v: string) => (v.trim() ? Number(v.replace(',', '.')) : undefined);

  const submit = () => {
    if (!name.trim() || !currency) return toast.error('Indiquez le nom et la devise.');
    onSubmit({
      name: name.trim(),
      currency_code: currency,
      countries: picked,
      metadata: { ...(area && { area }), ...(num(wage) && { minimum_wage: num(wage) }), ...(num(rounding) && { rounding: num(rounding) }), ...(note.trim() && { wage_note: note.trim() }) },
    });
  };

  return (
    <div className="flex flex-col gap-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-y-1">
          <Label size="small" weight="plus">
            Nom
          </Label>
          <Input size="small" value={name} onChange={(e) => setName(e.target.value)} placeholder="Maroc" />
        </div>
        <div className="flex flex-col gap-y-1">
          <Label size="small" weight="plus">
            Devise
          </Label>
          <Select value={currency} onValueChange={setCurrency} size="small">
            <Select.Trigger>
              <Select.Value placeholder="Choisir une devise" />
            </Select.Trigger>
            <Select.Content>
              {(currencies.data?.currencies ?? []).map((c) => (
                <Select.Item key={c.code} value={c.code}>
                  {c.code} · {c.name} ({c.symbol_native})
                </Select.Item>
              ))}
            </Select.Content>
          </Select>
        </div>
        <div className="flex flex-col gap-y-1">
          <Label size="small" weight="plus">
            Zone
          </Label>
          <Select value={area || 'none'} onValueChange={(v) => setArea(v === 'none' ? '' : (v as Area))} size="small">
            <Select.Trigger>
              <Select.Value />
            </Select.Trigger>
            <Select.Content>
              <Select.Item value="none">Aucune</Select.Item>
              {Object.entries(AREAS).map(([k, label]) => (
                <Select.Item key={k} value={k}>
                  {label}
                </Select.Item>
              ))}
            </Select.Content>
          </Select>
        </div>
      </div>

      <div className="flex flex-col gap-y-2">
        <Text size="small" weight="plus">
          Point de départ des tarifs
        </Text>
        <Text size="small" className="text-ui-fg-subtle">
          Les tarifs de la région partent des tarifs en euros, ramenés à ce salaire minimum et arrondis à ce pas. Vous les réglez ensuite dans Tarifs.
        </Text>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-y-1">
            <Label size="small" weight="plus">
              Salaire minimum de l’heure {currency && `(${currency})`}
            </Label>
            <Input size="small" type="number" value={wage} onChange={(e) => setWage(e.target.value)} placeholder="17,10" />
          </div>
          <div className="flex flex-col gap-y-1">
            <Label size="small" weight="plus">
              Arrondi des prix {currency && `(${currency})`}
            </Label>
            <Input size="small" type="number" value={rounding} onChange={(e) => setRounding(e.target.value)} placeholder="0,50 en euro, 25 en FCFA" />
          </div>
        </div>
        <div className="flex flex-col gap-y-1">
          <Label size="small" weight="plus">
            Source du salaire minimum
          </Label>
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="SMIG, 17,10 MAD de l’heure (2025)" rows={2} />
        </div>
      </div>

      <div className="flex flex-col gap-y-2">
        <div className="flex items-center justify-between gap-x-4">
          <Text size="small" weight="plus">
            Pays · {picked.length}
          </Text>
          <Input size="small" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Chercher un pays" className="max-w-xs" />
        </div>
        <div className="grid max-h-80 grid-cols-1 gap-x-4 overflow-y-auto rounded-lg border p-3 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((c) => {
            const elsewhere = !!c.region_id && c.region_id !== region?.id;
            return (
              <label key={c.iso_2} className="flex items-center gap-x-2 py-1 txt-compact-small">
                <Checkbox checked={picked.includes(c.iso_2)} disabled={elsewhere} onCheckedChange={() => toggle(c.iso_2)} />
                <span className={elsewhere ? 'text-ui-fg-muted' : ''}>
                  {c.display_name} <span className="text-ui-fg-muted">{c.iso_2}</span>
                  {elsewhere && <span className="text-ui-fg-muted"> · autre région</span>}
                </span>
              </label>
            );
          })}
        </div>
      </div>

      <div className="flex justify-end">
        <Button size="small" isLoading={saving} onClick={submit}>
          {region ? 'Enregistrer' : 'Créer la région'}
        </Button>
      </div>
    </div>
  );
};
