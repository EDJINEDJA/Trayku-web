import { Module } from '@traiku/framework';
import ReviewModuleService from './service';

export const REVIEW_MODULE = 'review';

export default Module(REVIEW_MODULE, { service: ReviewModuleService });
export { ReviewModuleService };
