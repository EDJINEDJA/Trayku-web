import { model } from '@traiku/framework';
import type { LatLng } from '../types';
import Run from './run';

/** Everything that happened during a run, in order, with who and where: the file in case of a dispute. */
const RunEvent = model.define('run_event', {
  id: model.id({ prefix: 'revt' }).primaryKey(),
  run: model.belongsTo(() => Run),
  type: model.text(),
  actor_id: model.text().nullable(),
  coords: model.json<LatLng>().nullable(),
  payload: model.json().nullable(),
});

export default RunEvent;
