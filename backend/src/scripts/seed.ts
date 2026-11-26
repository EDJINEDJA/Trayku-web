import type { AwilixContainer } from 'awilix';
import { ContainerRegistrationKeys, Modules, type ApiKeyModuleService, type AuthModuleService, type Logger } from '@traiku/framework';
import { MEMBER_MODULE, type MemberModuleService } from '../modules/member';
import { MISSION_MODULE, type MissionModuleService } from '../modules/mission';
import { createMemberWorkflow } from '../workflows/members/create-member';
import { createRegionsWorkflow } from '../workflows/regions';
import { listRegions, REGION_SEED } from '../lib/regions';
import type { CreateMissionInput } from '../workflows/missions/create-mission';
import { publishPaid } from './publish-paid';

/**
 * Development data: the app's publishable key, the regions and their currencies, three members (they sign in with their phone, the
 * code shows in the server log) and a few open missions around Lyon. Runs again without duplicating.
 */
export default async function seed({ container }: { container: AwilixContainer }) {
  const logger = container.resolve<Logger>(ContainerRegistrationKeys.LOGGER);
  const keys = container.resolve<ApiKeyModuleService>(Modules.API_KEY);
  const auth = container.resolve<AuthModuleService>(Modules.AUTH);
  const members = container.resolve<MemberModuleService>(MEMBER_MODULE);

  const [existing] = await keys.listApiKeys({ type: 'publishable', revoked_at: null, title: 'App mobile' }, { take: 1 });
  const pk = existing?.token ?? (await keys.generate({ title: 'App mobile', type: 'publishable', created_by: 'seed' })).token;
  logger.info(`Clé publique de l’app : ${pk}`);

  // The regions, as Medusa's seed: those missing are created, the others left as the team set them.
  const existingRegions = await listRegions(container);
  const missing = REGION_SEED.filter((r) => !existingRegions.some((e) => e.name === r.name));
  if (missing.length) await createRegionsWorkflow(container).run({ input: { regions: missing } });
  logger.info(`${existingRegions.length + missing.length} régions (${missing.length} créées).`);

  const people = [
    { phone: '+33600000001', first_name: 'Chloé', civility: 'mme' as const, vehicle: 'transit' as const },
    { phone: '+33600000002', first_name: 'Karim', civility: 'm' as const, vehicle: 'car' as const },
    { phone: '+33600000003', first_name: 'Inès', civility: 'mme' as const, vehicle: 'bike' as const },
  ];
  const ids: Record<string, string> = {};
  for (const p of people) {
    const [found] = await members.listMembers({ phone: p.phone }, { take: 1 });
    if (found) {
      ids[p.first_name] = found.id;
      continue;
    }
    const identity = await auth.createAuthIdentities({ app_metadata: {} });
    await auth.createProviderIdentities({ provider: 'phone-otp', entity_id: p.phone, auth_identity_id: identity.id });
    const { result } = await createMemberWorkflow(container).run({ input: { ...p, auth_identity_id: identity.id } });
    ids[p.first_name] = result.id;
  }
  // The demo accounts are already through sign-up (identity checked, trade answered, zone in Lyon),
  // to try the app at once; a new phone number goes through it all.
  for (const id of Object.values(ids)) {
    const m = await members.retrieveMember(id);
    await members.updateMembers({
      id,
      verified_id: true,
      professions_answered_at: m.professions_answered_at ?? new Date(),
      zone: m.zone ?? { label: 'Lyon', latitude: 45.764, longitude: 4.8357, radius_km: 20 },
    });
  }
  // Karim holds the verification certificate.
  await members.updateMembers({ id: ids.Karim, verifier: { via: 'test', since: new Date().toISOString() }, verified_id: true, rating_avg: 4.8, rating_count: 23, missions_done: 31 });

  const missions = container.resolve<MissionModuleService>(MISSION_MODULE);
  if ((await missions.listMissions({}, { take: 1 })).length) {
    logger.info('Missions déjà présentes : rien d’ajouté.');
    return;
  }

  const inDays = (d: number, h = 18) => {
    const t = new Date();
    t.setDate(t.getDate() + d);
    t.setHours(h, 0, 0, 0);
    return t;
  };
  const place = (label: string, city: string, latitude: number, longitude: number) => ({ label, city, latitude, longitude });

  const list: CreateMissionInput[] = [
    {
      requester_id: ids.Chloé,
      type: 'parcel',
      category: 'transfer',
      catalog_id: 'colis-carton',
      title: 'Colis pour ma sœur',
      description: 'Un carton de livres, bien fermé.',
      size: 'M',
      weight_kg: 6,
      pickup: place('12 rue Garibaldi, 69006 Lyon', 'Lyon 6e', 45.7701, 4.8519),
      dropoff: place('4 place Bellecour, 69002 Lyon', 'Lyon 2e', 45.7578, 4.8320),
      deadline: inDays(2),
      recipient_name: 'Léa',
      recipient_phone: '+33600000009',
      price: 9,
    },
    {
      requester_id: ids.Chloé,
      type: 'pickup',
      category: 'clickcollect',
      catalog_id: 'clickcollect-drive',
      title: 'Retrait IKEA',
      description: 'Une étagère en carton plat, 18 kg.',
      size: 'L',
      weight_kg: 18,
      pickup: place('IKEA Lyon Vénissieux', 'Vénissieux', 45.7192, 4.8862),
      dropoff: place('25 cours Émile Zola, 69100 Villeurbanne', 'Villeurbanne', 45.7699, 4.8794),
      deadline: inDays(3),
      order: { store: 'IKEA Vénissieux', name: 'Chloé Martin', ref: 'IK-48213', bags: '1', heavy: true },
      price: 16,
    },
    {
      requester_id: ids.Inès,
      type: 'check',
      category: 'checkpickup',
      catalog_id: 'check-phone',
      title: 'iPhone 12 d’occasion',
      description: 'Vérifier que la batterie est bien à 85 %, comme annoncé.',
      pickup: place('8 avenue Franklin Roosevelt, 69500 Bron', 'Bron', 45.7381, 4.9137),
      dropoff: place('3 rue Jules Ferry, 69800 Saint-Priest', 'Saint-Priest', 45.6967, 4.9439),
      deadline: inDays(4),
      purchase: { url: 'https://www.leboncoin.fr/', price: 210, payment: 'transfer' },
      seller: { pseudo: 'tom.69', phone: '+33600000010' },
      listing: { brand: 'Apple', model: 'iPhone 12 64 Go', condition: 'good', defects: 'Coin écorné' },
      inspect_kind: 'phone',
      min_photos: 6,
      price: 15,
      verify_only_price: 8,
    },
    {
      requester_id: ids.Inès,
      mode: 'onsite',
      type: 'task',
      category: 'assistance',
      catalog_id: 'job-montage-meuble',
      title: 'Monter une armoire',
      description: 'Armoire deux portes, notice et vis fournies.',
      pickup: place('40 rue de la République, 69002 Lyon', 'Lyon 2e', 45.7606, 4.8357),
      deadline: inDays(5, 20),
      window_start: inDays(5, 14),
      onsite_minutes: 90,
      proof: 'photo',
      price: 27,
    },
  ];
  for (const input of list) await publishPaid(container, input);
  logger.info(`${list.length} missions de démo publiées. Comptes : ${people.map((p) => `${p.first_name} ${p.phone}`).join(', ')}.`);
}
