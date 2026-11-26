import { model } from '../../../dml';

/** An uploaded file: proof photos, face checks, listing photos. Private by default, read through signed links. */
const File = model.define('file', {
  id: model.id({ prefix: 'file' }).primaryKey(),
  key: model.text().unique(),
  filename: model.text(),
  mime_type: model.text(),
  size: model.number(),
  owner_id: model.text().nullable().index(),
  visibility: model.enum(['private', 'public']).default('private'),
});

export default File;
