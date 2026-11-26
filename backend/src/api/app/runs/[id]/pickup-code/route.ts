import { pickupCodeWorkflow } from '../../../../../workflows/runs';
import { runStepRoute } from '../../../../utils/run-route';

/** The code of whoever hands the parcel over, typed on arrival. */
export const POST = runStepRoute(pickupCodeWorkflow);
