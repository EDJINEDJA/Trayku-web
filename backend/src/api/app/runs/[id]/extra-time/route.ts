import { requestExtraTimeWorkflow } from '../../../../../workflows/runs';
import { runStepRoute } from '../../../../utils/run-route';

/** The Traikeur asks for more time on site. */
export const POST = runStepRoute(requestExtraTimeWorkflow);
