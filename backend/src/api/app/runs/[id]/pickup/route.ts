import { confirmPickupWorkflow } from '../../../../../workflows/runs';
import { runStepRoute } from '../../../../utils/run-route';

export const POST = runStepRoute(confirmPickupWorkflow);
