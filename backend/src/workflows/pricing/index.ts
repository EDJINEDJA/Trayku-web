import { emitEventStep } from '@traiku/framework/core-flows';
import { createStep, createWorkflow, StepResponse, transform, WorkflowResponse } from '@traiku/framework/workflows';
import { TraikuError } from '@traiku/framework';
import type { Pricing } from '../../lib/pricing';
import { forgetPricing, retrieveRegion } from '../../lib/regions';
import { PRICING_MODULE, type PricingModuleService } from '../../modules/pricing';

/** A new version of a region's price scale (Tarifs): in force at once for its new missions. */
export type SavePriceScaleInput = { region_id: string; pricing: Pricing; note?: string | null; updated_by: string };

export const createPriceScaleStep = createStep(
  'create-price-scale',
  async (input: SavePriceScaleInput, ctx) => {
    if (!(await retrieveRegion(ctx.container, input.region_id))) throw new TraikuError(TraikuError.Types.NOT_FOUND, 'Région introuvable.');
    const svc = ctx.container.resolve<PricingModuleService>(PRICING_MODULE);
    const version = await svc.createPriceScales({ region_id: input.region_id, data: input.pricing, note: input.note || null, updated_by: input.updated_by });
    forgetPricing();
    return new StepResponse(version, version.id);
  },
  async (id, ctx) => {
    if (!id) return;
    await ctx.container.resolve<PricingModuleService>(PRICING_MODULE).deletePriceScales(id);
    forgetPricing();
  }
);

export const savePriceScaleWorkflow = createWorkflow('save-price-scale', (input: SavePriceScaleInput) => {
  const version = createPriceScaleStep(input);
  emitEventStep({ eventName: 'price_scale.created', data: transform({ version }, ({ version }) => ({ id: version.id, region_id: version.region_id })) });
  return new WorkflowResponse(version);
});
