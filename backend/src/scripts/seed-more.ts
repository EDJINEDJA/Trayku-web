import type { AwilixContainer } from 'awilix';
import { ContainerRegistrationKeys, type Logger } from '@traiku/framework';
import { MEMBER_MODULE, type MemberModuleService } from '../modules/member';
import { MISSION_MODULE, type MissionModuleService } from '../modules/mission';
import type { CreateMissionInput } from '../workflows/missions/create-mission';
import { publishPaid } from './publish-paid';

/**
 * Development data, after `seed`: more open missions: around Lyon (a check before buying, one due
 * within a few hours for Express) and one in Marseille. Each is added once, by its title.
 */
export default async function seedMore({ container }: { container: AwilixContainer }) {
  const logger = container.resolve<Logger>(ContainerRegistrationKeys.LOGGER);
  const members = container.resolve<MemberModuleService>(MEMBER_MODULE);
  const missions = container.resolve<MissionModuleService>(MISSION_MODULE);

  const idOf = async (phone: string) => {
    const [m] = await members.listMembers({ phone }, { take: 1 });
    if (!m) throw new Error(`Compte ${phone} introuvable : lancez d’abord npm run seed.`);
    return m.id;
  };
  const chloe = await idOf('+33600000001');
  const ines = await idOf('+33600000003');
  const place = (label: string, city: string, latitude: number, longitude: number) => ({ label, city, latitude, longitude });
  const inHours = (h: number) => new Date(Date.now() + h * 3600000);

  const list: CreateMissionInput[] = [
    {
      requester_id: ines,
      mode: 'onsite',
      type: 'check',
      category: 'check',
      catalog_id: 'check-phone',
      title: 'Vélo de ville d’occasion',
      description: 'Vérifier les freins, les vitesses et l’état du cadre avant que je l’achète.',
      pickup: place('15 rue Paul Bert, 69003 Lyon', 'Lyon 3e', 45.7597, 4.8497),
      deadline: inHours(72),
      seller: { pseudo: 'julien.velo', phone: '+33600000011' },
      listing: { brand: 'Décathlon', model: 'Elops 520', condition: 'good', defects: 'Selle usée' },
      min_photos: 6,
      price: 12,
    },
    {
      requester_id: chloe,
      type: 'parcel',
      category: 'transfer',
      catalog_id: 'colis-carton',
      title: 'Clés à déposer ce soir',
      description: 'Un trousseau de clés dans une enveloppe, à remettre en main propre.',
      size: 'S',
      weight_kg: 1,
      pickup: place('2 place Jean Macé, 69007 Lyon', 'Lyon 7e', 45.7458, 4.8418),
      dropoff: place('10 quai Saint-Vincent, 69001 Lyon', 'Lyon 1er', 45.7686, 4.8237),
      deadline: inHours(5),
      recipient_name: 'Paul',
      recipient_phone: '+33600000012',
      price: 10,
    },
    {
      requester_id: chloe,
      type: 'parcel',
      category: 'transfer',
      catalog_id: 'colis-carton',
      title: 'Carton de vaisselle',
      description: 'Un carton bien protégé, à poser à plat.',
      size: 'L',
      weight_kg: 5,
      pickup: place('20 rue de la République, 13002 Marseille', 'Marseille 2e', 43.2991, 5.3698),
      dropoff: place('5 avenue du Prado, 13006 Marseille', 'Marseille 6e', 43.2853, 5.3837),
      deadline: inHours(48),
      recipient_name: 'Nora',
      recipient_phone: '+33600000013',
      price: 14,
    },
  ];
  let added = 0;
  for (const input of list) {
    if ((await missions.listMissions({ title: input.title }, { take: 1 })).length) continue;
    await publishPaid(container, input);
    added++;
  }
  logger.info(`${added} mission(s) de démo ajoutée(s).`);
}
