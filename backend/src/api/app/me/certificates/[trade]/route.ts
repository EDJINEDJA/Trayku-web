import { TraikuError } from '@traiku/framework';
import type { AuthenticatedTraikuRequest, TraikuResponse } from '@traiku/framework/http';
import { MEMBER_MODULE, type MemberModuleService } from '../../../../../modules/member';
import { certificateTest, PASS_SCORE, RETRY_DAYS } from '../../../../../lib/certificates';
import { TRADES } from '../../../../../lib/identity';
import type { CertificateAnswers, Infer } from '../../../../utils/validators';

type Meta = { certificates?: Record<string, { at: string; score: number }>; certificate_fails?: Record<string, string> };
const DAY = 86400000;
const shuffle = <T>(list: T[]) => {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
/** After a failed test: when the next try opens (null: now). */
const retryAt = (meta: Meta, trade: string) => {
  const failed = meta.certificate_fails?.[trade];
  const at = failed ? new Date(failed).getTime() + RETRY_DAYS * DAY : 0;
  return at > Date.now() ? new Date(at).toISOString() : null;
};

function testOf(trade: string) {
  const test = certificateTest(trade);
  if (!test) throw new TraikuError(TraikuError.Types.NOT_FOUND, 'Pas de Certificat Traiku pour ce métier.');
  return test;
}

/**
 * Certificat Traiku of a trade: its questions, in a new order each time and their options too, without the
 * answers (they stay here). With where the member stands: certified, or the next try after a fail.
 */
export const GET = async (req: AuthenticatedTraikuRequest, res: TraikuResponse) => {
  const trade = String(req.params.trade);
  const test = testOf(trade);
  const member = await req.scope.resolve<MemberModuleService>(MEMBER_MODULE).retrieveMember(req.auth_context.actor_id);
  const meta = (member.metadata ?? {}) as Meta;
  res.json({
    trade,
    label: TRADES.find((t) => t.id === trade)?.label ?? trade,
    total: test.length,
    pass: PASS_SCORE,
    certified: meta.certificates?.[trade] ?? null,
    retry_at: retryAt(meta, trade),
    questions: shuffle(test).map(({ id, q, options }) => ({ id, q, options: shuffle(options) })),
  });
};

/**
 * The answers sent (the option's text for each question id): scored here. Passed, the certificate is kept on
 * the account; failed, the next try opens RETRY_DAYS later. The corrections come back either way.
 */
export const POST = async (req: AuthenticatedTraikuRequest<Infer<typeof CertificateAnswers>>, res: TraikuResponse) => {
  const trade = String(req.params.trade);
  const test = testOf(trade);
  const members = req.scope.resolve<MemberModuleService>(MEMBER_MODULE);
  const member = await members.retrieveMember(req.auth_context.actor_id);
  const meta = (member.metadata ?? {}) as Meta;
  if (meta.certificates?.[trade]) throw new TraikuError(TraikuError.Types.NOT_ALLOWED, 'Vous avez déjà le Certificat Traiku de ce métier.', 'certified');
  const wait = retryAt(meta, trade);
  if (wait) throw new TraikuError(TraikuError.Types.NOT_ALLOWED, `Nouvel essai possible le ${new Date(wait).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}.`, 'retry_later');

  const answers = req.validatedBody.answers;
  const corrections = test.map((q) => {
    const picked = answers[q.id] ?? null;
    return { id: q.id, q: q.q, picked, answer: q.options[q.answer], right: picked === q.options[q.answer], why: q.why };
  });
  const score = corrections.filter((c) => c.right).length;
  const passed = score >= PASS_SCORE;
  const now = new Date().toISOString();
  const next: Meta = passed
    ? { ...meta, certificates: { ...meta.certificates, [trade]: { at: now, score } } }
    : { ...meta, certificate_fails: { ...meta.certificate_fails, [trade]: now } };
  const tradeObj = TRADES.find((t) => t.id === trade);
  await members.updateMembers({
    id: member.id,
    metadata: next,
    ...(passed && tradeObj?.verifies && (!member.verifier || member.verifier.in_review) && {
      verifier: { via: 'test', since: now },
    }),
  });
  res.json({ passed, score, total: test.length, pass: PASS_SCORE, retry_at: passed ? null : retryAt(next, trade), corrections });
};
