import { decideReportWorkflow } from '../../../../../workflows/runs';
import { runStepRoute } from '../../../../utils/run-route';

export const POST = runStepRoute(decideReportWorkflow, 'requester_id');
