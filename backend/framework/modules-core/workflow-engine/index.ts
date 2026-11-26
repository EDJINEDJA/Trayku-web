import { Module } from '../../modules';
import { Modules } from '../../utils';
import WorkflowEngineModuleService from './service';

export default Module(Modules.WORKFLOW_ENGINE, { service: WorkflowEngineModuleService });
export { WorkflowEngineModuleService };
