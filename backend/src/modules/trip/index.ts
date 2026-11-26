import { Module } from '@traiku/framework';
import TripModuleService from './service';

export const TRIP_MODULE = 'trip';

export default Module(TRIP_MODULE, { service: TripModuleService });
export { TripModuleService };
