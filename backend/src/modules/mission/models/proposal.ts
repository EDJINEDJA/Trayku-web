import { model } from '@traiku/framework';
import Mission from './mission';

/** Vérification at a seller's: a time a Traikeur passing by proposes; the requester relays it to the seller. */
const Proposal = model.define('proposal', {
  id: model.id({ prefix: 'prop' }).primaryKey(),
  mission: model.belongsTo(() => Mission),
  member_id: model.text().index(),
  at: model.dateTime(),
  status: model.enum(['pending', 'sent', 'accepted', 'declined']).default('pending'),
});

export default Proposal;
