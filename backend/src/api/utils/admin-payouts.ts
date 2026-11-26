import type { AwilixContainer } from 'awilix';
import { MEMBER_MODULE, type MemberModuleService } from '../../modules/member';

/** Who each payout or balance is for, as the team needs it: names, phone, whether the tax details are given (DAC7). */
export async function payees(scope: AwilixContainer, ids: string[]) {
  const list = [...new Set(ids)];
  const rows = list.length ? await scope.resolve<MemberModuleService>(MEMBER_MODULE).listMembers({ id: list }) : [];
  return Object.fromEntries(
    rows.map((m) => [m.id, { id: m.id, first_name: m.first_name, last_name: m.last_name, phone: m.phone, status: m.status, tax_info: !!m.tax_info }])
  );
}
