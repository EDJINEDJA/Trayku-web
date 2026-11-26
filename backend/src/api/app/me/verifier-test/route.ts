import type { AuthenticatedTraikuRequest, TraikuResponse } from '@traiku/framework/http';
import { MEMBER_MODULE, type MemberModuleService } from '../../../../modules/member';
import { getPublicVerifierQuestions, scoreVerifierTest, VERIFIER_PASS_SCORE } from '../../../../lib/verifier-test';
import { meView } from '../../../utils/serialize';
import type { Infer, VerifierTestAnswers } from '../../../utils/validators';

/**
 * The Traiku verifier test: questions across second-hand checks (phones, bikes, cars, furniture, photos, safety).
 * The answers stay on the server.
 */
export const GET = async (req: AuthenticatedTraikuRequest, res: TraikuResponse) => {
  const member = await req.scope.resolve<MemberModuleService>(MEMBER_MODULE).retrieveMember(req.auth_context.actor_id);
  res.json({
    total: 10,
    pass: VERIFIER_PASS_SCORE,
    verifier: member.verifier,
    questions: getPublicVerifierQuestions(),
  });
};

/**
 * Checks the submitted answers. If passed (>= 8/10), the member becomes a verified Traikeur (via: 'test').
 */
export const POST = async (req: AuthenticatedTraikuRequest<Infer<typeof VerifierTestAnswers>>, res: TraikuResponse) => {
  const members = req.scope.resolve<MemberModuleService>(MEMBER_MODULE);
  const member = await members.retrieveMember(req.auth_context.actor_id);
  const result = scoreVerifierTest(req.validatedBody.answers);

  let currentMember = member;
  if (result.passed && (!member.verifier || member.verifier.in_review)) {
    const verifier = { via: 'test' as const, since: new Date().toISOString() };
    await members.updateMembers({ id: member.id, verifier });
    currentMember = await members.retrieveMember(member.id);
  }

  res.json({
    ...result,
    member: await meView(req.scope, currentMember),
  });
};
