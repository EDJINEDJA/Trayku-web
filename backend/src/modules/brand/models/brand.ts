import { model } from '@traiku/framework';

/**
 * A store chain or a pickup network (Leroy Merlin, Mondial Relay, Leclerc Drive…), offered as one types
 * the « Enseigne » of a Clic & Collect. Those of lib/brands are written at start-up (listed); the ones
 * requesters type are recorded too, and offered to others once a few missions used them.
 */
const Brand = model.define('brand', {
  id: model.id({ prefix: 'brd' }).primaryKey(),
  name: model.text(),
  /** The name lower case, without accents nor spaces: one row per chain. */
  key: model.text().unique(),
  kind: model.enum(['store', 'relay', 'drive', 'pressing', 'other']).default('other'),
  /** Missions published with it. */
  uses: model.number().default(0),
  /** Offered from the start (lib/brands), else once used enough. */
  listed: model.boolean().default(false),
});

export default Brand;
