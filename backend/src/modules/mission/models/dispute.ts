import { model } from '@traiku/framework';
import Mission from './mission';

/** A problem reported on a mission: the support reads the run's events, face checks, photos and the conversation. */
const Dispute = model.define('dispute', {
  id: model.id({ prefix: 'disp' }).primaryKey(),
  mission: model.belongsTo(() => Mission),
  run_id: model.text().nullable(),
  opened_by: model.text().index(),
  reason: model.enum(['absent', 'not_conform', 'damaged', 'late', 'payment', 'behaviour', 'other']),
  message: model.text(),
  status: model.enum(['open', 'resolved', 'rejected']).default('open').index(),
  resolution: model.text().nullable(),
  resolved_by: model.text().nullable(),
  resolved_at: model.dateTime().nullable(),
});

export default Dispute;
