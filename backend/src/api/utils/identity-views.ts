import type { AwilixContainer } from 'awilix';
import { MEMBER_MODULE, type MemberModuleService } from '../../modules/member';
import type { CredentialRow, IdentityCheckRow } from '../../modules/member/service';
import { ID_DOCUMENTS, SELFIE_POSES } from '../../lib/identity';
import { fileUrls } from './serialize';

/** For the team: each check with its photos (links that expire) and who sent it. */
export async function identityCheckViews(scope: AwilixContainer, checks: IdentityCheckRow[]) {
  const svc = scope.resolve<MemberModuleService>(MEMBER_MODULE);
  const members = checks.length ? await svc.listMembers({ id: [...new Set(checks.map((c) => c.member_id))] }) : [];
  const urls = await fileUrls(scope, checks.flatMap((c) => [c.front_file_id, c.back_file_id, c.selfie_file_id, ...Object.values(c.pose_file_ids ?? {})]));
  return checks.map((c) => {
    const m = members.find((x) => x.id === c.member_id);
    return {
      id: c.id,
      status: c.status,
      document_type: c.document_type,
      document_label: ID_DOCUMENTS.find((d) => d.id === c.document_type)?.label ?? c.document_type,
      front_url: urls[c.front_file_id] ?? null,
      back_url: c.back_file_id ? (urls[c.back_file_id] ?? null) : null,
      selfie_url: urls[c.selfie_file_id] ?? null,
      /** The live selfie's other poses, in the order they were taken. */
      poses: SELFIE_POSES.flatMap((p) => {
        const id = c.pose_file_ids?.[p.id];
        return id ? [{ pose: p.id, label: p.label, url: urls[id] ?? null }] : [];
      }),
      reason: c.reason,
      provider: c.provider,
      reviewed_by: c.reviewed_by,
      reviewed_at: c.reviewed_at,
      created_at: c.created_at,
      member: m ? { id: m.id, first_name: m.first_name, last_name: m.last_name, birth_date: m.birth_date, phone: m.phone } : null,
    };
  });
}

export async function credentialViews(scope: AwilixContainer, list: CredentialRow[]) {
  const svc = scope.resolve<MemberModuleService>(MEMBER_MODULE);
  const members = list.length ? await svc.listMembers({ id: [...new Set(list.map((c) => c.member_id))] }) : [];
  const urls = await fileUrls(scope, list.flatMap((c) => c.file_ids));
  return list.map((c) => {
    const m = members.find((x) => x.id === c.member_id);
    return {
      id: c.id,
      status: c.status,
      profession: c.profession,
      title: c.title,
      files: c.file_ids.map((id) => urls[id] ?? null).filter(Boolean),
      reason: c.reason,
      reviewed_at: c.reviewed_at,
      created_at: c.created_at,
      member: m ? { id: m.id, first_name: m.first_name, last_name: m.last_name, verified_id: m.verified_id } : null,
    };
  });
}

/** The selfie each member was checked with: the face checks of their missions are compared to it. */
export async function referenceSelfies(scope: AwilixContainer, memberIds: string[]) {
  const ids = [...new Set(memberIds)];
  if (!ids.length) return {};
  const checks = await scope.resolve<MemberModuleService>(MEMBER_MODULE).listIdentityChecks({ member_id: ids, status: 'verified' }, { order: { created_at: 'DESC' } });
  const urls = await fileUrls(scope, checks.map((c) => c.selfie_file_id));
  const out: Record<string, string | null> = {};
  for (const c of checks) if (!(c.member_id in out)) out[c.member_id] = urls[c.selfie_file_id] ?? null;
  return out;
}
