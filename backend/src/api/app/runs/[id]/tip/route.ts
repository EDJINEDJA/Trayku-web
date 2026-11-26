import { setTipWorkflow } from '../../../../../workflows/runs';
import { runStepRoute } from '../../../../utils/run-route';

/** The requester's tip for the Traikeur. */
export const POST = runStepRoute(setTipWorkflow, 'requester_id');
