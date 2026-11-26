import type { AwilixContainer } from 'awilix';
import { ContainerRegistrationKeys, type Logger } from '@traiku/framework';
import { MEMBER_MODULE, type MemberModuleService } from '../modules/member';
import { MISSION_MODULE, type MissionModuleService } from '../modules/mission';
import type { CreateMissionInput } from '../workflows/missions/create-mission';
import { publishPaid } from './publish-paid';

/**
 * Development data, after `seed`: one open mission per category, published by Chloé and Inès, for
 * Karim (the Traikeur with the certificate) to take and run through. Due in a few days, so they
 * don't expire during the tests. Run again: what is still open is kept, the rest published anew.
 */
export default async function seedTest({ container }: { container: AwilixContainer }) {
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
  const inDays = (d: number, h = 19) => {
    const t = new Date();
    t.setDate(t.getDate() + d);
    t.setHours(h, 0, 0, 0);
    return t;
  };

  const list: CreateMissionInput[] = [
    // Transport de colis
    {
      requester_id: ines,
      type: 'parcel',
      category: 'transfer',
      catalog_id: 'colis-carton',
      title: 'Test · Colis pour Lucas',
      description: 'Un carton de vêtements, pas fragile.',
      size: 'M',
      weight_kg: 5,
      pickup: place('9 rue Victor Hugo, 69002 Lyon', 'Lyon 2e', 45.7569, 4.8317),
      dropoff: place('60 avenue Lacassagne, 69003 Lyon', 'Lyon 3e', 45.7534, 4.8723),
      deadline: inDays(4),
      recipient_name: 'Lucas',
      recipient_phone: '+33600000019',
      price: 9,
    },
    {
      requester_id: chloe,
      type: 'parcel',
      category: 'transfer',
      catalog_id: 'colis-carton',
      title: 'Test · Carton de livres',
      description: 'Un carton fermé, à poser à plat.',
      size: 'M',
      weight_kg: 4,
      pickup: place('12 rue Garibaldi, 69006 Lyon', 'Lyon 6e', 45.7701, 4.8519),
      dropoff: place('4 place Bellecour, 69002 Lyon', 'Lyon 2e', 45.7578, 4.832),
      deadline: inDays(5),
      recipient_name: 'Léa',
      recipient_phone: '+33600000009',
      price: 10,
    },
    // Clic & Collect
    {
      requester_id: ines,
      type: 'pickup',
      category: 'clickcollect',
      catalog_id: 'clickcollect-drive',
      title: 'Test · Retrait Decathlon Part-Dieu',
      description: 'Un sac de sport et une gourde.',
      size: 'M',
      weight_kg: 2,
      pickup: place('Decathlon Lyon Part-Dieu, 17 rue du Docteur Bouchut, 69003 Lyon', 'Lyon 3e', 45.7608, 4.8572),
      dropoff: place('40 rue de Marseille, 69007 Lyon', 'Lyon 7e', 45.7515, 4.8418),
      deadline: inDays(4),
      order: { store: 'Decathlon Lyon Part-Dieu', name: 'Inès Benali', ref: 'DK-58214', bags: '1', heavy: false },
      price: 11,
    },
    {
      requester_id: chloe,
      type: 'pickup',
      category: 'clickcollect',
      catalog_id: 'clickcollect-drive',
      title: 'Test · Retrait Fnac Bellecour',
      description: 'Un casque audio, petit sac.',
      size: 'S',
      weight_kg: 1,
      pickup: place('Fnac Lyon Bellecour, 85 rue de la République, 69002 Lyon', 'Lyon 2e', 45.7605, 4.8357),
      dropoff: place('25 cours Émile Zola, 69100 Villeurbanne', 'Villeurbanne', 45.7699, 4.8794),
      deadline: inDays(5),
      order: { store: 'Fnac Lyon Bellecour', name: 'Chloé Martin', ref: 'FN-20931', bags: '1', heavy: false },
      price: 12,
    },
    // Vérification avant achat, with a Vinted link (opens in the app's browser)
    {
      requester_id: ines,
      mode: 'onsite',
      type: 'check',
      category: 'check',
      catalog_id: 'verif-vetements',
      title: 'Test · Veste en cuir Vinted',
      description: 'Vérifier les coutures et la doublure, et que la taille est bien un M.',
      pickup: place('15 rue Paul Bert, 69003 Lyon', 'Lyon 3e', 45.7597, 4.8497),
      deadline: inDays(6),
      purchase: { url: 'https://www.vinted.fr/' },
      seller: { pseudo: 'marie.vintage', phone: '+33600000014' },
      listing: {
        brand: 'Schott',
        model: 'Perfecto',
        condition: 'very_good',
        defects: 'Petite rayure sur la manche',
        specs: [
          { id: 'type', label: 'Catégorie', value: 'Vêtements' },
          { id: 'universe', label: 'Univers', value: 'Homme' },
          { id: 'size', label: 'Taille', value: 'M' },
        ],
      },
      inspect_kind: 'clothes',
      price: 12,
    },
    // Vérification et retrait
    {
      requester_id: ines,
      type: 'check',
      category: 'checkpickup',
      catalog_id: 'check-phone',
      title: 'Test · iPhone 13 d’occasion',
      description: 'Vérifier la batterie (au moins 85 %) et Face ID, puis le rapporter si tout va bien.',
      pickup: place('8 avenue Franklin Roosevelt, 69500 Bron', 'Bron', 45.7381, 4.9137),
      dropoff: place('3 rue Jules Ferry, 69800 Saint-Priest', 'Saint-Priest', 45.6967, 4.9439),
      deadline: inDays(6),
      purchase: { url: 'https://www.leboncoin.fr/' },
      seller: { pseudo: 'tom.69', phone: '+33600000010' },
      listing: { brand: 'Apple', model: 'iPhone 13 128 Go', condition: 'good', defects: 'Coin écorné' },
      inspect_kind: 'phone',
      min_photos: 6,
      price: 18,
      verify_only_price: 9,
    },
    // Vérifications avant achat, one per kind of object: a car, a phone, a laptop, a console, a motorbike.
    {
      requester_id: ines,
      mode: 'onsite',
      type: 'check',
      category: 'check',
      catalog_id: 'verif-voiture',
      title: 'Test · Peugeot 208 d’occasion',
      description: 'Vérifier la carrosserie, les pneus, le moteur à froid et faire un essai si le vendeur accepte.',
      pickup: place('22 avenue Jean Jaurès, 69007 Lyon', 'Lyon 7e', 45.7489, 4.8432),
      deadline: inDays(6),
      purchase: { url: 'https://www.leboncoin.fr/' },
      seller: { pseudo: 'auto.lyon7', phone: '+33600000015' },
      listing: {
        brand: 'Peugeot',
        model: '208',
        condition: 'good',
        defects: 'Rayure sur le pare-choc arrière',
        specs: [
          { id: 'fuel', label: 'Carburant', value: 'Essence' },
          { id: 'gearbox', label: 'Boîte de vitesse', value: 'Manuelle' },
          { id: 'registered', label: 'Mise en circulation', value: '2019' },
          { id: 'mileage', label: 'Kilométrage', value: '78 000 km' },
          { id: 'ct', label: 'Contrôle technique', value: 'Valide' },
        ],
      },
      inspect_kind: 'vehicle',
      min_photos: 12,
      price: 35,
    },
    // A car to see the electric one's battery, the automatic gearbox and the electronic diagnosis (OBD, +30 €).
    {
      requester_id: ines,
      mode: 'onsite',
      type: 'check',
      category: 'check',
      catalog_id: 'verif-voiture',
      title: 'Test · Tesla Model 3 électrique',
      description: 'Surtout l’état de la batterie et l’autonomie. Diagnostic électronique demandé.',
      pickup: place('8 cours Charlemagne, 69002 Lyon', 'Lyon 2e', 45.7466, 4.8257),
      deadline: inDays(6),
      purchase: { url: 'https://www.leboncoin.fr/' },
      seller: { pseudo: 'elec.lyon', phone: '+33600000017' },
      listing: {
        brand: 'Tesla',
        model: 'Model 3 Grande Autonomie',
        condition: 'very_good',
        defects: 'Petite rayure sur la jante avant droite',
        specs: [
          { id: 'fuel', label: 'Carburant', value: 'Électrique' },
          { id: 'gearbox', label: 'Boîte de vitesse', value: 'Automatique' },
          { id: 'registered', label: 'Mise en circulation', value: '2021' },
          { id: 'mileage', label: 'Kilométrage', value: '64 000 km' },
          { id: 'ct', label: 'Contrôle technique', value: 'Valide' },
        ],
      },
      inspect_kind: 'vehicle',
      obd_diagnostic: true,
      price: 65,
    },
    // A recent iPhone, at a seller's: the iPhone protocol straight away (Apple in the brand).
    {
      requester_id: chloe,
      mode: 'onsite',
      type: 'check',
      category: 'check',
      catalog_id: 'verif-telephone',
      title: 'Test · iPhone 15 Pro 256 Go',
      description: 'Vérifier la batterie, Face ID et que l’iPhone n’est pas bloqué iCloud.',
      pickup: place('30 rue Mercière, 69002 Lyon', 'Lyon 2e', 45.7622, 4.8326),
      deadline: inDays(5),
      purchase: { url: 'https://www.leboncoin.fr/' },
      seller: { pseudo: 'iphone.lyon2', phone: '+33600000018' },
      listing: {
        brand: 'Apple',
        model: 'iPhone 15 Pro',
        condition: 'very_good',
        defects: 'Micro-rayures sur le cadre',
        specs: [
          { id: 'storage', label: 'Capacité de stockage', value: '256 Go' },
          { id: 'color', label: 'Couleur', value: 'Noir' },
        ],
      },
      inspect_kind: 'phone',
      price: 15,
    },
    {
      requester_id: chloe,
      mode: 'onsite',
      type: 'check',
      category: 'check',
      catalog_id: 'verif-telephone',
      title: 'Test · Samsung Galaxy S23',
      description: 'Vérifier l’écran, la batterie et que le téléphone n’est pas bloqué.',
      pickup: place('5 rue de la Charité, 69002 Lyon', 'Lyon 2e', 45.7563, 4.8325),
      deadline: inDays(5),
      purchase: { url: 'https://www.leboncoin.fr/' },
      seller: { pseudo: 'nico.tel', phone: '+33600000016' },
      listing: { brand: 'Samsung', model: 'Galaxy S23 128 Go', condition: 'very_good', defects: 'Aucun signalé' },
      inspect_kind: 'phone',
      min_photos: 6,
      price: 12,
    },
    {
      requester_id: ines,
      mode: 'onsite',
      type: 'check',
      category: 'check',
      catalog_id: 'verif-ordinateur',
      title: 'Test · MacBook Air M2',
      description: 'Vérifier le clavier, la batterie (cycles) et que le compte iCloud est bien retiré.',
      pickup: place('30 cours Lafayette, 69003 Lyon', 'Lyon 3e', 45.7636, 4.8452),
      deadline: inDays(6),
      purchase: { url: 'https://www.leboncoin.fr/' },
      seller: { pseudo: 'clara.mac', phone: '+33600000017' },
      listing: { brand: 'Apple', model: 'MacBook Air M2 256 Go', condition: 'good', defects: 'Petite marque sur le capot' },
      inspect_kind: 'computer',
      min_photos: 6,
      price: 15,
    },
    {
      requester_id: chloe,
      mode: 'onsite',
      type: 'check',
      category: 'check',
      catalog_id: 'verif-console',
      title: 'Test · PlayStation 5 et deux manettes',
      description: 'Lancer un jeu, tester les deux manettes et le lecteur de disque.',
      pickup: place('18 rue Bonnel, 69003 Lyon', 'Lyon 3e', 45.7612, 4.8486),
      deadline: inDays(5),
      purchase: { url: 'https://www.vinted.fr/' },
      seller: { pseudo: 'gamer.lyon', phone: '+33600000018' },
      listing: { brand: 'Sony', model: 'PlayStation 5 standard', condition: 'very_good', defects: 'Aucun signalé' },
      inspect_kind: 'console',
      min_photos: 6,
      price: 12,
    },
    {
      requester_id: ines,
      mode: 'onsite',
      type: 'check',
      category: 'check',
      catalog_id: 'verif-moto',
      title: 'Test · Yamaha MT-07',
      description: 'Vérifier la chaîne, les freins, les pneus et écouter le moteur au démarrage.',
      pickup: place('9 rue Paul Bert, 69100 Villeurbanne', 'Villeurbanne', 45.7667, 4.8803),
      deadline: inDays(7),
      purchase: { url: 'https://www.leboncoin.fr/' },
      seller: { pseudo: 'moto.villeurbanne', phone: '+33600000019' },
      listing: {
        brand: 'Yamaha',
        model: 'MT-07',
        condition: 'good',
        defects: 'Rétroviseur gauche rayé',
        specs: [
          { id: 'registered', label: 'Mise en circulation', value: '2020' },
          { id: 'mileage', label: 'Kilométrage', value: '21 000 km' },
          { id: 'licence', label: 'Permis', value: 'A2' },
        ],
      },
      inspect_kind: 'vehicle',
      min_photos: 10,
      price: 30,
    },
    // Assistance sur place
    {
      requester_id: ines,
      mode: 'onsite',
      type: 'task',
      category: 'assistance',
      catalog_id: 'job-montage-meuble',
      title: 'Test · Monter une commode',
      description: 'Commode trois tiroirs, notice et vis fournies.',
      pickup: place('40 rue de la République, 69002 Lyon', 'Lyon 2e', 45.7606, 4.8357),
      deadline: inDays(7, 20),
      window_start: inDays(7, 14),
      onsite_minutes: 60,
      proof: 'photo',
      price: 22,
    },
  ];

  let added = 0;
  for (const input of list) {
    if ((await missions.listMissions({ title: input.title, status: ['open', 'review', 'accepted', 'picked_up'] }, { take: 1 })).length) continue;
    try {
      await publishPaid(container, input);
      added++;
    } catch (e) {
      logger.error(`« ${input.title} » non publiée : ${(e as Error).message}`);
    }
  }
  logger.info(`${added} mission(s) de test publiée(s). Traikeur : Karim +33600000002 (code de connexion dans le journal du serveur).`);
}
