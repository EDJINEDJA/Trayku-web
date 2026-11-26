import { model, type AnyDmlEntity } from '@traiku/framework';
import Region from './region';

/** A country, as Medusa's region_country: written at start-up, in one region at most. */
const Country = model.define('country', {
  /** ISO 3166-1 alpha-2, upper case (FR, CI, JP): as the phone field and member.country. */
  iso_2: model.text().primaryKey(),
  name: model.text(),
  display_name: model.text(),
  /** The calling code ("+33"). */
  dial: model.text().nullable(),
  region: model.belongsTo((): AnyDmlEntity => Region).nullable(),
});

export default Country;
