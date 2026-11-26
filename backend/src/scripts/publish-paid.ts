import type { AwilixContainer } from 'awilix';
import { createMissionWorkflow, type CreateMissionInput } from '../workflows/missions/create-mission';
import { payMissionWorkflow } from '../workflows/payments';

/** Development data: published, then paid with the test payment (nothing charged), so it is shown. */
export async function publishPaid(container: AwilixContainer, input: CreateMissionInput) {
  const { result: mission } = await createMissionWorkflow(container).run({ input });
  await payMissionWorkflow(container).run({ input: { mission_id: mission.id, requester_id: input.requester_id, provider_id: 'system', base_url: 'http://localhost' } });
  return mission;
}
