import { Module } from '@traiku/framework';
import PricingModuleService from './service';

export const PRICING_MODULE = 'pricing';

export default Module(PRICING_MODULE, { service: PricingModuleService });
export { PricingModuleService };
