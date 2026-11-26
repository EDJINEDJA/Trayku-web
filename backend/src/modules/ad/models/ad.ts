import { model } from '@traiku/framework';

/**
 * A paid ad: a picture (1280 × 400) shown in a place of the app (`placement`), that opens `url` on a
 * tap. It runs while `active`, from `starts_at` to `ends_at` (either empty for no limit). Its views,
 * clicks and reports are counted, for the sponsor's invoice and to take it down.
 */
const Ad = model.define('ad', {
  id: model.id({ prefix: 'ad' }).primaryKey(),
  placement: model.enum(['messages']).default('messages'),
  /** Who pays; never shown in the app. */
  sponsor: model.text(),
  /** What the picture says, read aloud to the blind. */
  title: model.text(),
  /** The picture, in the file module. */
  image_file_id: model.text(),
  url: model.text(),
  starts_at: model.dateTime().nullable(),
  ends_at: model.dateTime().nullable(),
  active: model.boolean().default(true),
  views: model.number().default(0),
  clicks: model.number().default(0),
  reports: model.number().default(0),
});

export default Ad;
