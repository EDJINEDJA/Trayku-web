import type { AuthenticatedTraikuRequest, TraikuResponse } from '@traiku/framework/http';
import { CONVERSATION_MODULE, type ConversationModuleService } from '../../../../modules/conversation';
import { MISSION_MODULE, type MissionModuleService } from '../../../../modules/mission';
import { fileUrls, photoIdsOf, publicMembers, serializeMission, serializeRun } from '../../../utils/serialize';
import { referenceSelfies } from '../../../utils/identity-views';

/** Everything on a mission for the support: its runs with their history and face checks, the disputes, the conversations. */
export const GET = async (req: AuthenticatedTraikuRequest, res: TraikuResponse) => {
  const svc = req.scope.resolve<MissionModuleService>(MISSION_MODULE);
  const mission = await svc.retrieveMission(String(req.params.id), { relations: ['runs.events', 'disputes'] });
  const runs = (mission.runs ?? []) as unknown as Awaited<ReturnType<MissionModuleService['retrieveRun']>>[];
  const conversations = await req.scope.resolve<ConversationModuleService>(CONVERSATION_MODULE).listConversations({ mission_id: mission.id });
  const people = await publicMembers(req.scope, [mission.requester_id, ...runs.map((r) => r.traveler_id)]);
  const urls = await fileUrls(req.scope, [...photoIdsOf(mission), ...runs.flatMap((r) => photoIdsOf(mission, r))]);
  // The selfie each Traikeur was verified with, beside the face checks of the run.
  const selfies = await referenceSelfies(req.scope, runs.map((r) => r.traveler_id));
  res.json({
    mission: serializeMission(mission, 'admin', urls, { requester: people[mission.requester_id] }),
    runs: runs.map((r) => ({ ...serializeRun(r, 'admin', urls, people[r.traveler_id]), events: r.events ?? [], reference_selfie: selfies[r.traveler_id] ?? null })),
    disputes: mission.disputes ?? [],
    conversations: conversations.map((c) => ({ id: c.id, member_a: c.member_a, member_b: c.member_b, reported_at: c.reported_at, blocked_by: c.blocked_by })),
  });
};
