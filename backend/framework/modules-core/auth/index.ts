import { Module } from '../../modules';
import { Modules } from '../../utils';
import AuthModuleService from './service';

export default Module(Modules.AUTH, { service: AuthModuleService });
export { AuthModuleService };
