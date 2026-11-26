import { Module } from '../../modules';
import { Modules } from '../../utils';
import ApiKeyModuleService from './service';

export default Module(Modules.API_KEY, { service: ApiKeyModuleService });
export { ApiKeyModuleService };
