import { model } from '@traiku/framework';

/**
 * A version of a region's price scale, saved from the dashboard (Tarifs). The region's newest is in force;
 * the others stay as its history. `data` is merged onto the defaults (lib/pricing.ts).
 */
const PriceScale = model.define('price_scale', {
  id: model.id({ prefix: 'prs' }).primaryKey(),
  /** The region it prices (module region), as Medusa's price rules: { region_id }. */
  region_id: model.text().index(),
  data: model.json<Record<string, unknown>>(),
  /** The team member who saved it. */
  updated_by: model.text().nullable(),
  note: model.text().nullable(),
});

export default PriceScale;
