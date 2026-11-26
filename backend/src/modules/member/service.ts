import { TraikuService, TraikuError } from '@traiku/framework';
import Credential from './models/credential';
import IdentityCheck from './models/identity-check';
import Member from './models/member';
import SupportRequest from './models/support-request';

export type MemberRow = Awaited<ReturnType<MemberModuleService['retrieveMember']>>;
export type IdentityCheckRow = Awaited<ReturnType<MemberModuleService['retrieveIdentityCheck']>>;
export type CredentialRow = Awaited<ReturnType<MemberModuleService['retrieveCredential']>>;

/** What everyone may see of a member: Person in the app. */
export type PublicMember = {
  id: string;
  first_name: string;
  avatar_color: string;
  civility: 'mme' | 'm' | null;
  rating: number;
  rating_count: number;
  missions_done: number;
  verified: boolean;
  vehicle: string | null;
};

export default class MemberModuleService extends TraikuService({Member, IdentityCheck, Credential, SupportRequest }) {
  toPublic(m: MemberRow): PublicMember {
    return {
      id: m.id,
      first_name: m.first_name,
      avatar_color: m.avatar_color,
      civility: m.civility,
      rating: Math.round(m.rating_avg * 10) / 10,
      rating_count: m.rating_count,
      missions_done: m.missions_done,
      verified: m.verified_phone && m.verified_id,
      vehicle: m.vehicle,
    };
  }

  /** Throws when the member can't act right now (suspended by the team or after too many withdrawals). */
  assertActive(m: MemberRow) {
    if (m.status === 'suspended' || (m.suspended_until && m.suspended_until > new Date())) {
      throw new TraikuError(TraikuError.Types.NOT_ALLOWED, 'Votre compte est suspendu pour le moment. Contactez le support.', 'member_suspended');
    }
  }

  /** A new rating: the average is recomputed from the count, without reading every review. */
  async addRating(id: string, rating: number) {
    const m = await this.retrieveMember(id);
    const count = m.rating_count + 1;
    return this.updateMembers({ id, rating_count: count, rating_avg: (m.rating_avg * m.rating_count + rating) / count });
  }
}
