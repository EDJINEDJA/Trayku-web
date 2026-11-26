import { Module } from '@traiku/framework';
import MissionModuleService from './service';

export const MISSION_MODULE = 'mission';

export default Module(MISSION_MODULE, { service: MissionModuleService });
export { MissionModuleService };
export * from './types';
