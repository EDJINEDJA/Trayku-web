import type { AuthenticatedTraikuRequest, TraikuResponse } from '@traiku/framework/http';
import { MEMBER_MODULE, type MemberModuleService } from '../../../../modules/member';
import { submitCredentialWorkflow } from '../../../../workflows/members/identity';
import type { Infer, SubmitCredential } from '../../../utils/validators';

const view = (c: Awaited<ReturnType<MemberModuleService['listCredentials']>>[number]) => ({ id: c.id, kind: c.kind, profession: c.profession, title: c.title, status: c.status, reason: c.reason, created_at: c.created_at });

/** My trade proofs and where they stand. */
export const GET = async (req: AuthenticatedTraikuRequest, res: TraikuResponse) => {
  const list = await req.scope.resolve<MemberModuleService>(MEMBER_MODULE).listCredentials({ member_id: req.auth_context.actor_id }, { order: { created_at: 'DESC' }, take: 20 });
  res.json({ credentials: list.map(view) });
};

/** A trade proof (diploma, certificate, card), to become a certified verifier in that trade; or a driving licence (kind licence). */
export const POST = async (req: AuthenticatedTraikuRequest<Infer<typeof SubmitCredential>>, res: TraikuResponse) => {
  const { result } = await submitCredentialWorkflow(req.scope).run({ input: { ...req.validatedBody, member_id: req.auth_context.actor_id } });
  res.status(201).json({ credential: view(result) });
};
