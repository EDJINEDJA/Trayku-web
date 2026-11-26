import { Module } from '../../modules';
import { Modules } from '../../utils';
import FileModuleService from './service';

export default Module(Modules.FILE, { service: FileModuleService });
export { FileModuleService };
