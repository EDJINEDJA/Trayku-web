import { answerExtraTimeWorkflow } from '../../../../../../workflows/runs';
import { runStepRoute } from '../../../../../utils/run-route';

/** The requester accepts or refuses the extra time asked for. */
export const POST = runStepRoute(answerExtraTimeWorkflow, 'requester_id');
