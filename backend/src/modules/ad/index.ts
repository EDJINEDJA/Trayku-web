import { Module } from '@traiku/framework';
import AdModuleService from './service';

export const AD_MODULE = 'ad';

export default Module(AD_MODULE, { service: AdModuleService });
export { AdModuleService };
export type { AdCounter } from './service';
