import { emitEventStep } from '@traiku/framework/core-flows';
import { createStep, createWorkflow, StepResponse, transform, WorkflowResponse, type StepExecutionContext } from '@traiku/framework/workflows';
import { TraikuError } from '@traiku/framework';
import { forgetPricing, type RegionMetadata } from '../../lib/regions';
import { CURRENCY_MODULE, type CurrencyModuleService } from '../../modules/currency';
import { REGION_MODULE, type RegionModuleService } from '../../modules/region';

/**
 * Regions, as Medusa's createRegionsWorkflow, updateRegionsWorkflow and deleteRegionsWorkflow: each
 * step checks, changes the region and its countries, and undoes it if a later step fails.
 */

type Ctx = Pick<StepExecutionContext, 'container'>;
export type RegionInput = { name: string; currency_code: string; countries?: string[]; metadata?: RegionMetadata | null };

const svc = (ctx: Ctx) => ctx.container.resolve<RegionModuleService>(REGION_MODULE);

/** The currency must be one of the currency module's. */
async function assertCurrency(ctx: Ctx, code: string) {
  const found = await ctx.container.resolve<CurrencyModuleService>(CURRENCY_MODULE).listCurrencies({ code: code.toUpperCase() }, { take: 1 });
  if (!found.length) throw new TraikuError(TraikuError.Types.INVALID_DATA, `Devise inconnue : ${code}.`);
  return found[0].code;
}

/** The scales read before are dropped: a region's currency or countries may have changed. */
export const forgetPricingStep = createStep('forget-pricing', async () => {
  forgetPricing();
  return new StepResponse(undefined);
});

// ── Create ───────────────────────────────────────────────────────────────────

export const createRegionsStep = createStep(
  'create-regions',
  async (input: { regions: RegionInput[] }, ctx) => {
    const ids: string[] = [];
    try {
      for (const r of input.regions) {
        const region = await svc(ctx).createRegions({ name: r.name.trim(), currency_code: await assertCurrency(ctx, r.currency_code), metadata: r.metadata ?? null });
        ids.push(region.id);
        await svc(ctx).setRegionCountries(region.id, r.countries ?? []);
      }
    } catch (e) {
      // A country already taken, say: the regions made before it go too.
      for (const id of ids) await svc(ctx).setRegionCountries(id, []).then(() => svc(ctx).deleteRegions(id));
      throw e;
    }
    return new StepResponse(ids, ids);
  },
  async (ids, ctx) => {
    for (const id of ids ?? []) {
      await svc(ctx).setRegionCountries(id, []);
      await svc(ctx).deleteRegions(id);
    }
  }
);

export const createRegionsWorkflow = createWorkflow('create-regions', (input: { regions: RegionInput[] }) => {
  const ids = createRegionsStep(input);
  forgetPricingStep();
  emitEventStep({ eventName: 'region.created', data: transform({ ids }, ({ ids }) => ({ ids })) });
  return new WorkflowResponse(ids);
});

// ── Update ───────────────────────────────────────────────────────────────────

type Before = { id: string; name: string; currency_code: string; metadata: Record<string, unknown> | null; countries: string[] };

export const updateRegionsStep = createStep(
  'update-regions',
  async (input: { id: string; update: Partial<RegionInput> }, ctx) => {
    const row = await svc(ctx).retrieveRegion(input.id);
    const countries = (await svc(ctx).listCountries({ region_id: row.id }, { select: ['iso_2'] })).map((c) => c.iso_2);
    const before: Before = { id: row.id, name: row.name, currency_code: row.currency_code, metadata: row.metadata, countries };
    const { countries: next, ...fields } = input.update;
    if (fields.currency_code) fields.currency_code = await assertCurrency(ctx, fields.currency_code);
    if (next) await svc(ctx).setRegionCountries(row.id, next);
    try {
      if (Object.keys(fields).length) await svc(ctx).updateRegions({ id: row.id, ...fields, ...(fields.name && { name: fields.name.trim() }) });
    } catch (e) {
      await svc(ctx).setRegionCountries(row.id, before.countries);
      throw e;
    }
    return new StepResponse(row.id, before);
  },
  async (before, ctx) => {
    if (!before) return;
    await svc(ctx).updateRegions({ id: before.id, name: before.name, currency_code: before.currency_code, metadata: before.metadata });
    await svc(ctx).setRegionCountries(before.id, before.countries);
  }
);

export const updateRegionsWorkflow = createWorkflow('update-regions', (input: { id: string; update: Partial<RegionInput> }) => {
  const id = updateRegionsStep(input);
  forgetPricingStep();
  emitEventStep({ eventName: 'region.updated', data: transform({ id }, ({ id }) => ({ id })) });
  return new WorkflowResponse(id);
});

// ── Delete ───────────────────────────────────────────────────────────────────

/** Its countries leave it (they fall back on France's region), then it is soft-deleted; its price scales stay. */
export const deleteRegionsStep = createStep(
  'delete-regions',
  async (input: { ids: string[] }, ctx) => {
    const kept: { id: string; countries: string[] }[] = [];
    for (const id of input.ids) {
      await svc(ctx).retrieveRegion(id);
      kept.push({ id, countries: await svc(ctx).setRegionCountries(id, []) });
    }
    await svc(ctx).softDeleteRegions(input.ids);
    return new StepResponse(input.ids, kept);
  },
  async (kept, ctx) => {
    if (!kept?.length) return;
    await svc(ctx).restoreRegions(kept.map((k) => k.id));
    for (const k of kept) await svc(ctx).setRegionCountries(k.id, k.countries);
  }
);

export const deleteRegionsWorkflow = createWorkflow('delete-regions', (input: { ids: string[] }) => {
  const ids = deleteRegionsStep(input);
  forgetPricingStep();
  emitEventStep({ eventName: 'region.deleted', data: transform({ ids }, ({ ids }) => ({ ids })) });
  return new WorkflowResponse(ids);
});
