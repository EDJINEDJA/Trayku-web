import type { AuthenticatedTraikuRequest, TraikuResponse } from '@traiku/framework/http';
import { MEMBER_MODULE, type MemberModuleService } from '../../../../modules/member';
import { createSupportRequestWorkflow } from '../../../../workflows/members/support';
import type { CreateSupportRequest, Infer } from '../../../utils/validators';

const view = (r: Awaited<ReturnType<MemberModuleService['listSupportRequests']>>[number]) => ({
  id: r.id,
  topic: r.topic,
  message: r.message,
  status: r.status,
  answer: r.answer,
  answered_at: r.answered_at,
  created_at: r.created_at,
});

/** My questions to the team and their answers, the newest first. */
export const GET = async (req: AuthenticatedTraikuRequest, res: TraikuResponse) => {
  const list = await req.scope.resolve<MemberModuleService>(MEMBER_MODULE).listSupportRequests({ member_id: req.auth_context.actor_id }, { order: { created_at: 'DESC' }, take: 30 });
  res.json({ requests: list.map(view) });
};

export const POST = async (req: AuthenticatedTraikuRequest<Infer<typeof CreateSupportRequest>>, res: TraikuResponse) => {
  const { result } = await createSupportRequestWorkflow(req.scope).run({ input: { ...req.validatedBody, member_id: req.auth_context.actor_id } });
  res.status(201).json({ request: view(result) });
};
