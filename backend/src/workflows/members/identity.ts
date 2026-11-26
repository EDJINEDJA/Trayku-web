import { emitEventStep } from '@traiku/framework/core-flows';
import { createStep, createWorkflow, StepResponse, transform, WorkflowResponse } from '@traiku/framework/workflows';
import { Modules, TraikuError, type FileModuleService } from '@traiku/framework';
import { ID_DOCUMENTS, type IdDocumentId, type SelfiePose } from '../../lib/identity';
import { memberService } from '../steps';

/**
 * The identity check (document and selfie) and the trade proofs, sent by the member and reviewed
 * by the team. As Medusa's flows: checked first, then each change with its undo.
 */

const invalid = (m: string) => new TraikuError(TraikuError.Types.INVALID_DATA, m);
const notAllowed = (m: string, code?: string) => new TraikuError(TraikuError.Types.NOT_ALLOWED, m, code);
const IMAGES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];

/** The member's own files, of the allowed types. */
async function assertFiles(ctx: { container: { resolve<T>(k: string): T } }, ids: string[], ownerId: string, types: string[], what: string) {
  const files = ctx.container.resolve<FileModuleService>(Modules.FILE);
  await files.assertOwned(ids, ownerId);
  const rows = await files.listFiles({ id: ids });
  if (rows.some((f) => !types.includes(f.mime_type))) throw invalid(what);
}

// ── Identity ────────────────────────────────────────────────────────────────

export type SubmitIdentityInput = {
  member_id: string;
  document_type: IdDocumentId;
  front_file_id: string;
  back_file_id?: string | null;
  selfie_file_id: string;
  pose_file_ids: Record<SelfiePose, string>;
  consent: true;
};

const validateIdentityStep = createStep('validate-identity', async (input: SubmitIdentityInput, ctx) => {
  const doc = ID_DOCUMENTS.find((d) => d.id === input.document_type);
  if (!doc) throw invalid('Pièce non acceptée.');
  if (doc.sides === 2 && !input.back_file_id) throw invalid('Il manque le verso de la pièce.');
  const member = await memberService(ctx).retrieveMember(input.member_id);
  if (member.verified_id) throw notAllowed('Votre identité est déjà vérifiée.', 'identity_verified');
  const ids = [input.front_file_id, input.back_file_id, input.selfie_file_id, ...Object.values(input.pose_file_ids)].filter((x): x is string => !!x);
  if (new Set(ids).size !== ids.length) throw invalid('Chaque photo doit être différente.');
  await assertFiles(ctx, ids, input.member_id, IMAGES, 'Les photos de la pièce et du visage doivent être des images.');
  // A check still waiting is replaced by this one.
  const waiting = await memberService(ctx).listIdentityChecks({ member_id: input.member_id, status: 'pending' });
  return new StepResponse({ replace: waiting.map((c) => c.id), back: doc.sides === 2 ? input.back_file_id! : null });
});

const replaceChecksStep = createStep(
  'replace-identity-checks',
  async (ids: string[], ctx) => {
    for (const id of ids) await memberService(ctx).updateIdentityChecks({ id, status: 'replaced' });
    return new StepResponse(undefined, ids);
  },
  async (ids, ctx) => {
    for (const id of ids ?? []) await memberService(ctx).updateIdentityChecks({ id, status: 'pending' });
  }
);

const createCheckStep = createStep(
  'create-identity-check',
  async (input: SubmitIdentityInput & { back: string | null }, ctx) => {
    const check = await memberService(ctx).createIdentityChecks({
      member_id: input.member_id,
      document_type: input.document_type,
      front_file_id: input.front_file_id,
      back_file_id: input.back,
      selfie_file_id: input.selfie_file_id,
      pose_file_ids: input.pose_file_ids,
      consent_at: new Date(),
    });
    return new StepResponse(check, check.id);
  },
  async (id, ctx) => {
    await memberService(ctx).deleteIdentityChecks(id);
  }
);

export const submitIdentityWorkflow = createWorkflow('submit-identity', (input: SubmitIdentityInput) => {
  const checked = validateIdentityStep(input);
  replaceChecksStep(checked.replace);
  const check = createCheckStep(transform({ input, checked }, ({ input, checked }) => ({ ...input, back: checked.back })));
  emitEventStep({ eventName: 'identity.submitted', data: { member_id: input.member_id } });
  return new WorkflowResponse(check);
});

export type ReviewIdentityInput = { check_id: string; user_id: string; approve: boolean; reason?: string | null };

const reviewIdentityStep = createStep(
  'review-identity',
  async (input: ReviewIdentityInput, ctx) => {
    const svc = memberService(ctx);
    const check = await svc.retrieveIdentityCheck(input.check_id);
    if (check.status !== 'pending') throw notAllowed('Cette vérification est déjà traitée.');
    if (!input.approve && !input.reason?.trim()) throw invalid('Indiquez au membre pourquoi, pour qu’il puisse recommencer.');
    const member = await svc.retrieveMember(check.member_id);
    await svc.updateIdentityChecks({ id: check.id, status: input.approve ? 'verified' : 'refused', reason: input.approve ? null : input.reason!.trim(), reviewed_by: input.user_id, reviewed_at: new Date() });
    await svc.updateMembers({ id: member.id, verified_id: input.approve });
    return new StepResponse(check, { check_id: check.id, member_id: member.id, verified_id: member.verified_id });
  },
  async (prev, ctx) => {
    const svc = memberService(ctx);
    await svc.updateIdentityChecks({ id: prev.check_id, status: 'pending', reason: null, reviewed_by: null, reviewed_at: null });
    await svc.updateMembers({ id: prev.member_id, verified_id: prev.verified_id });
  }
);

export const reviewIdentityWorkflow = createWorkflow('review-identity', (input: ReviewIdentityInput) => {
  const check = reviewIdentityStep(input);
  emitEventStep({ eventName: 'identity.reviewed', data: { check_id: input.check_id, approved: input.approve } });
  return new WorkflowResponse(check);
});

// ── Trade proofs ────────────────────────────────────────────────────────────

export type SubmitCredentialInput = { member_id: string; kind?: 'trade' | 'licence'; profession: string; title?: string | null; file_ids: string[] };

const submitCredentialStep = createStep(
  'submit-credential',
  async (input: SubmitCredentialInput, ctx) => {
    const svc = memberService(ctx);
    const member = await svc.retrieveMember(input.member_id);
    if (!member.verified_id && !(await svc.listIdentityChecks({ member_id: member.id, status: 'pending' })).length) throw notAllowed('Vérifiez d’abord votre identité.', 'identity_required');
    await assertFiles(ctx, input.file_ids, member.id, [...IMAGES, 'application/pdf'], 'Le justificatif doit être une photo ou un PDF.');
    const waiting = await svc.listCredentials({ member_id: member.id, status: 'pending' });
    if (waiting.length >= 3) throw notAllowed('Vous avez déjà des justificatifs en attente : l’équipe les vérifie.');
    const licence = input.kind === 'licence';
    const credential = await svc.createCredentials({
      member_id: member.id,
      kind: licence ? 'licence' : 'trade',
      profession: licence ? 'Permis de conduire' : input.profession.trim(),
      title: input.title?.trim() || null,
      file_ids: input.file_ids,
    });
    // A trade proof: in review meanwhile, unless the member already has a certificate. A licence changes nothing of it.
    const verifier = member.verifier ?? { via: 'pro' as const, since: new Date().toISOString(), in_review: true };
    if (!member.verifier && !licence) await svc.updateMembers({ id: member.id, verifier });
    return new StepResponse(credential, { id: credential.id, member_id: member.id, verifier: member.verifier });
  },
  async (prev, ctx) => {
    const svc = memberService(ctx);
    await svc.deleteCredentials(prev.id);
    await svc.updateMembers({ id: prev.member_id, verifier: prev.verifier });
  }
);

export const submitCredentialWorkflow = createWorkflow('submit-credential', (input: SubmitCredentialInput) => {
  const credential = submitCredentialStep(input);
  emitEventStep({ eventName: 'credential.submitted', data: { member_id: input.member_id } });
  return new WorkflowResponse(credential);
});

export type ReviewCredentialInput = { credential_id: string; user_id: string; approve: boolean; reason?: string | null };

const reviewCredentialStep = createStep(
  'review-credential',
  async (input: ReviewCredentialInput, ctx) => {
    const svc = memberService(ctx);
    const credential = await svc.retrieveCredential(input.credential_id);
    if (credential.status !== 'pending') throw notAllowed('Ce justificatif est déjà traité.');
    if (!input.approve && !input.reason?.trim()) throw invalid('Indiquez au membre pourquoi.');
    const member = await svc.retrieveMember(credential.member_id);
    if (input.approve && !member.verified_id) throw notAllowed('Vérifiez d’abord l’identité de ce membre.', 'identity_required');
    await svc.updateCredentials({ id: credential.id, status: input.approve ? 'approved' : 'refused', reason: input.approve ? null : input.reason!.trim(), reviewed_by: input.user_id, reviewed_at: new Date() });
    // A licence: approved or not, nothing else changes (it opens the vehicles to bring back).
    if (credential.kind === 'licence') return new StepResponse(credential, { id: credential.id, member_id: member.id, verifier: member.verifier, professions: member.professions });
    const others = await svc.listCredentials({ member_id: member.id, status: 'pending', kind: 'trade' });
    // Approved: the certificate in that trade. Refused with nothing else waiting: no longer in review.
    const verifier = input.approve
      ? { via: 'pro' as const, since: new Date().toISOString() }
      : member.verifier?.in_review && !others.length
        ? null
        : member.verifier;
    await svc.updateMembers({ id: member.id, verifier, ...(input.approve && !member.professions.includes(credential.profession) && { professions: [...member.professions, credential.profession] }) });
    return new StepResponse(credential, { id: credential.id, member_id: member.id, verifier: member.verifier, professions: member.professions });
  },
  async (prev, ctx) => {
    const svc = memberService(ctx);
    await svc.updateCredentials({ id: prev.id, status: 'pending', reason: null, reviewed_by: null, reviewed_at: null });
    await svc.updateMembers({ id: prev.member_id, verifier: prev.verifier, professions: prev.professions });
  }
);

export const reviewCredentialWorkflow = createWorkflow('review-credential', (input: ReviewCredentialInput) => {
  const credential = reviewCredentialStep(input);
  emitEventStep({ eventName: 'credential.reviewed', data: { credential_id: input.credential_id, approved: input.approve } });
  return new WorkflowResponse(credential);
});
