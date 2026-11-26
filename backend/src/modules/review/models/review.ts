import { model } from '@traiku/framework';

/** A rating after a mission: each side rates the other once. */
const Review = model
  .define('review', {
    id: model.id({ prefix: 'rvw' }).primaryKey(),
    mission_id: model.text().index(),
    author_id: model.text(),
    target_id: model.text().index(),
    /** The role of the one rated in this mission. */
    role: model.enum(['traveler', 'requester']),
    rating: model.number(),
    comment: model.text().nullable(),
  })
  // Once per person rated: a crew's requester rates each Traikeur.
  .indexes([{ on: ['mission_id', 'author_id', 'target_id'], unique: true }]);

export default Review;
