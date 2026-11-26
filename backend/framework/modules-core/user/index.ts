import { Module } from '../../modules';
import { Modules } from '../../utils';
import UserModuleService from './service';

export default Module(Modules.USER, { service: UserModuleService });
export { UserModuleService };
