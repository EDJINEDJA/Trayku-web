import { emitEventStep, setAuthAppMetadataStep } from '@traiku/framework/core-flows';
import { createStep, createWorkflow, StepResponse, transform, WorkflowResponse } from '@traiku/framework/workflows';
import type { MemberRow } from '../../modules/member/service';
import { memberService } from '../steps';
import { countryFromPhone } from '../../lib/regions';

export type CreateMemberInput = {
  auth_identity_id: string;
  /** The phone the code was sent to: verified. */
  phone: string;
  first_name: string;
  last_name?: string | null;
  email?: string | null;
  civility?: 'mme' | 'm' | null;
  birth_date?: string | null;
  vehicle?: MemberRow['vehicle'];
  address?: MemberRow['address'];
  /** ISO code of the phone's country: the member's region. */
  country?: string | null;
};

const createMemberStep = createStep(
  'create-member',
  async (input: CreateMemberInput, ctx) => {
    const { auth_identity_id: _a, ...data } = input;
    void _a;
    // The country of the phone the code went to, when the app doesn't say (sign-up's country field).
    const member = await memberService(ctx).createMembers({ ...data, country: data.country ?? countryFromPhone(data.phone), first_name: data.first_name.trim(), verified_phone: true });
    return new StepResponse(member, member.id);
  },
  async (id, ctx) => {
    await memberService(ctx).deleteMembers(id);
  }
);

/** Registration: the member, tied to the phone's auth identity, as Medusa's createCustomerAccountWorkflow. */
export const createMemberWorkflow = createWorkflow('create-member', (input: CreateMemberInput) => {
  const member = createMemberStep(input);
  setAuthAppMetadataStep({ authIdentityId: input.auth_identity_id, actorType: 'member', value: member.id });
  emitEventStep({ eventName: 'member.created', data: transform({ member }, ({ member }) => ({ id: member.id })) });
  return new WorkflowResponse(member);
});
