import { Module } from '@traiku/framework';
import MemberModuleService from './service';

export const MEMBER_MODULE = 'member';

export default Module(MEMBER_MODULE, { service: MemberModuleService });
export { MemberModuleService };
