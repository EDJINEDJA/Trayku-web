import { model } from '@traiku/framework';

/** « Signaler cette publicité », from a member (or someone signed out). */
const AdReport = model.define('ad_report', {
  id: model.id({ prefix: 'adrep' }).primaryKey(),
  ad_id: model.text().index(),
  member_id: model.text().nullable(),
});

export default AdReport;
