import { faceCheckWorkflow } from '../../../../../workflows/runs';
import { runStepRoute } from '../../../../utils/run-route';

export const POST = runStepRoute(faceCheckWorkflow);
