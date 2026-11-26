import { TraikuService } from '@traiku/framework';
import Trip from './models/trip';

export type TripRow = Awaited<ReturnType<TripModuleService['retrieveTrip']>>;

export default class TripModuleService extends TraikuService({ Trip }) {}
