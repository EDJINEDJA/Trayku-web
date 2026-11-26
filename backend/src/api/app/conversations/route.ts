import type { AuthenticatedTraikuRequest, TraikuResponse } from '@traiku/framework/http';
import { CONVERSATION_MODULE, type ConversationModuleService } from '../../../modules/conversation';
import { MISSION_MODULE, type MissionModuleService } from '../../../modules/mission';
import { publicMembers } from '../../utils/serialize';

/** My conversations, the latest message first, with the other person and the unread count. */
export const GET = async (req: AuthenticatedTraikuRequest, res: TraikuResponse) => {
  const me = req.auth_context.actor_id;
  const svc = req.scope.resolve<ConversationModuleService>(CONVERSATION_MODULE);
  const list = await svc.listConversations({ $or: [{ member_a: me }, { member_b: me }] }, { take: 100, order: { updated_at: 'DESC' } });
  const messages = list.length ? await svc.listMessages({ conversation_id: list.map((c) => c.id) }, { order: { created_at: 'DESC' }, take: 2000 }) : [];
  const missions = list.length ? await req.scope.resolve<MissionModuleService>(MISSION_MODULE).listMissions({ id: list.map((c) => c.mission_id) }, { select: ['id', 'title'], withDeleted: true }) : [];
  const people = await publicMembers(
    req.scope,
    list.map((c) => (c.member_a === me ? c.member_b : c.member_a))
  );
  const rows = list.map((c) => {
    const mine = messages.filter((m) => m.conversation_id === c.id);
    return {
      id: c.id,
      mission: missions.find((m) => m.id === c.mission_id) ?? null,
      with: people[c.member_a === me ? c.member_b : c.member_a] ?? null,
      last_message: mine[0] ? { body: mine[0].body, kind: mine[0].kind, created_at: mine[0].created_at, mine: mine[0].sender_id === me } : null,
      unread: mine.filter((m) => m.sender_id && m.sender_id !== me && !m.read_at).length,
      blocked: !!c.blocked_by,
    };
  });
  rows.sort((a, b) => (b.last_message?.created_at.getTime() ?? 0) - (a.last_message?.created_at.getTime() ?? 0));
  res.json({ conversations: rows });
};
