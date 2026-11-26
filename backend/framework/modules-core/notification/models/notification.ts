import { model } from '../../../dml';

/** Every message sent (SMS for now), with what the provider answered. */
const Notification = model.define('notification', {
  id: model.id({ prefix: 'noti' }).primaryKey(),
  to: model.text().index(),
  channel: model.text(),
  template: model.text(),
  data: model.json().nullable(),
  provider_id: model.text(),
  status: model.enum(['pending', 'success', 'failure']).default('pending'),
  external_id: model.text().nullable(),
  error: model.text().nullable(),
});

export default Notification;
