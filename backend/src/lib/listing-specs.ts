/**
 * What the requester fills in about the object, by kind of product (the app's catalogue keys:
 * « telephone », « ordinateur »…), after the criteria of the classifieds sites: enough for the
 * Traikeur to know what he checks. Marque, Modèle, État and the defects are asked for every
 * product apart; these come after (unless `lead`). Only those marked `required` must be filled. Served by GET /app/reference.
 */
export type ListingSpec = (
  | { id: string; label: string; kind: 'text'; placeholder?: string }
  | { id: string; label: string; kind: 'number'; unit?: string; placeholder?: string }
  | {
      id: string;
      label: string;
      kind: 'choice';
      options: string[];
      /** Picked in a sheet, one per line, rather than among buttons in the page. */
      sheet?: boolean;
      /** A last line of the sheet that opens a field, for what the list doesn't hold (« Plus de 512 Go »). */
      other?: { label: string; placeholder?: string };
    }
  /** Oui or Non, with a switch: left off, it says Non. */
  | { id: string; label: string; kind: 'toggle' }
  /** A year, on a wheel in a sheet: this year down to 30 years back. */
  | { id: string; label: string; kind: 'year' }
) & {
  /** Asked only once other fields hold one of these values (all of them, when several). */
  when?: { id: string; in: string[] } | { id: string; in: string[] }[];
  /** Must be filled to go on (« Pointure * »). */
  required?: boolean;
  /** Asked before Marque (Univers, Taille…), not after it. */
  lead?: boolean;
};

const YES_NO = ['Oui', 'Non'];
// A vehicle's history, upkeep and sticker: the same for a car and a motorbike.
const owners: ListingSpec = { id: 'owners', label: 'Historique du véhicule', kind: 'choice', options: ['Première main', 'Deuxième main', 'Plus de deux propriétaires', 'Inconnu'] };
const service: ListingSpec = {
  id: 'service',
  label: 'Entretien du véhicule',
  kind: 'choice',
  options: ['Carnet d’entretien à jour', 'Factures d’entretien', 'Entretien partiel', 'Inconnu'],
};
const critair: ListingSpec = { id: 'critair', label: 'Crit’Air', kind: 'choice', options: ['Crit’Air 0 (électrique)', 'Crit’Air 1', 'Crit’Air 2', 'Crit’Air 3', 'Crit’Air 4', 'Crit’Air 5', 'Non classé'] };
/** Asked only when `id` holds one of these values, with the other conditions given. */
const when = (id: string, values: string[], spec: ListingSpec, also: { id: string; in: string[] }[] = []): ListingSpec => ({ ...spec, when: [{ id, in: values }, ...also] });
const lead = (spec: ListingSpec): ListingSpec => ({ ...spec, lead: true });
/** Asked only for these types (the product's first field, « Type »). */
const only = (types: string[], spec: ListingSpec): ListingSpec => ({ ...spec, when: { id: 'type', in: types } });
const serial: ListingSpec = { id: 'serial', label: 'Numéro de série lisible', kind: 'toggle' };
const warranty: ListingSpec = { id: 'warranty', label: 'Sous garantie constructeur', kind: 'toggle' };
const PLATFORMS = ['PlayStation 5', 'PlayStation 4', 'Nintendo Switch 2', 'Nintendo Switch', 'Xbox Series', 'Xbox One', 'PC'];
const platform: ListingSpec = { id: 'platform', label: 'Plateforme', kind: 'choice', options: PLATFORMS, other: { label: 'Autre plateforme', placeholder: 'Ex: PlayStation 3' } };
const color: ListingSpec = {
  id: 'color',
  label: 'Couleur',
  kind: 'choice',
  options: ['Noir', 'Blanc', 'Gris', 'Argent', 'Or', 'Beige', 'Marron', 'Bleu', 'Rouge', 'Vert', 'Violet', 'Rose', 'Jaune', 'Orange'],
  other: { label: 'Autre couleur', placeholder: 'Ex: bleu nuit' },
};
const year = (label = 'Année d’achat'): ListingSpec => ({ id: 'year', label, kind: 'year' });
const invoice: ListingSpec = { id: 'invoice', label: 'Facture d’origine', kind: 'choice', options: YES_NO };

const SPECS: Record<string, ListingSpec[]> = {
  // Électronique
  // As Leboncoin asks for a phone: Marque and Modèle (apart), then these, then the condition.
  telephone: [
    color,
    {
      id: 'storage',
      label: 'Capacité de stockage',
      kind: 'choice',
      sheet: true,
      options: ['16 Go', '32 Go', '64 Go', '128 Go', '256 Go', '512 Go'],
      other: { label: 'Plus de 512 Go', placeholder: 'Ex: 1 To' },
    },
    year('Année de fabrication'),
    { id: 'serial', label: 'Numéro de série lisible', kind: 'toggle' },
    { id: 'warranty', label: 'Sous garantie constructeur', kind: 'toggle' },
    { id: 'simlock', label: 'Simlocké', kind: 'toggle' },
  ],
  // As Leboncoin asks for a tablet or an e-reader: Marque (apart), then these, then the condition.
  tablette: [
    {
      id: 'screen',
      label: 'Taille de l’écran',
      kind: 'choice',
      options: ['6 pouces', '7 pouces', '8 pouces', '8,3 pouces', '10,2 pouces', '10,9 pouces', '11 pouces', '12,4 pouces', '12,9 pouces', '13 pouces'],
      other: { label: 'Autre taille', placeholder: 'Ex: 14,6 pouces' },
    },
    {
      id: 'storage',
      label: 'Capacité de stockage',
      kind: 'choice',
      options: ['8 Go', '16 Go', '32 Go', '64 Go', '128 Go', '256 Go', '512 Go', '1 To'],
      other: { label: 'Autre capacité', placeholder: 'Ex: 2 To' },
    },
    year('Année de fabrication'),
    { id: 'warranty', label: 'Sous garantie constructeur', kind: 'toggle' },
    color,
  ],
  // As Leboncoin asks for a computer: Marque (apart), then these, then the condition.
  ordinateur: [
    {
      id: 'os',
      label: 'Système d’exploitation',
      kind: 'choice',
      options: ['Windows 11', 'Windows 10', 'macOS', 'Linux', 'ChromeOS', 'Sans système'],
      other: { label: 'Autre système', placeholder: 'Ex: Windows 7' },
    },
    {
      id: 'storage',
      label: 'Capacité de stockage',
      kind: 'choice',
      options: ['128 Go', '256 Go', '512 Go', '1 To', '2 To', '4 To'],
      other: { label: 'Autre capacité', placeholder: 'Ex: 500 Go' },
    },
    {
      id: 'ram',
      label: 'RAM',
      kind: 'choice',
      options: ['4 Go', '8 Go', '16 Go', '18 Go', '24 Go', '32 Go', '64 Go'],
      other: { label: 'Autre quantité', placeholder: 'Ex: 12 Go' },
    },
    {
      id: 'cpu',
      label: 'Processeur',
      kind: 'choice',
      options: [
        'Apple M4',
        'Apple M3',
        'Apple M2',
        'Apple M1',
        'Intel Core Ultra',
        'Intel Core i9',
        'Intel Core i7',
        'Intel Core i5',
        'Intel Core i3',
        'Intel Celeron, Pentium',
        'AMD Ryzen 9',
        'AMD Ryzen 7',
        'AMD Ryzen 5',
        'AMD Ryzen 3',
        'Snapdragon X',
      ],
      other: { label: 'Autre processeur', placeholder: 'Ex: Intel Xeon' },
    },
    {
      id: 'screen',
      label: 'Taille d’écran',
      kind: 'choice',
      options: ['11,6 pouces', '13,3 pouces', '13,6 pouces', '14 pouces', '15,3 pouces', '15,6 pouces', '16 pouces', '17,3 pouces', '24 pouces', '27 pouces'],
      other: { label: 'Autre taille', placeholder: 'Ex: 32 pouces' },
    },
    { id: 'keyboard', label: 'Disposition du clavier', kind: 'choice', options: ['AZERTY', 'QWERTY', 'QWERTZ'], other: { label: 'Autre disposition', placeholder: 'Ex: BÉPO' } },
    { id: 'charger', label: 'Chargeur inclus', kind: 'toggle' },
    { id: 'usage', label: 'Usage', kind: 'choice', options: ['Gaming', 'Polyvalent', 'Bureautique'] },
  ],
  // Jeux vidéo et accessoires: the type first, then what matters for it.
  console: [
    { id: 'type', label: 'Type', kind: 'choice', options: ['Console', 'Jeu vidéo', 'Manette', 'Casque gaming', 'Simulateur', 'Réalité virtuelle', 'Accessoire'] },
    only(['Console'], {
      id: 'edition',
      label: 'Version',
      kind: 'choice',
      options: ['Standard', 'Digital (sans lecteur)', 'Slim', 'Pro', 'OLED', 'Lite', 'Édition limitée'],
      other: { label: 'Autre version', placeholder: 'Ex: Pack Fortnite' },
    }),
    only(['Jeu vidéo', 'Manette', 'Casque gaming', 'Simulateur', 'Accessoire'], platform),
    only(['Jeu vidéo'], { id: 'games', label: 'Titre du jeu', kind: 'text', placeholder: 'Ex: Mario Kart World' }),
    only(['Console', 'Réalité virtuelle'], {
      id: 'storage',
      label: 'Capacité de stockage',
      kind: 'choice',
      options: ['32 Go', '64 Go', '128 Go', '256 Go', '500 Go', '825 Go', '1 To', '2 To'],
      other: { label: 'Autre capacité', placeholder: 'Ex: 4 To' },
    }),
    only(['Manette', 'Casque gaming'], { id: 'wireless', label: 'Sans fil', kind: 'toggle' }),
    only(['Simulateur'], { id: 'included', label: 'Éléments inclus', kind: 'text', placeholder: 'Ex: volant, pédalier, levier de vitesse' }),
    only(['Console', 'Manette', 'Casque gaming', 'Réalité virtuelle', 'Accessoire'], color),
    only(['Console', 'Simulateur', 'Réalité virtuelle'], year('Année de fabrication')),
    only(['Console', 'Réalité virtuelle'], serial),
    only(['Console', 'Manette', 'Casque gaming', 'Simulateur', 'Réalité virtuelle'], warranty),
    only(['Console'], { id: 'pads', label: 'Manettes fournies', kind: 'choice', options: ['Aucune', '1', '2', '3', '4'], other: { label: 'Plus de 4', placeholder: 'Ex: 6' } }),
    only(['Console'], { id: 'bundled', label: 'Jeux fournis', kind: 'text', placeholder: 'Ex: FIFA 24, Mario Kart' }),
  ],
  // TV, vidéoprojecteur, son: the screen only for what has one.
  'tv-son': [
    { id: 'type', label: 'Type', kind: 'choice', options: ['Télévision', 'Vidéoprojecteur', 'Son et enceinte'] },
    only(['Télévision', 'Vidéoprojecteur'], {
      id: 'screen',
      label: 'Taille de l’écran',
      kind: 'choice',
      options: ['24 pouces', '32 pouces', '40 pouces', '43 pouces', '50 pouces', '55 pouces', '65 pouces', '75 pouces', '85 pouces'],
      other: { label: 'Autre taille', placeholder: 'Ex: 100 pouces' },
    }),
    only(['Télévision', 'Vidéoprojecteur'], { id: 'resolution', label: 'Résolution', kind: 'choice', options: ['HD', 'Full HD', '4K', '8K'] }),
    year('Année de fabrication'),
    serial,
    warranty,
    color,
  ],
  // Objets connectés: the same few questions for all.
  'objet-connecte': [
    { id: 'type', label: 'Type', kind: 'choice', options: ['Montre connectée', 'Décodeur et boîtier TV', 'Autre objet connecté'] },
    year('Année de fabrication'),
    serial,
    warranty,
    color,
  ],
  photo: [
    { id: 'type', label: 'Type', kind: 'choice', options: ['Reflex', 'Hybride', 'Compact', 'Objectif', 'Caméra', 'Drone'] },
    { id: 'shots', label: 'Nombre de déclenchements', kind: 'number', placeholder: 'Ex: 12 000' },
    { id: 'lens', label: 'Objectif fourni', kind: 'text', placeholder: 'Ex: 18-55 mm' },
    year(),
    invoice,
  ],
  // Maison et jardin
  // Ameublement: what helps to carry it (dismantled, weight), then what it's made of.
  meuble: [
    {
      id: 'type',
      label: 'Type',
      kind: 'choice',
      options: ['Canapé', 'Fauteuil', 'Table', 'Chaise', 'Armoire', 'Lit', 'Matelas', 'Commode', 'Bureau', 'Buffet', 'Étagère, bibliothèque', 'Meuble TV', 'Rangement'],
      other: { label: 'Autre meuble', placeholder: 'Ex: coiffeuse' },
    },
    { id: 'assembled', label: 'Démontable', kind: 'toggle' },
    { id: 'weight', label: 'Poids', kind: 'choice', options: ['Moins de 10 kg', '10 à 25 kg', '25 à 50 kg', '50 à 100 kg', 'Plus de 100 kg'] },
    {
      id: 'material',
      label: 'Matière',
      kind: 'choice',
      options: ['Bois massif', 'Bois aggloméré, MDF', 'Métal', 'Verre', 'Tissu', 'Cuir', 'Simili cuir', 'Rotin, osier', 'Plastique', 'Marbre, pierre'],
      other: { label: 'Autre matière', placeholder: 'Ex: velours' },
    },
    color,
  ],
  // Électroménager: the family, then the product in it; how it's installed and its label for the big ones.
  electromenager: [
    { id: 'type', label: 'Type', kind: 'choice', options: ['Gros électroménager', 'Cuisine et cuisson', 'Entretien de la maison', 'Beauté et soins personnels'], other: { label: 'Autre', placeholder: 'Ex: machine à coudre' } },
    lead(only(['Gros électroménager'], { id: 'product', label: 'Produit', kind: 'choice', options: ['Lave-linge', 'Sèche-linge', 'Lave-linge séchant', 'Lave-vaisselle', 'Réfrigérateur', 'Réfrigérateur américain', 'Congélateur', 'Cave à vin', 'Climatiseur mobile', 'Chauffe-eau'], other: { label: 'Autre produit', placeholder: 'Précisez' } })),
    lead(only(['Cuisine et cuisson'], { id: 'product', label: 'Produit', kind: 'choice', options: ['Cuisinière', 'Gazinière', 'Four', 'Four à micro-ondes', 'Plaque de cuisson', 'Hotte', 'Air fryer', 'Robot de cuisine', 'Robot pâtissier', 'Machine à café', 'Bouilloire', 'Grille-pain', 'Blender', 'Friteuse', 'Plancha électrique'], other: { label: 'Autre produit', placeholder: 'Précisez' } })),
    lead(only(['Entretien de la maison'], { id: 'product', label: 'Produit', kind: 'choice', options: ['Aspirateur', 'Aspirateur balai', 'Aspirateur robot', 'Nettoyeur vapeur', 'Fer à repasser', 'Centrale vapeur', 'Purificateur d’air', 'Déshumidificateur', 'Chauffage d’appoint', 'Ventilateur'], other: { label: 'Autre produit', placeholder: 'Précisez' } })),
    lead(only(['Beauté et soins personnels'], { id: 'product', label: 'Produit', kind: 'choice', options: ['Sèche-cheveux', 'Lisseur', 'Boucleur', 'Tondeuse', 'Rasoir électrique', 'Épilateur', 'Brosse à dents électrique', 'Pèse-personne'], other: { label: 'Autre produit', placeholder: 'Précisez' } })),
    { id: 'weight', label: 'Poids', kind: 'choice', options: ['Moins de 5 kg', '5 à 15 kg', '15 à 40 kg', '40 à 80 kg', 'Plus de 80 kg'] },
    color,
    year('Année de fabrication'),
    warranty,
    serial,
    only(['Gros électroménager', 'Cuisine et cuisson'], { id: 'install', label: 'Type de pose', kind: 'choice', options: ['Encastrable', 'Pose libre'] }),
    only(['Gros électroménager', 'Cuisine et cuisson'], { id: 'energy', label: 'Étiquette énergie', kind: 'choice', options: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'A+++ (ancienne étiquette)', 'A++ (ancienne étiquette)', 'A+ (ancienne étiquette)'] }),
  ],
  // Décoration: the universe, then the product in it; material, colour and style.
  deco: [
    { id: 'type', label: 'Univers', kind: 'choice', options: ['Éclairage', 'Décoration textile', 'Accessoire de rangement', 'Décoration murale', 'Objet décoratif'], other: { label: 'Autre', placeholder: 'Ex: art de la table' } },
    lead(only(['Éclairage'], { id: 'product', label: 'Produit', kind: 'choice', options: ['Lampe à poser', 'Lampadaire', 'Suspension', 'Lustre', 'Applique murale', 'Plafonnier', 'Lampe de chevet', 'Guirlande lumineuse', 'Spot'], other: { label: 'Autre produit', placeholder: 'Précisez' } })),
    lead(only(['Décoration textile'], { id: 'product', label: 'Produit', kind: 'choice', options: ['Tapis', 'Rideaux et voilages', 'Coussins', 'Plaid', 'Linge de lit', 'Nappe et linge de table', 'Paravent textile'], other: { label: 'Autre produit', placeholder: 'Précisez' } })),
    lead(only(['Accessoire de rangement'], { id: 'product', label: 'Produit', kind: 'choice', options: ['Panier et corbeille', 'Boîte de rangement', 'Porte-manteau', 'Étagère murale', 'Range-chaussures', 'Malle et coffre', 'Vide-poche'], other: { label: 'Autre produit', placeholder: 'Précisez' } })),
    lead(only(['Décoration murale'], { id: 'product', label: 'Produit', kind: 'choice', options: ['Tableau', 'Affiche et cadre', 'Miroir', 'Horloge', 'Sticker mural', 'Tapisserie murale', 'Patère'], other: { label: 'Autre produit', placeholder: 'Précisez' } })),
    lead(only(['Objet décoratif'], { id: 'product', label: 'Produit', kind: 'choice', options: ['Vase', 'Bougeoir et bougie', 'Statuette', 'Plante artificielle', 'Cache-pot', 'Photophore', 'Diffuseur de parfum', 'Boule à neige'], other: { label: 'Autre produit', placeholder: 'Précisez' } })),
    {
      id: 'material',
      label: 'Matière',
      kind: 'choice',
      options: ['Bois', 'Métal', 'Laiton, cuivre', 'Verre', 'Céramique, porcelaine', 'Tissu', 'Laine', 'Lin', 'Coton', 'Velours', 'Rotin, osier, jonc', 'Papier, carton', 'Plastique', 'Marbre, pierre'],
      other: { label: 'Autre matière', placeholder: 'Ex: résine' },
    },
    color,
    {
      id: 'style',
      label: 'Style',
      kind: 'choice',
      options: ['Moderne', 'Scandinave', 'Industriel', 'Bohème', 'Vintage', 'Classique', 'Campagne', 'Art déco', 'Minimaliste', 'Exotique', 'Japandi'],
      other: { label: 'Autre style', placeholder: 'Ex: baroque' },
    },
  ],
  // Bricolage, outillage: the family, then the tool; how it's powered for the electric ones.
  bricolage: [
    { id: 'type', label: 'Type', kind: 'choice', options: ['Chauffage et ventilation', 'Électricité, éclairage et domotique', 'Équipement et protection', 'Matériel de menuiserie', 'Matériaux de construction', 'Outils à main', 'Outils électroportatifs'], other: { label: 'Autre', placeholder: 'Ex: plomberie' } },
    lead(only(['Chauffage et ventilation'], { id: 'product', label: 'Produit', kind: 'choice', options: ['Radiateur électrique', 'Poêle à bois', 'Poêle à granulés', 'Chauffage d’appoint', 'Climatiseur', 'Ventilateur', 'VMC', 'Chaudière', 'Chauffe-eau'], other: { label: 'Autre produit', placeholder: 'Précisez' } })),
    lead(only(['Électricité, éclairage et domotique'], { id: 'product', label: 'Produit', kind: 'choice', options: ['Tableau électrique', 'Câbles et gaines', 'Prises et interrupteurs', 'Projecteur LED', 'Ampoules', 'Caméra de surveillance', 'Alarme', 'Interphone, visiophone', 'Thermostat connecté', 'Groupe électrogène'], other: { label: 'Autre produit', placeholder: 'Précisez' } })),
    lead(only(['Équipement et protection'], { id: 'product', label: 'Produit', kind: 'choice', options: ['Casque', 'Gants', 'Lunettes de protection', 'Chaussures de sécurité', 'Vêtements de travail', 'Échelle', 'Escabeau', 'Échafaudage', 'Établi', 'Servante d’atelier', 'Aspirateur d’atelier'], other: { label: 'Autre produit', placeholder: 'Précisez' } })),
    lead(only(['Matériel de menuiserie'], { id: 'product', label: 'Produit', kind: 'choice', options: ['Scie à onglet', 'Scie sur table', 'Défonceuse', 'Rabot', 'Toupie', 'Combiné à bois', 'Tour à bois', 'Serre-joints', 'Établi de menuisier'], other: { label: 'Autre produit', placeholder: 'Précisez' } })),
    lead(only(['Matériaux de construction'], { id: 'product', label: 'Produit', kind: 'choice', options: ['Parquet', 'Carrelage', 'Bois de construction', 'Plaques de plâtre', 'Isolant', 'Ciment et mortier', 'Briques et parpaings', 'Porte', 'Fenêtre', 'Peinture'], other: { label: 'Autre produit', placeholder: 'Précisez' } })),
    lead(only(['Outils à main'], { id: 'product', label: 'Produit', kind: 'choice', options: ['Caisse à outils', 'Coffret de douilles', 'Clés', 'Tournevis', 'Marteau', 'Pinces', 'Niveau', 'Mètre, télémètre', 'Scie à main'], other: { label: 'Autre produit', placeholder: 'Précisez' } })),
    lead(only(['Outils électroportatifs'], { id: 'product', label: 'Produit', kind: 'choice', options: ['Perceuse', 'Perceuse-visseuse', 'Perforateur', 'Visseuse à choc', 'Scie circulaire', 'Scie sauteuse', 'Scie sabre', 'Meuleuse', 'Ponceuse', 'Rabot électrique', 'Décapeur thermique', 'Compresseur', 'Nettoyeur haute pression', 'Poste à souder', 'Coffret multi-outils'], other: { label: 'Autre produit', placeholder: 'Précisez' } })),
    only(['Chauffage et ventilation', 'Matériel de menuiserie', 'Outils électroportatifs'], { id: 'power', label: 'Alimentation', kind: 'choice', options: ['Filaire', 'Batterie', 'Thermique', 'Gaz', 'Bois, granulés'] }),
    when('power', ['Batterie'], { id: 'volts', label: 'Tension de la batterie', kind: 'choice', options: ['10,8 V, 12 V', '18 V', '36 V', '54 V et plus'] }),
    when('power', ['Batterie'], { id: 'battery', label: 'Batteries et chargeur fournis', kind: 'toggle' }),
    only(['Matériaux de construction'], { id: 'quantity', label: 'Quantité', kind: 'text', placeholder: 'Ex: 25 m², 10 sacs, 3 portes' }),
    { id: 'weight', label: 'Poids', kind: 'choice', options: ['Moins de 2 kg', '2 à 5 kg', '5 à 15 kg', '15 à 40 kg', 'Plus de 40 kg'] },
    only(['Chauffage et ventilation', 'Matériel de menuiserie', 'Outils électroportatifs'], year('Année de fabrication')),
    only(['Chauffage et ventilation', 'Matériel de menuiserie', 'Outils électroportatifs'], warranty),
  ],
  // Jardin et plantes: the family, then the product; power for the engines, material for the furniture.
  jardin: [
    { id: 'type', label: 'Type', kind: 'choice', options: ['Aménagement extérieur', 'Barbecue et cuisson extérieure', 'Équipement du jardinier', 'Mobilier de jardin', 'Outils à main', 'Outils à moteur', 'Piscine et spa'], other: { label: 'Autre', placeholder: 'Ex: plantes' } },
    lead(only(['Aménagement extérieur'], { id: 'product', label: 'Produit', kind: 'choice', options: ['Abri de jardin', 'Pergola', 'Tonnelle', 'Clôture et grillage', 'Brise-vue', 'Dalles et pavés', 'Bordures', 'Carport', 'Portail', 'Éclairage extérieur'], other: { label: 'Autre produit', placeholder: 'Précisez' } })),
    lead(only(['Barbecue et cuisson extérieure'], { id: 'product', label: 'Produit', kind: 'choice', options: ['Barbecue charbon', 'Barbecue gaz', 'Barbecue électrique', 'Plancha', 'Four à pizza', 'Fumoir', 'Brasero'], other: { label: 'Autre produit', placeholder: 'Précisez' } })),
    lead(only(['Équipement du jardinier'], { id: 'product', label: 'Produit', kind: 'choice', options: ['Serre', 'Composteur', 'Récupérateur d’eau', 'Tuyau et dévidoir', 'Arrosage automatique', 'Pots et jardinières', 'Brouette', 'Bâche'], other: { label: 'Autre produit', placeholder: 'Précisez' } })),
    lead(only(['Mobilier de jardin'], { id: 'product', label: 'Produit', kind: 'choice', options: ['Salon de jardin', 'Table de jardin', 'Chaises et fauteuils', 'Bain de soleil', 'Hamac', 'Parasol', 'Balancelle', 'Banc'], other: { label: 'Autre produit', placeholder: 'Précisez' } })),
    lead(only(['Outils à main'], { id: 'product', label: 'Produit', kind: 'choice', options: ['Bêche', 'Râteau', 'Sécateur', 'Cisaille', 'Binette', 'Pelle', 'Fourche', 'Scie d’élagage'], other: { label: 'Autre produit', placeholder: 'Précisez' } })),
    lead(only(['Outils à moteur'], { id: 'product', label: 'Produit', kind: 'choice', options: ['Tondeuse', 'Tondeuse robot', 'Tracteur tondeuse', 'Taille-haie', 'Débroussailleuse', 'Coupe-bordure', 'Tronçonneuse', 'Souffleur', 'Motobineuse', 'Scarificateur', 'Broyeur', 'Fendeur de bûches'], other: { label: 'Autre produit', placeholder: 'Précisez' } })),
    lead(only(['Piscine et spa'], { id: 'product', label: 'Produit', kind: 'choice', options: ['Piscine hors-sol', 'Piscine gonflable', 'Spa gonflable', 'Spa rigide', 'Pompe et filtration', 'Robot de piscine', 'Bâche et couverture', 'Pompe à chaleur', 'Échelle de piscine'], other: { label: 'Autre produit', placeholder: 'Précisez' } })),
    only(['Outils à moteur'], { id: 'power', label: 'Alimentation', kind: 'choice', options: ['Électrique filaire', 'Batterie', 'Thermique'] }),
    when('power', ['Batterie'], { id: 'battery', label: 'Batteries et chargeur fournis', kind: 'toggle' }),
    only(['Mobilier de jardin'], {
      id: 'material',
      label: 'Matière',
      kind: 'choice',
      options: ['Bois', 'Teck', 'Métal', 'Aluminium', 'Résine', 'Rotin synthétique', 'Textilène'],
      other: { label: 'Autre matière', placeholder: 'Ex: fer forgé' },
    }),
    only(['Mobilier de jardin'], { id: 'seats', label: 'Nombre de places', kind: 'choice', options: ['1', '2', '4', '6', '8 et plus'] }),
    only(['Mobilier de jardin', 'Aménagement extérieur'], color),
    only(['Piscine et spa'], { id: 'capacity', label: 'Taille ou capacité', kind: 'text', placeholder: 'Ex: 4 × 2 m, 4 places' }),
    { id: 'weight', label: 'Poids', kind: 'choice', options: ['Moins de 5 kg', '5 à 15 kg', '15 à 40 kg', '40 à 100 kg', 'Plus de 100 kg'] },
    only(['Outils à moteur', 'Piscine et spa', 'Barbecue et cuisson extérieure'], year('Année de fabrication')),
    only(['Outils à moteur', 'Piscine et spa', 'Barbecue et cuisson extérieure'], warranty),
  ],
  // Mode
  // Mode: Vêtements or Chaussures first, then who it's for; each with its own type and size.
  vetements: [
    { id: 'type', label: 'Catégorie', kind: 'choice', options: ['Vêtements', 'Chaussures'] },
    lead({ id: 'universe', label: 'Univers', kind: 'choice', options: ['Femme', 'Homme', 'Enfant'] }),
    lead(
      only(['Vêtements'], {
        id: 'garment',
        label: 'Type de vêtement',
        kind: 'choice',
        options: [
          'Robes',
          'Jupes',
          'Manteaux et vestes',
          'Blazers et costumes',
          'Tailleurs',
          'Pulls et gilets',
          'Sweats et hoodies',
          'T-shirts et polos',
          'Chemises et blouses',
          'Tops et débardeurs',
          'Jeans',
          'Pantalons',
          'Shorts et bermudas',
          'Combinaisons',
          'Vêtements de sport',
          'Maillots de bain',
          'Lingerie et sous-vêtements',
          'Pyjamas et nuit',
          'Robes de mariée',
          'Vêtements de grossesse',
          'Déguisements',
          'Accessoires (écharpes, ceintures, chapeaux)',
        ],
        other: { label: 'Autre vêtement', placeholder: 'Ex: kimono' },
      })
    ),
    lead(when('type', ['Vêtements'], { id: 'size', label: 'Taille', kind: 'choice', options: ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', 'Taille unique'], other: { label: 'Autre taille', placeholder: 'Ex: 38, W32 L34' } }, [{ id: 'universe', in: ['Femme', 'Homme'] }])),
    lead(when('type', ['Vêtements'], { id: 'size', label: 'Taille', kind: 'choice', options: ['Naissance', '1 mois', '3 mois', '6 mois', '9 mois', '12 mois', '18 mois', '2 ans', '3 ans', '4 ans', '5 ans', '6 ans', '8 ans', '10 ans', '12 ans', '14 ans', '16 ans'], other: { label: 'Autre taille', placeholder: 'Ex: 7 ans' } }, [{ id: 'universe', in: ['Enfant'] }])),
    lead(
      only(['Chaussures'], {
        id: 'shoe',
        label: 'Type de chaussures',
        kind: 'choice',
        options: ['Baskets', 'Chaussures de ville', 'Bottes', 'Bottines', 'Escarpins', 'Sandales', 'Mocassins', 'Ballerines', 'Chaussures de sport', 'Tongs et claquettes', 'Espadrilles', 'Chaussons', 'Chaussures de sécurité'],
        other: { label: 'Autre type', placeholder: 'Ex: derbies' },
      })
    ),
    lead(when('type', ['Chaussures'], { id: 'shoesize', label: 'Pointure', kind: 'choice', options: ['35', '36', '37', '38', '39', '40', '41', '42', '43', '44', '45', '46', '47', '48'], other: { label: 'Autre pointure', placeholder: 'Ex: 42,5' }, required: true }, [{ id: 'universe', in: ['Femme', 'Homme'] }])),
    lead(when('type', ['Chaussures'], { id: 'shoesize', label: 'Pointure', kind: 'choice', options: ['16', '17', '18', '19', '20', '21', '22', '23', '24', '25', '26', '27', '28', '29', '30', '31', '32', '33', '34'], other: { label: 'Autre pointure', placeholder: 'Ex: 27,5' }, required: true }, [{ id: 'universe', in: ['Enfant'] }])),
    color,
  ],
  // Montre, bijou, sac: who for, the type, then its kind and material.
  luxe: [
    { id: 'type', label: 'Type', kind: 'choice', options: ['Montre', 'Bijou', 'Sac'] },
    lead({ id: 'universe', label: 'Univers', kind: 'choice', options: ['Femme', 'Homme', 'Mixte', 'Enfant'] }),
    lead(only(['Montre'], { id: 'watch', label: 'Type de montre', kind: 'choice', options: ['Automatique', 'Quartz', 'Mécanique à remontage manuel', 'Chronographe', 'Connectée'] })),
    lead(
      only(['Bijou'], {
        id: 'jewel',
        label: 'Type de bijou',
        kind: 'choice',
        options: ['Bague', 'Collier', 'Pendentif', 'Bracelet', 'Boucles d’oreilles', 'Broche', 'Parure', 'Chevalière', 'Piercing'],
        other: { label: 'Autre bijou', placeholder: 'Ex: chaîne de cheville' },
      })
    ),
    lead(
      only(['Sac'], {
        id: 'bag',
        label: 'Type de sac',
        kind: 'choice',
        options: ['Sac à main', 'Sac bandoulière', 'Sac à dos', 'Cabas', 'Pochette', 'Sac de voyage', 'Portefeuille et porte-cartes'],
        other: { label: 'Autre sac', placeholder: 'Ex: banane' },
      })
    ),
    only(['Montre'], { id: 'material', label: 'Matière', kind: 'choice', options: ['Acier', 'Or', 'Or et acier', 'Titane', 'Céramique', 'Platine', 'Plastique, résine'], other: { label: 'Autre matière', placeholder: 'Ex: bronze' } }),
    only(['Bijou'], {
      id: 'material',
      label: 'Matière',
      kind: 'choice',
      options: ['Or jaune', 'Or blanc', 'Or rose', 'Argent', 'Platine', 'Plaqué or', 'Acier', 'Fantaisie'],
      other: { label: 'Autre matière', placeholder: 'Ex: vermeil' },
    }),
    only(['Sac'], { id: 'material', label: 'Matière', kind: 'choice', options: ['Cuir', 'Cuir et toile', 'Toile', 'Daim', 'Synthétique', 'Tissu'], other: { label: 'Autre matière', placeholder: 'Ex: raphia' } }),
  ],
  // Loisirs
  // As the classifieds ask for a bike; the battery only for an electric one.
  velo: [
    { id: 'type', label: 'Type', kind: 'choice', options: ['Enfant', 'VTT', 'Vélo de loisir, VTC', 'Vélo de route', 'BMX', 'Vélo électrique', 'Vélo pliant'] },
    {
      id: 'wheels',
      label: 'Taille des roues',
      kind: 'choice',
      options: [
        '10 pouces (ETRTO 152)',
        '12 pouces (ETRTO 203)',
        '14 pouces (ETRTO 254)',
        '16 pouces (ETRTO 305)',
        '18 pouces (ETRTO 355)',
        '20 pouces (ETRTO 406)',
        '24 pouces (ETRTO 507)',
        '26 pouces (ETRTO 559)',
        '27,5 pouces, 650B (ETRTO 584)',
        '28 pouces, 700C (ETRTO 622)',
        '29 pouces (ETRTO 622)',
      ],
      other: { label: 'Autre taille', placeholder: 'Ex: 22 pouces' },
    },
    only(['Vélo électrique'], { id: 'battery', label: 'Batterie', kind: 'choice', options: ['300 Wh', '400 Wh', '500 Wh', '625 Wh', '750 Wh'], other: { label: 'Autre batterie', placeholder: 'Ex: 900 Wh' } }),
    color,
    { id: 'marking', label: 'Numéro d’immatriculation du vélo', kind: 'text', placeholder: 'Ex: numéro gravé Bicycode ou Paravol' },
  ],
  // Électrique or not: the motor's questions only for an electric one.
  trottinette: [
    { id: 'type', label: 'Type', kind: 'choice', options: ['Trottinette électrique', 'Trottinette mécanique', 'Trottinette enfant'] },
    only(['Trottinette électrique'], { id: 'power', label: 'Puissance du moteur', kind: 'choice', options: ['250 W', '350 W', '500 W', '800 W', '1000 W et plus'], other: { label: 'Autre puissance', placeholder: 'Ex: 2000 W' } }),
    only(['Trottinette électrique'], { id: 'range', label: 'Autonomie', kind: 'choice', options: ['20 km', '30 km', '40 km', '60 km', '80 km et plus'], other: { label: 'Autre autonomie', placeholder: 'Ex: 100 km' } }),
    only(['Trottinette électrique'], { id: 'speed', label: 'Vitesse maximale', kind: 'choice', options: ['20 km/h', '25 km/h', 'Plus de 25 km/h (non homologuée)'] }),
    {
      id: 'wheels',
      label: 'Taille des roues',
      kind: 'choice',
      options: ['5 pouces', '6 pouces', '8 pouces', '8,5 pouces', '9 pouces', '10 pouces', '11 pouces et plus'],
      other: { label: 'Autre taille', placeholder: 'Ex: 12 pouces' },
    },
    only(['Trottinette électrique'], { id: 'mileage', label: 'Kilométrage', kind: 'number', unit: 'km', placeholder: 'Ex: 800' }),
    color,
    year('Année de fabrication'),
    only(['Trottinette électrique'], serial),
    only(['Trottinette électrique'], warranty),
  ],
  // Sport, fitness: the type first; length for skis, the user's weight for a machine…
  sport: [
    {
      id: 'type',
      label: 'Type',
      kind: 'choice',
      options: ['Ski', 'Snowboard', 'Vélo d’appartement', 'Tapis de course', 'Rameur', 'Musculation', 'Tennis', 'Padel', 'Golf', 'Surf', 'Randonnée et camping', 'Sports de combat', 'Sports collectifs'],
      other: { label: 'Autre sport', placeholder: 'Ex: escalade' },
    },
    only(['Ski', 'Snowboard'], {
      id: 'length',
      label: 'Longueur',
      kind: 'choice',
      options: ['Moins de 130 cm', '130 cm', '140 cm', '150 cm', '160 cm', '170 cm', '180 cm', '190 cm et plus'],
      other: { label: 'Autre longueur', placeholder: 'Ex: 165 cm' },
    }),
    only(['Ski', 'Snowboard'], { id: 'bindings', label: 'Fixations fournies', kind: 'toggle' }),
    only(['Vélo d’appartement', 'Tapis de course', 'Rameur'], {
      id: 'maxweight',
      label: 'Poids maximal de l’utilisateur',
      kind: 'choice',
      options: ['100 kg', '110 kg', '120 kg', '130 kg', '150 kg et plus'],
    }),
    only(['Vélo d’appartement', 'Tapis de course', 'Rameur'], { id: 'foldable', label: 'Pliable', kind: 'toggle' }),
    only(['Vélo d’appartement', 'Tapis de course', 'Rameur'], { id: 'connected', label: 'Écran ou appli connectée', kind: 'toggle' }),
    only(['Musculation'], {
      id: 'load',
      label: 'Poids total',
      kind: 'choice',
      options: ['Moins de 10 kg', '10 à 20 kg', '20 à 50 kg', '50 à 100 kg', 'Plus de 100 kg'],
    }),
    only(['Tennis', 'Padel'], { id: 'grip', label: 'Taille du manche', kind: 'choice', options: ['L0', 'L1', 'L2', 'L3', 'L4', 'L5'] }),
    only(['Golf'], { id: 'set', label: 'Composition', kind: 'choice', options: ['Série complète', 'Demi-série', 'Club seul', 'Sac seul'] }),
    only(['Golf'], { id: 'hand', label: 'Gaucher', kind: 'toggle' }),
    only(['Surf'], {
      id: 'board',
      label: 'Taille de la planche',
      kind: 'choice',
      options: ['Moins de 6’', '6’ à 6’6', '6’6 à 7’', '7’ à 8’', '8’ à 9’', 'Plus de 9’'],
    }),
    only(['Vélo d’appartement', 'Tapis de course', 'Rameur', 'Ski', 'Snowboard'], year('Année de fabrication')),
    color,
  ],
  // Instrument de musique: the type first; strings, keys or watts as it has.
  instrument: [
    {
      id: 'type',
      label: 'Type',
      kind: 'choice',
      options: [
        'Guitare acoustique',
        'Guitare électrique',
        'Basse',
        'Piano',
        'Piano numérique',
        'Clavier, synthétiseur',
        'Batterie acoustique',
        'Batterie électronique',
        'Violon, violoncelle',
        'Instrument à vent',
        'Ampli, effets',
        'Matériel DJ, home studio',
      ],
      other: { label: 'Autre instrument', placeholder: 'Ex: ukulélé' },
    },
    only(['Guitare acoustique', 'Guitare électrique', 'Basse'], { id: 'strings', label: 'Nombre de cordes', kind: 'choice', options: ['4', '5', '6', '7', '12'] }),
    only(['Guitare acoustique', 'Guitare électrique', 'Basse'], { id: 'left', label: 'Gaucher', kind: 'toggle' }),
    only(['Piano numérique', 'Clavier, synthétiseur'], { id: 'keys', label: 'Nombre de touches', kind: 'choice', options: ['25', '49', '61', '76', '88'], other: { label: 'Autre nombre', placeholder: 'Ex: 37' } }),
    only(['Piano'], { id: 'piano', label: 'Type de piano', kind: 'choice', options: ['Piano droit', 'Piano à queue', 'Piano quart de queue'] }),
    only(['Violon, violoncelle'], { id: 'size', label: 'Taille', kind: 'choice', options: ['1/16', '1/8', '1/4', '1/2', '3/4', '4/4'] }),
    only(['Ampli, effets'], { id: 'watts', label: 'Puissance', kind: 'choice', options: ['Moins de 10 W', '10 à 30 W', '30 à 50 W', '50 à 100 W', 'Plus de 100 W'] }),
    only(['Guitare acoustique', 'Guitare électrique', 'Basse', 'Violon, violoncelle', 'Instrument à vent'], { id: 'case', label: 'Étui ou housse fourni', kind: 'toggle' }),
    only(['Guitare acoustique', 'Guitare électrique', 'Basse', 'Batterie acoustique', 'Ampli, effets'], color),
    year('Année de fabrication'),
    serial,
  ],
  // Jeux, jouets: the type first; pieces for a Lego or a puzzle, players for a board game.
  jouets: [
    {
      id: 'type',
      label: 'Type',
      kind: 'choice',
      options: ['Lego, construction', 'Jeu de société', 'Puzzle', 'Poupée, figurine', 'Peluche', 'Véhicule, circuit', 'Jeu d’éveil', 'Jeu de plein air', 'Jeu électronique'],
      other: { label: 'Autre jouet', placeholder: 'Ex: déguisement' },
    },
    { id: 'age', label: 'Âge conseillé', kind: 'choice', options: ['Dès la naissance', 'Dès 1 an', 'Dès 3 ans', 'Dès 6 ans', 'Dès 8 ans', 'Dès 12 ans', 'Adulte'], other: { label: 'Autre âge', placeholder: 'Ex: dès 10 ans' } },
    only(['Lego, construction'], { id: 'set', label: 'Numéro du set', kind: 'text', placeholder: 'Ex: 42143' }),
    only(['Lego, construction', 'Puzzle'], {
      id: 'pieces',
      label: 'Nombre de pièces',
      kind: 'choice',
      options: ['Moins de 100', '100 à 500', '500 à 1 000', '1 000 à 2 000', '2 000 à 5 000', 'Plus de 5 000'],
    }),
    only(['Jeu de société'], { id: 'players', label: 'Nombre de joueurs', kind: 'choice', options: ['1', '2', '2 à 4', '2 à 6', 'Plus de 6'] }),
    { id: 'complete', label: 'Complet', kind: 'toggle' },
    only(['Lego, construction', 'Jeu de société', 'Puzzle'], { id: 'box', label: 'Boîte d’origine', kind: 'toggle' }),
    only(['Lego, construction'], { id: 'manual', label: 'Notice fournie', kind: 'toggle' }),
    only(['Jeu électronique', 'Véhicule, circuit', 'Jeu d’éveil'], { id: 'works', label: 'Piles ou batterie fournies', kind: 'toggle' }),
  ],
  // Livres, BD, vinyles: one or a lot; the format and genre for records.
  livres: [
    { id: 'type', label: 'Type', kind: 'choice', options: ['Livres', 'BD', 'Mangas', 'Vinyles', 'CD', 'DVD, Blu-ray'] },
    { id: 'count', label: 'Nombre d’articles', kind: 'choice', options: ['1', '2 à 5', '6 à 10', '11 à 20', '21 à 50', 'Plus de 50'] },
    { id: 'titles', label: 'Titres ou série', kind: 'text', placeholder: 'Ex: Astérix, tomes 1 à 12' },
    { id: 'author', label: 'Auteur ou artiste', kind: 'text', placeholder: 'Ex: Goscinny, Daft Punk' },
    only(['Livres', 'BD', 'Mangas'], { id: 'lang', label: 'Langue', kind: 'choice', options: ['Français', 'Anglais', 'Japonais'], other: { label: 'Autre langue', placeholder: 'Ex: espagnol' } }),
    only(['Livres', 'BD', 'Mangas'], { id: 'edition', label: 'Édition', kind: 'choice', options: ['Édition originale', 'Réédition', 'Édition collector', 'Poche'] }),
    only(['Vinyles'], { id: 'format', label: 'Format', kind: 'choice', options: ['33 tours', '45 tours', 'Maxi 45 tours'] }),
    only(['Vinyles', 'CD'], {
      id: 'genre',
      label: 'Genre',
      kind: 'choice',
      options: ['Rock', 'Pop', 'Jazz', 'Rap, hip-hop', 'Électro', 'Classique', 'Chanson française', 'Soul, funk', 'Reggae', 'Metal'],
      other: { label: 'Autre genre', placeholder: 'Ex: blues' },
    }),
  ],
  // Famille
  // Puériculture, équipement bébé: the universe, then the product; a pushchair's type, a car seat's group.
  puericulture: [
    { id: 'type', label: 'Univers', kind: 'choice', options: ['Alimentation', 'Mobilité', 'Sécurité', 'Sommeil', 'Hygiène et santé'] },
    lead(only(['Alimentation'], { id: 'product', label: 'Produit', kind: 'choice', options: ['Chaise haute', 'Rehausseur de chaise', 'Biberons', 'Chauffe-biberon', 'Stérilisateur', 'Tire-lait', 'Robot cuiseur bébé', 'Coussin d’allaitement', 'Vaisselle bébé'], other: { label: 'Autre produit', placeholder: 'Précisez' } })),
    lead(only(['Mobilité'], { id: 'product', label: 'Produit', kind: 'choice', options: ['Poussette', 'Landau', 'Nacelle', 'Porte-bébé', 'Écharpe de portage', 'Trotteur', 'Remorque vélo enfant', 'Sac à langer'], other: { label: 'Autre produit', placeholder: 'Précisez' } })),
    lead(only(['Sécurité'], { id: 'product', label: 'Produit', kind: 'choice', options: ['Siège auto', 'Coque auto', 'Rehausseur auto', 'Barrière de sécurité', 'Babyphone', 'Parc bébé', 'Bloque-porte, cache-prise'], other: { label: 'Autre produit', placeholder: 'Précisez' } })),
    lead(only(['Sommeil'], { id: 'product', label: 'Produit', kind: 'choice', options: ['Lit bébé', 'Berceau', 'Lit parapluie', 'Couffin', 'Matelas bébé', 'Gigoteuse', 'Tour de lit', 'Mobile', 'Veilleuse'], other: { label: 'Autre produit', placeholder: 'Précisez' } })),
    lead(only(['Hygiène et santé'], { id: 'product', label: 'Produit', kind: 'choice', options: ['Baignoire bébé', 'Table à langer', 'Matelas à langer', 'Pot, réducteur', 'Thermomètre', 'Mouche-bébé', 'Poubelle à couches', 'Humidificateur'], other: { label: 'Autre produit', placeholder: 'Précisez' } })),
    lead(when('product', ['Poussette'], { id: 'stroller', label: 'Type de poussette', kind: 'choice', options: ['Compacte', 'Tout-terrain', 'Double', 'Triple', 'Canne', 'Sport', 'Électrique'] })),
    lead(
      when('product', ['Siège auto', 'Coque auto', 'Rehausseur auto'], {
        id: 'group',
        label: 'Groupe',
        kind: 'choice',
        options: ['Groupe 0+ (naissance à 13 kg)', 'Groupe 0+/1 (naissance à 18 kg)', 'Groupe 1 (9 à 18 kg)', 'Groupe 1/2/3 (9 à 36 kg)', 'Groupe 2/3 (15 à 36 kg)', 'i-Size 40 à 105 cm', 'i-Size 100 à 150 cm'],
      })
    ),
    when('product', ['Siège auto', 'Coque auto', 'Rehausseur auto'], { id: 'isofix', label: 'Isofix', kind: 'toggle' }),
    color,
  ],
  // Véhicules
  // As the classifieds ask for a car, in their order; Marque and Modèle before, État annoncé after.
  voiture: [
    year('Année-modèle'),
    { id: 'fuel', label: 'Carburant', kind: 'choice', options: ['Essence', 'Diesel', 'Hybride', 'Hybride rechargeable', 'Électrique', 'GPL'] },
    { id: 'ct', label: 'Contrôle technique', kind: 'choice', options: ['Valide, de moins de 6 mois', 'Valide', 'Contre-visite à faire', 'À refaire', 'Pas encore requis (moins de 4 ans)'], other: { label: 'Autre', placeholder: 'Ex: valable jusqu’en 05/2026' } },
    { id: 'registered', label: 'Mise en circulation', kind: 'year' },
    { id: 'gearbox', label: 'Boîte de vitesse', kind: 'choice', options: ['Manuelle', 'Automatique'] },
    {
      id: 'body',
      label: 'Type de véhicule',
      kind: 'choice',
      options: ['Citadine', 'Berline', 'Break', 'SUV, 4x4', 'Monospace', 'Coupé', 'Cabriolet', 'Utilitaire', 'Pick-up'],
      other: { label: 'Autre type', placeholder: 'Ex: Ludospace' },
    },
    { id: 'doors', label: 'Nombre de portes', kind: 'choice', options: ['2', '3', '4', '5', '6 et plus'] },
    { id: 'seats', label: 'Nombre de places', kind: 'choice', options: ['2', '4', '5', '7', '9'], other: { label: 'Autre nombre', placeholder: 'Ex: 8' } },
    { id: 'cv', label: 'Puissance fiscale', kind: 'choice', options: ['3 CV', '4 CV', '5 CV', '6 CV', '7 CV', '8 CV', '9 CV', '10 CV', '11 CV', '12 CV'], other: { label: 'Autre puissance', placeholder: 'Ex: 15 CV' } },
    { id: 'hp', label: 'Puissance', kind: 'choice', options: ['70 ch', '90 ch', '110 ch', '130 ch', '150 ch', '190 ch', '250 ch'], other: { label: 'Autre puissance', placeholder: 'Ex: 320 ch' } },
    { id: 'trim', label: 'Finition, version', kind: 'text', placeholder: 'Ex: GT Line, Allure' },
    { id: 'licence', label: 'Permis', kind: 'choice', options: ['Avec permis', 'Sans permis'] },
    { id: 'mileage', label: 'Kilométrage', kind: 'number', unit: 'km', placeholder: 'Ex: 85 000' },
    color,
    { id: 'equipment', label: 'Équipements', kind: 'text', placeholder: 'Ex: GPS, caméra de recul, sièges chauffants' },
    owners,
    service,
    critair,
    { id: 'emission', label: 'Classe d’émission', kind: 'choice', options: ['A', 'B', 'C', 'D', 'E', 'F', 'G'] },
  ],
  // Moto, scooter, quad…: the type first; « Type de moto » only for a motorbike.
  moto: [
    { id: 'type', label: 'Type de véhicule', kind: 'choice', options: ['Moto', 'Scooter', 'Quad, ATV', 'Cyclomoteur et vélomoteur'], other: { label: 'Autre', placeholder: 'Ex: side-car' } },
    { id: 'registered', label: 'Mise en circulation', kind: 'year' },
    {
      id: 'ct',
      label: 'Contrôle technique',
      kind: 'choice',
      options: ['Valide, de moins de 6 mois', 'Valide', 'Contre-visite à faire', 'À refaire', 'Pas encore requis'],
      other: { label: 'Autre', placeholder: 'Ex: valable jusqu’en 05/2027' },
    },
    { id: 'fuel', label: 'Carburant', kind: 'choice', options: ['Essence', 'Hybride', 'Électrique'] },
    { id: 'gearbox', label: 'Boîte de vitesse', kind: 'choice', options: ['Manuelle', 'Automatique'] },
    only(['Moto'], {
      id: 'style',
      label: 'Type de moto',
      kind: 'choice',
      options: ['Roadster', 'Sportive', 'Trail', 'Routière', 'Custom', 'Cross, enduro', 'Supermotard', 'Café racer'],
      other: { label: 'Autre type', placeholder: 'Ex: néo-rétro' },
    }),
    { id: 'licence', label: 'Permis', kind: 'choice', options: ['Sans permis', 'AM (BSR)', 'A1', 'A2', 'A', 'B avec formation 125'] },
    { id: 'cc', label: 'Cylindrée', kind: 'choice', options: ['50 cm³', '125 cm³', '300 cm³', '500 cm³', '650 cm³', '750 cm³', '900 cm³', '1000 cm³ et plus'], other: { label: 'Autre cylindrée', placeholder: 'Ex: 400 cm³' } },
    { id: 'hp', label: 'Puissance', kind: 'choice', options: ['4 ch', '11 ch', '15 ch', '35 ch', '47 ch', '70 ch', '100 ch', '150 ch et plus'], other: { label: 'Autre puissance', placeholder: 'Ex: 60 ch' } },
    { id: 'mileage', label: 'Kilométrage', kind: 'number', unit: 'km', placeholder: 'Ex: 12 000' },
    color,
    owners,
    service,
    critair,
  ],
};

/**
 * As served: a yes or no is a switch; any other choice opens in a sheet (suggestions in a modal, even
 * two), its « Autre » as a last line with a field.
 */
const asServed = (sp: ListingSpec): ListingSpec => {
  if (sp.kind !== 'choice') return sp;
  if (sp.options.length === 2 && sp.options.every((o) => YES_NO.includes(o))) {
    const { options: _o, sheet: _s, other: _x, ...rest } = sp;
    return { ...rest, kind: 'toggle' };
  }
  const other = sp.other ?? (sp.options.includes('Autre') ? { label: 'Autre', placeholder: 'Précisez' } : undefined);
  return { ...sp, sheet: true, options: sp.options.filter((o) => o !== 'Autre'), ...(other ? { other } : {}) };
};

export const LISTING_SPECS: Record<string, ListingSpec[]> = Object.fromEntries(Object.entries(SPECS).map(([key, specs]) => [key, specs.map(asServed)]));

/**
 * The brands offered for a product, by catalogue key: the most sold first, then the others in
 * alphabetical order; « Autre marque » takes any. Products without a list ask for the brand in a field.
 */
export const LISTING_BRANDS: Record<string, { popular: string[]; others: string[] }> = {
  telephone: {
    popular: ['Apple', 'Samsung', 'Xiaomi', 'Google', 'Huawei', 'Oppo', 'OnePlus'],
    others: [
      'Alcatel',
      'Asus',
      'BlackBerry',
      'Crosscall',
      'Doro',
      'Fairphone',
      'Honor',
      'LG',
      'Motorola',
      'Nokia',
      'Nothing',
      'Realme',
      'Sony',
      'Vivo',
      'Wiko',
      'ZTE',
    ],
  },
  tablette: { popular: ['Apple', 'Samsung', 'Lenovo', 'Amazon', 'Kobo', 'Microsoft', 'Xiaomi'], others: ['Asus', 'Huawei', 'Onyx Boox', 'Pocketbook', 'Realme', 'Sony', 'TCL'] },
  ordinateur: { popular: ['Apple', 'HP', 'Lenovo', 'Dell', 'Asus', 'Acer', 'MSI'], others: ['Alienware', 'Gigabyte', 'Huawei', 'LG', 'Microsoft', 'Razer', 'Samsung', 'Toshiba'] },
  console: { popular: ['Sony', 'Nintendo', 'Microsoft', 'Valve', 'Sega'], others: ['Asus', 'Atari', 'Lenovo', 'Logitech', 'Retro-bit'] },
  'tv-son': { popular: ['Samsung', 'LG', 'Sony', 'Philips', 'TCL', 'Hisense', 'Panasonic'], others: ['Grundig', 'Loewe', 'Sharp', 'Thomson', 'Toshiba', 'Xiaomi'] },
  // By type (« product/Type »): the app takes these once the type is chosen, else the product's.
  'tv-son/Vidéoprojecteur': { popular: ['Epson', 'BenQ', 'Optoma', 'XGIMI', 'LG', 'Samsung', 'Sony'], others: ['Acer', 'Anker Nebula', 'Philips', 'ViewSonic', 'Yaber'] },
  'tv-son/Son et enceinte': {
    popular: ['Sonos', 'Bose', 'JBL', 'Sony', 'Samsung', 'Marshall', 'Bang & Olufsen'],
    others: ['Denon', 'Harman Kardon', 'Klipsch', 'LG', 'Marantz', 'Pioneer', 'Ultimate Ears', 'Yamaha'],
  },
  'objet-connecte/Montre connectée': { popular: ['Apple', 'Samsung', 'Garmin', 'Huawei', 'Xiaomi', 'Google', 'Amazfit'], others: ['Fitbit', 'Fossil', 'OnePlus', 'Polar', 'Suunto', 'Withings'] },
  'objet-connecte/Décodeur et boîtier TV': { popular: ['Apple', 'Google', 'Amazon', 'Free', 'Orange', 'SFR', 'Bouygues Telecom'], others: ['Canal+', 'Nvidia', 'Roku', 'Xiaomi'] },
  'objet-connecte': { popular: ['Apple', 'Google', 'Amazon', 'Samsung', 'Xiaomi', 'Philips Hue', 'Netatmo'], others: ['Arlo', 'Eufy', 'Ring', 'Somfy', 'TP-Link', 'Withings'] },
  'console/Casque gaming': { popular: ['Logitech', 'Razer', 'SteelSeries', 'HyperX', 'Corsair', 'Turtle Beach', 'Sony'], others: ['Astro', 'Microsoft', 'Nacon', 'Roccat'] },
  'console/Simulateur': { popular: ['Logitech', 'Thrustmaster', 'Fanatec', 'Moza', 'Turtle Beach'], others: ['Hori', 'Next Level Racing', 'Playseat', 'Simagic'] },
  'console/Réalité virtuelle': { popular: ['Meta', 'Sony', 'Apple', 'HTC', 'Valve', 'Pico'], others: ['HP', 'Pimax', 'Varjo'] },
  'console/Manette': { popular: ['Sony', 'Microsoft', 'Nintendo', '8BitDo', 'Nacon', 'PowerA', 'Razer'], others: ['Hori', 'Logitech', 'PDP', 'Turtle Beach'] },
  'console/Jeu vidéo': {
    popular: ['Nintendo', 'Sony', 'Ubisoft', 'Electronic Arts', 'Activision', 'Microsoft', 'Rockstar Games'],
    others: ['Bandai Namco', 'Bethesda', 'Capcom', 'Square Enix', 'Sega', 'Warner Bros. Games'],
  },
  photo: { popular: ['Canon', 'Nikon', 'Sony', 'Fujifilm', 'GoPro', 'DJI', 'Panasonic'], others: ['Leica', 'Olympus', 'Pentax', 'Ricoh', 'Sigma', 'Tamron'] },
  meuble: { popular: ['IKEA', 'Maisons du Monde', 'Conforama', 'But', 'La Redoute', 'Habitat'], others: ['Alinéa', 'Cinna', 'Fly', 'Ligne Roset', 'Roche Bobois', 'Vitra'] },
  electromenager: { popular: ['Samsung', 'LG', 'Bosch', 'Whirlpool', 'Electrolux', 'Dyson', 'Miele'], others: ['Beko', 'Brandt', 'De’Longhi', 'Haier', 'Indesit', 'KitchenAid', 'Krups', 'Moulinex', 'Rowenta', 'Seb', 'Siemens', 'Smeg', 'Thermomix'] },
  'electromenager/Cuisine et cuisson': {
    popular: ['Moulinex', 'Seb', 'Tefal', 'Philips', 'Ninja', 'KitchenAid', 'De’Longhi'],
    others: ['Bosch', 'Kenwood', 'Krups', 'Magimix', 'Nespresso', 'Samsung', 'Smeg', 'Thermomix', 'Whirlpool'],
  },
  'electromenager/Entretien de la maison': { popular: ['Dyson', 'Rowenta', 'Philips', 'iRobot', 'Shark', 'Roborock', 'Kärcher'], others: ['Bissell', 'Calor', 'Dreame', 'Ecovacs', 'Miele', 'Xiaomi'] },
  'electromenager/Beauté et soins personnels': { popular: ['Philips', 'Braun', 'Dyson', 'Babyliss', 'Remington', 'Oral-B', 'Calor'], others: ['GHD', 'Panasonic', 'Rowenta', 'Wahl'] },
  deco: { popular: ['IKEA', 'Maisons du Monde', 'Zara Home', 'H&M Home', 'Habitat'], others: ['AM.PM', 'Bloomingville', 'Hay', 'Muuto', 'Sostrene Grene'] },
  bricolage: { popular: ['Bosch', 'Makita', 'DeWalt', 'Ryobi', 'Black+Decker', 'Milwaukee'], others: ['AEG', 'Einhell', 'Festool', 'Hilti', 'Metabo', 'Parkside', 'Stanley', 'Worx'] },
  'bricolage/Chauffage et ventilation': { popular: ['Atlantic', 'Thermor', 'De’Longhi', 'Rowenta', 'Invicta', 'Supra', 'Godin'], others: ['Airton', 'Daikin', 'Dimplex', 'Noirot', 'Saunier Duval', 'Stove'] },
  'bricolage/Électricité, éclairage et domotique': { popular: ['Legrand', 'Schneider Electric', 'Somfy', 'Philips Hue', 'Netatmo', 'Ring', 'Hager'], others: ['Arlo', 'Diagral', 'Eufy', 'Lexman', 'Tado', 'TP-Link'] },
  'bricolage/Équipement et protection': { popular: ['Facom', 'Stanley', 'Hailo', 'Delta Plus', 'Kärcher', 'Dexter', 'Würth'], others: ['3M', 'Bosch', 'Centaure', 'Kapriol', 'Uvex'] },
  'bricolage/Outils à main': { popular: ['Facom', 'Stanley', 'Bahco', 'Wera', 'Knipex', 'Dexter', 'Leborgne'], others: ['Beta', 'Gedore', 'Irwin', 'Stahlwille', 'Würth'] },
  jardin: { popular: ['Husqvarna', 'Stihl', 'Bosch', 'Ryobi', 'Weber', 'Gardena'], others: ['Black+Decker', 'Einhell', 'Honda', 'Hozelock', 'Makita', 'Worx'] },
  'jardin/Mobilier de jardin': { popular: ['Hespéride', 'IKEA', 'Fermob', 'Lafuma', 'Keter', 'Naterial', 'Maisons du Monde'], others: ['Allibert', 'Emu', 'Kettler', 'Oviala', 'Vlaemynck'] },
  'jardin/Barbecue et cuisson extérieure': { popular: ['Weber', 'Campingaz', 'Char-Broil', 'Napoleon', 'Barbecook', 'Forge Adour', 'Ooni'], others: ['Big Green Egg', 'Eno', 'Kamado Joe', 'Somagic', 'Traeger'] },
  'jardin/Piscine et spa': { popular: ['Intex', 'Bestway', 'Gré', 'Zodiac', 'Dolphin', 'Teamhorizon', 'Jacuzzi'], others: ['Aquajet', 'Hayward', 'Netspa', 'Poolex', 'Ubbink'] },
  'jardin/Outils à moteur': { popular: ['Husqvarna', 'Stihl', 'Bosch', 'Ryobi', 'Greenworks', 'Honda', 'Einhell'], others: ['Black+Decker', 'Echo', 'Gardena', 'Makita', 'McCulloch', 'Worx'] },
  vetements: { popular: ['Nike', 'Adidas', 'Zara', 'H&M', 'The North Face', 'Levi’s', 'Uniqlo'], others: ['Asics', 'Carhartt', 'Converse', 'Lacoste', 'Mango', 'New Balance', 'Patagonia', 'Puma', 'Ralph Lauren', 'Sézane', 'Vans'] },
  'vetements/Chaussures': {
    popular: ['Nike', 'Adidas', 'New Balance', 'Converse', 'Vans', 'Puma', 'Dr. Martens'],
    others: ['Asics', 'Birkenstock', 'Clarks', 'Geox', 'Kickers', 'Minelli', 'Reebok', 'Salomon', 'Timberland', 'UGG', 'Veja'],
  },
  luxe: { popular: ['Louis Vuitton', 'Chanel', 'Hermès', 'Rolex', 'Gucci', 'Cartier', 'Dior'], others: ['Audemars Piguet', 'Balenciaga', 'Bottega Veneta', 'Bulgari', 'Céline', 'Fendi', 'Longchamp', 'Omega', 'Prada', 'Saint Laurent', 'Tag Heuer', 'Tudor'] },
  'luxe/Montre': { popular: ['Rolex', 'Omega', 'Cartier', 'Tag Heuer', 'Tudor', 'Longines', 'Seiko'], others: ['Audemars Piguet', 'Breitling', 'Casio', 'Hublot', 'IWC', 'Patek Philippe', 'Tissot', 'Zenith'] },
  'luxe/Bijou': { popular: ['Cartier', 'Tiffany & Co.', 'Bulgari', 'Van Cleef & Arpels', 'Chaumet', 'Pandora', 'Swarovski'], others: ['Boucheron', 'Chopard', 'Dinh Van', 'Messika', 'Mauboussin', 'Pomellato', 'Thomas Sabo'] },
  'luxe/Sac': { popular: ['Louis Vuitton', 'Chanel', 'Hermès', 'Dior', 'Gucci', 'Longchamp', 'Prada'], others: ['Balenciaga', 'Bottega Veneta', 'Céline', 'Fendi', 'Lancel', 'Michael Kors', 'Saint Laurent', 'Sézane'] },
  velo: {
    popular: ['Decathlon', 'Specialized', 'Trek', 'Giant', 'Cannondale', 'Canyon', 'Lapierre'],
    others: ['BH', 'Bianchi', 'BMC', 'Brompton', 'Cube', 'Gitane', 'Haibike', 'KTM', 'Look', 'Merida', 'Moustache', 'O2feel', 'Orbea', 'Peugeot', 'Riese & Müller', 'Scott', 'Time', 'Van Moof'],
  },
  'velo/Enfant': { popular: ['Decathlon', 'Woom', 'Frog', 'Early Rider', 'Puky', 'Specialized', 'Trek'], others: ['Giant', 'Islabikes', 'Lapierre', 'Orbea', 'Scott'] },
  'velo/BMX': { popular: ['Mongoose', 'GT', 'Haro', 'Wethepeople', 'Sunday', 'Kink', 'Decathlon'], others: ['Cult', 'Fit', 'Radio', 'Redline', 'Subrosa'] },
  'velo/Vélo pliant': { popular: ['Brompton', 'Tern', 'Dahon', 'Decathlon', 'Birdy', 'Moma'], others: ['Fiido', 'Gitane', 'Peugeot', 'Strida', 'Vello'] },
  'velo/Vélo électrique': {
    popular: ['Decathlon', 'Moustache', 'Cowboy', 'Van Moof', 'O2feel', 'Specialized', 'Trek'],
    others: ['Cube', 'Gazelle', 'Giant', 'Haibike', 'Lapierre', 'Peugeot', 'Riese & Müller', 'Scott', 'Tern'],
  },
  trottinette: { popular: ['Xiaomi', 'Segway-Ninebot', 'Dualtron', 'Pure', 'Kaabo'], others: ['Decathlon', 'Inokim', 'Micro', 'Unagi', 'Wispeed'] },
  'trottinette/Trottinette mécanique': { popular: ['Decathlon', 'Micro', 'Razor', 'Globber', 'Hudora'], others: ['Fuzion', 'JD Bug', 'Oxelo'] },
  'trottinette/Trottinette enfant': { popular: ['Globber', 'Micro', 'Decathlon', 'Razor', 'Hudora'], others: ['Janod', 'Smoby', 'Yvolution'] },
  sport: { popular: ['Decathlon', 'Nike', 'Adidas', 'Salomon', 'Rossignol', 'Wilson'], others: ['Babolat', 'Domyos', 'Head', 'Kettler', 'Quechua', 'Technogym'] },
  'sport/Ski': { popular: ['Rossignol', 'Salomon', 'Atomic', 'Head', 'Fischer', 'Dynastar', 'Völkl'], others: ['Black Crows', 'Blizzard', 'Elan', 'K2', 'Line', 'Nordica', 'Wedze'] },
  'sport/Snowboard': { popular: ['Burton', 'Salomon', 'Nitro', 'Rossignol', 'K2', 'Lib Tech', 'Jones'], others: ['Arbor', 'Capita', 'DC', 'GNU', 'Ride', 'Wedze'] },
  'sport/Vélo d’appartement': { popular: ['Domyos', 'Kettler', 'Technogym', 'NordicTrack', 'BH Fitness', 'Care', 'Peloton'], others: ['Bowflex', 'Life Fitness', 'Schwinn', 'Sportstech', 'Toorx'] },
  'sport/Tapis de course': { popular: ['Domyos', 'NordicTrack', 'Kettler', 'Technogym', 'BH Fitness', 'Care', 'Sportstech'], others: ['Life Fitness', 'Matrix', 'ProForm', 'Toorx'] },
  'sport/Rameur': { popular: ['Concept2', 'Domyos', 'WaterRower', 'Kettler', 'Care', 'NordicTrack'], others: ['BH Fitness', 'Hydrow', 'Sportstech', 'Toorx'] },
  'sport/Tennis': { popular: ['Babolat', 'Wilson', 'Head', 'Yonex', 'Prince', 'Artengo'], others: ['Dunlop', 'Tecnifibre', 'Volkl'] },
  'sport/Padel': { popular: ['Bullpadel', 'Babolat', 'Head', 'Adidas', 'Nox', 'Kuikma'], others: ['Dunlop', 'Siux', 'StarVie', 'Wilson'] },
  'sport/Golf': { popular: ['Callaway', 'TaylorMade', 'Titleist', 'Ping', 'Cobra', 'Inesis'], others: ['Cleveland', 'Mizuno', 'Srixon', 'Wilson'] },
  'sport/Surf': { popular: ['Olaian', 'Firewire', 'Lost', 'Channel Islands', 'Torq', 'JS Industries'], others: ['Al Merrick', 'Pyzel', 'Softech', 'Tahe'] },
  instrument: { popular: ['Yamaha', 'Fender', 'Gibson', 'Roland', 'Casio', 'Korg'], others: ['Boss', 'Epiphone', 'Ibanez', 'Kawai', 'Marshall', 'Pearl', 'Steinway', 'Taylor'] },
  'instrument/Guitare acoustique': { popular: ['Yamaha', 'Taylor', 'Martin', 'Fender', 'Gibson', 'Takamine', 'Cort'], others: ['Admira', 'Epiphone', 'Furch', 'Ibanez', 'Lâg', 'Seagull'] },
  'instrument/Guitare électrique': { popular: ['Fender', 'Gibson', 'Epiphone', 'Ibanez', 'Squier', 'PRS', 'Yamaha'], others: ['Charvel', 'ESP', 'Gretsch', 'Jackson', 'Schecter', 'Music Man'] },
  'instrument/Basse': { popular: ['Fender', 'Ibanez', 'Squier', 'Yamaha', 'Music Man', 'Sire'], others: ['Cort', 'Epiphone', 'Gibson', 'Warwick'] },
  'instrument/Piano': { popular: ['Yamaha', 'Kawai', 'Steinway', 'Pleyel', 'Bechstein', 'Schimmel'], others: ['Bösendorfer', 'Feurich', 'Gaveau', 'Petrof', 'Seiler'] },
  'instrument/Piano numérique': { popular: ['Yamaha', 'Roland', 'Casio', 'Kawai', 'Korg', 'Nord'], others: ['Alesis', 'Artesia', 'Kurzweil', 'Thomann'] },
  'instrument/Clavier, synthétiseur': { popular: ['Yamaha', 'Roland', 'Korg', 'Casio', 'Arturia', 'Nord', 'Novation'], others: ['Akai', 'Behringer', 'Moog', 'Native Instruments'] },
  'instrument/Batterie acoustique': { popular: ['Pearl', 'Tama', 'Yamaha', 'Ludwig', 'DW', 'Mapex', 'Sonor'], others: ['Gretsch', 'Millenium', 'Premier'] },
  'instrument/Batterie électronique': { popular: ['Roland', 'Alesis', 'Yamaha', 'Millenium', 'Simmons'], others: ['ATV', 'EFNOTE', 'Pearl'] },
  'instrument/Violon, violoncelle': { popular: ['Yamaha', 'Stentor', 'Gliga', 'Hidersine', 'Gewa'], others: ['Eastman', 'Mirecourt', 'Scott Cao'] },
  'instrument/Instrument à vent': { popular: ['Yamaha', 'Selmer', 'Buffet Crampon', 'Jupiter', 'Bach', 'Pearl Flute'], others: ['Antigua', 'Conn', 'Courtois', 'Trevor James', 'Yanagisawa'] },
  'instrument/Ampli, effets': { popular: ['Marshall', 'Fender', 'Boss', 'Orange', 'Vox', 'Blackstar', 'Line 6'], others: ['Ampeg', 'Electro-Harmonix', 'Laney', 'Mesa Boogie', 'TC Electronic'] },
  'instrument/Matériel DJ, home studio': { popular: ['Pioneer DJ', 'Native Instruments', 'Denon DJ', 'Numark', 'Focusrite', 'Akai', 'Behringer'], others: ['Audio-Technica', 'Rane', 'Reloop', 'Shure', 'Universal Audio'] },
  jouets: { popular: ['Lego', 'Playmobil', 'Hasbro', 'Mattel', 'Vtech', 'Fisher-Price'], others: ['Asmodee', 'Djeco', 'Janod', 'Ravensburger', 'Smoby', 'Vilac'] },
  'jouets/Lego, construction': { popular: ['Lego', 'Playmobil', 'Mega Bloks', 'Cobi', 'Meccano', 'Kapla'], others: ['Bluebrixx', 'Geomag', 'Knex', 'Lincoln Logs'] },
  'jouets/Jeu de société': { popular: ['Asmodee', 'Hasbro', 'Gigamic', 'Ravensburger', 'Days of Wonder', 'Iello', 'Repos Production'], others: ['Blackrock', 'Dujardin', 'Goliath', 'Libellud', 'Mattel'] },
  'jouets/Puzzle': { popular: ['Ravensburger', 'Clementoni', 'Educa', 'Nathan', 'Schmidt', 'Wentworth'], others: ['Djeco', 'Heye', 'Janod', 'Trefl'] },
  'jouets/Poupée, figurine': { popular: ['Mattel', 'Corolle', 'Smoby', 'Bandai', 'Funko', 'Schleich', 'Playmobil'], others: ['Hasbro', 'L.O.L. Surprise', 'Papo', 'Sylvanian Families'] },
  'jouets/Véhicule, circuit': { popular: ['Hot Wheels', 'Majorette', 'Carrera', 'Brio', 'Siku', 'Lego'], others: ['Bburago', 'Hornby', 'Märklin', 'Scalextric'] },
  puericulture: { popular: ['Babyzen', 'Cybex', 'Bébé Confort', 'Chicco', 'Maxi-Cosi', 'Stokke'], others: ['4moms', 'ABC Design', 'aden + anais', 'Allobébé', 'Amadeus', 'Angelcare', 'Bugaboo', 'Joie', 'Joolz', 'Nuna', 'Thule', 'Tripp Trapp'] },
  'puericulture/Mobilité': { popular: ['Babyzen', 'Bugaboo', 'Cybex', 'Joolz', 'Chicco', 'Stokke', 'Bébé Confort'], others: ['4moms', 'ABC Design', 'aden + anais', 'Allobébé', 'Amadeus', 'Angelcare', 'Babybjörn', 'Ergobaby', 'Joie', 'Nuna', 'Thule', 'Uppababy'] },
  'puericulture/Sécurité': { popular: ['Maxi-Cosi', 'Cybex', 'Britax Römer', 'Joie', 'Bébé Confort', 'Chicco', 'Philips Avent'], others: ['4moms', 'ABC Design', 'aden + anais', 'Allobébé', 'Amadeus', 'Angelcare', 'Babymoov', 'Nuna', 'Recaro', 'Safety 1st', 'Tineo'] },
  'puericulture/Alimentation': { popular: ['Stokke', 'Philips Avent', 'Béaba', 'Tommee Tippee', 'Medela', 'Chicco', 'Badabulle'], others: ['4moms', 'ABC Design', 'aden + anais', 'Allobébé', 'Amadeus', 'Angelcare', 'Babymoov', 'Dr. Brown’s', 'Joie', 'MAM', 'Peg Perego'] },
  'puericulture/Sommeil': { popular: ['IKEA', 'Sauthon', 'Aubert', 'Babymoov', 'Tineo', 'Galipette', 'Stokke'], others: ['4moms', 'ABC Design', 'aden + anais', 'Allobébé', 'Amadeus', 'Angelcare', 'Candide', 'Chicco', 'Little Big Bed', 'Red Castle', 'Vertbaudet'] },
  'puericulture/Hygiène et santé': { popular: ['Béaba', 'Babymoov', 'Tigex', 'Chicco', 'Badabulle', 'Dodie', 'Braun'], others: ['4moms', 'ABC Design', 'aden + anais', 'Allobébé', 'Amadeus', 'Angelcare', 'Philips Avent', 'Shnuggle', 'Tommee Tippee'] },
  voiture: { popular: ['Renault', 'Peugeot', 'Citroën', 'Volkswagen', 'Toyota', 'Dacia', 'Tesla'], others: ['Audi', 'BMW', 'Fiat', 'Ford', 'Hyundai', 'Kia', 'Mercedes-Benz', 'Mini', 'Nissan', 'Opel', 'Seat', 'Skoda', 'Volvo'] },
  moto: { popular: ['Yamaha', 'Honda', 'Kawasaki', 'Suzuki', 'BMW', 'KTM', 'Piaggio'], others: ['Aprilia', 'Ducati', 'Harley-Davidson', 'Kymco', 'Peugeot', 'Royal Enfield', 'Triumph', 'Vespa'] },
  'moto/Scooter': { popular: ['Yamaha', 'Honda', 'Piaggio', 'Vespa', 'Kymco', 'Peugeot', 'Sym'], others: ['Aprilia', 'BMW', 'Niu', 'Silence', 'Suzuki'] },
  'moto/Quad, ATV': { popular: ['Polaris', 'Can-Am', 'Yamaha', 'Kymco', 'CFMoto', 'TGB', 'Goes'], others: ['Access', 'Arctic Cat', 'Honda', 'Linhai', 'Suzuki'] },
  'moto/Cyclomoteur et vélomoteur': { popular: ['Peugeot', 'MBK', 'Piaggio', 'Derbi', 'Rieju', 'Sherco', 'Solex'], others: ['Aprilia', 'Beta', 'Kymco', 'Motobécane', 'Yamaha'] },
};

/**
 * The models offered once the brand is chosen, by catalogue key then brand, the newest first;
 * « Autre modèle » takes any. A brand without a list asks for the model in a field.
 */
export const LISTING_MODELS: Record<string, Record<string, string[]>> = {
  telephone: {
    Apple: ['iPhone 17 Pro Max', 'iPhone 17 Pro', 'iPhone Air', 'iPhone 17', 'iPhone 16 Pro Max', 'iPhone 16 Pro', 'iPhone 16 Plus', 'iPhone 16', 'iPhone 16e', 'iPhone 15 Pro Max', 'iPhone 15 Pro', 'iPhone 15 Plus', 'iPhone 15', 'iPhone 14 Pro Max', 'iPhone 14 Pro', 'iPhone 14 Plus', 'iPhone 14', 'iPhone 13 Pro Max', 'iPhone 13 Pro', 'iPhone 13', 'iPhone 13 mini', 'iPhone 12 Pro Max', 'iPhone 12 Pro', 'iPhone 12', 'iPhone 12 mini', 'iPhone SE (2022)', 'iPhone 11 Pro Max', 'iPhone 11 Pro', 'iPhone 11', 'iPhone SE (2020)', 'iPhone XS Max', 'iPhone XS', 'iPhone XR', 'iPhone X', 'iPhone 8 Plus', 'iPhone 8'],
    Samsung: ['Galaxy S25 Ultra', 'Galaxy S25+', 'Galaxy S25', 'Galaxy S24 Ultra', 'Galaxy S24+', 'Galaxy S24', 'Galaxy S24 FE', 'Galaxy S23 Ultra', 'Galaxy S23+', 'Galaxy S23', 'Galaxy S23 FE', 'Galaxy S22 Ultra', 'Galaxy S22+', 'Galaxy S22', 'Galaxy S21 Ultra', 'Galaxy S21', 'Galaxy Z Fold6', 'Galaxy Z Flip6', 'Galaxy Z Fold5', 'Galaxy Z Flip5', 'Galaxy A56', 'Galaxy A55', 'Galaxy A54', 'Galaxy A36', 'Galaxy A35', 'Galaxy A34', 'Galaxy A26', 'Galaxy A25', 'Galaxy A16', 'Galaxy A15', 'Galaxy A14'],
    Xiaomi: ['Xiaomi 15 Ultra', 'Xiaomi 15', 'Xiaomi 14 Ultra', 'Xiaomi 14', 'Xiaomi 13T Pro', 'Xiaomi 13T', 'Redmi Note 14 Pro', 'Redmi Note 14', 'Redmi Note 13 Pro', 'Redmi Note 13', 'Redmi 14C', 'Redmi 13C', 'Poco X6 Pro', 'Poco F6'],
    Google: ['Pixel 10 Pro XL', 'Pixel 10 Pro', 'Pixel 10', 'Pixel 9 Pro XL', 'Pixel 9 Pro', 'Pixel 9', 'Pixel 9a', 'Pixel 8 Pro', 'Pixel 8', 'Pixel 8a', 'Pixel 7 Pro', 'Pixel 7', 'Pixel 7a', 'Pixel 6 Pro', 'Pixel 6', 'Pixel 6a'],
    Huawei: ['P60 Pro', 'P50 Pro', 'P40 Pro', 'P30 Pro', 'P30', 'Mate 50 Pro', 'Nova 12', 'Nova 11'],
    Oppo: ['Find X8 Pro', 'Find X8', 'Find X5 Pro', 'Reno 12 Pro', 'Reno 12', 'Reno 11', 'A80', 'A79', 'A60'],
    OnePlus: ['OnePlus 13', 'OnePlus 13R', 'OnePlus 12', 'OnePlus 12R', 'OnePlus 11', 'Nord 4', 'Nord CE4', 'Nord 3'],
  },
  tablette: {
    Apple: ['iPad Pro 13 (M4)', 'iPad Pro 11 (M4)', 'iPad Air 13 (M2)', 'iPad Air 11 (M2)', 'iPad (10e génération)', 'iPad (9e génération)', 'iPad mini (A17 Pro)', 'iPad mini 6', 'iPad Pro 12,9 (2022)', 'iPad Pro 11 (2022)'],
    Samsung: ['Galaxy Tab S10 Ultra', 'Galaxy Tab S10+', 'Galaxy Tab S9 Ultra', 'Galaxy Tab S9+', 'Galaxy Tab S9', 'Galaxy Tab S9 FE', 'Galaxy Tab S8', 'Galaxy Tab A9+', 'Galaxy Tab A9', 'Galaxy Tab A8'],
    Amazon: ['Kindle Paperwhite', 'Kindle Scribe', 'Kindle Oasis', 'Kindle', 'Fire HD 10', 'Fire HD 8', 'Fire 7'],
    Kobo: ['Libra Colour', 'Libra 2', 'Clara BW', 'Clara 2E', 'Sage', 'Elipsa 2E'],
    Microsoft: ['Surface Pro 11', 'Surface Pro 9', 'Surface Pro 8', 'Surface Go 4', 'Surface Go 3'],
    Lenovo: ['Tab P12', 'Tab P11', 'Tab M11', 'Tab M10'],
  },
  ordinateur: {
    Apple: ['MacBook Air 13 (M3)', 'MacBook Air 15 (M3)', 'MacBook Air 13 (M2)', 'MacBook Air (M1)', 'MacBook Pro 14 (M4)', 'MacBook Pro 16 (M4)', 'MacBook Pro 14 (M3)', 'MacBook Pro 16 (M3)', 'MacBook Pro 13 (M2)', 'MacBook Pro 13 (M1)', 'iMac 24 (M4)', 'iMac 24 (M3)', 'iMac 24 (M1)', 'Mac mini (M4)', 'Mac mini (M2)', 'Mac Studio'],
    HP: ['Pavilion', 'EliteBook', 'ProBook', 'Envy', 'Spectre', 'Omen', 'Victus'],
    Lenovo: ['ThinkPad', 'IdeaPad', 'Yoga', 'Legion', 'ThinkCentre'],
    Dell: ['XPS', 'Latitude', 'Inspiron', 'Vostro'],
    Asus: ['ZenBook', 'VivoBook', 'ROG', 'TUF Gaming'],
    Acer: ['Aspire', 'Swift', 'Nitro', 'Predator'],
    MSI: ['Katana', 'Prestige', 'Modern', 'Raider', 'Stealth'],
  },
  'console/Console': {
    Sony: ['PlayStation 5 Pro', 'PlayStation 5', 'PlayStation 5 Slim', 'PlayStation 5 Digital', 'PlayStation Portal', 'PlayStation 4 Pro', 'PlayStation 4 Slim', 'PlayStation 4', 'PS Vita'],
    Nintendo: ['Switch 2', 'Switch OLED', 'Switch', 'Switch Lite', 'Wii U', 'Wii', '3DS XL', '2DS'],
    Microsoft: ['Xbox Series X', 'Xbox Series S', 'Xbox One X', 'Xbox One S', 'Xbox One'],
    Valve: ['Steam Deck OLED', 'Steam Deck'],
  },
  'console/Réalité virtuelle': {
    Meta: ['Quest 3', 'Quest 3S', 'Quest Pro', 'Quest 2'],
    Sony: ['PlayStation VR2', 'PlayStation VR'],
    Apple: ['Vision Pro'],
    HTC: ['Vive XR Elite', 'Vive Pro 2', 'Vive Focus 3'],
    Valve: ['Index'],
    Pico: ['Pico 4 Ultra', 'Pico 4'],
  },
  'console/Manette': {
    Sony: ['DualSense Edge', 'DualSense', 'DualShock 4'],
    Microsoft: ['Manette Elite Series 2', 'Manette sans fil Xbox'],
    Nintendo: ['Manette Pro Switch 2', 'Joy-Con 2', 'Manette Pro Switch', 'Joy-Con'],
  },
  'objet-connecte/Montre connectée': {
    Apple: ['Watch Ultra 2', 'Watch Series 10', 'Watch Series 9', 'Watch SE', 'Watch Series 8', 'Watch Ultra'],
    Samsung: ['Galaxy Watch Ultra', 'Galaxy Watch 7', 'Galaxy Watch 6', 'Galaxy Watch 5', 'Galaxy Watch 4'],
    Garmin: ['Fenix 8', 'Forerunner 965', 'Forerunner 265', 'Venu 3', 'Instinct 2'],
    Google: ['Pixel Watch 3', 'Pixel Watch 2', 'Pixel Watch'],
  },
  'objet-connecte/Décodeur et boîtier TV': {
    Apple: ['Apple TV 4K'],
    Google: ['Google TV Streamer', 'Chromecast avec Google TV'],
    Amazon: ['Fire TV Cube', 'Fire TV Stick 4K Max', 'Fire TV Stick 4K', 'Fire TV Stick'],
    Free: ['Freebox Ultra', 'Freebox Pop', 'Freebox Delta', 'Freebox Révolution'],
    Nvidia: ['Shield TV Pro', 'Shield TV'],
  },
  voiture: {
    Renault: ['Clio', 'Mégane', 'Captur', 'Twingo', 'Zoé', 'Scénic', 'Austral', 'Arkana', 'Kadjar', 'Espace', 'Kangoo', 'Trafic'],
    Peugeot: ['208', 'e-208', '2008', '308', '3008', '5008', '108', '508', 'Partner', 'Rifter'],
    Citroën: ['C3', 'C3 Aircross', 'C4', 'ë-C4', 'C5 Aircross', 'C1', 'Berlingo', 'Ami'],
    Volkswagen: ['Golf', 'Polo', 'T-Roc', 'T-Cross', 'Tiguan', 'Up!', 'Passat', 'Touran', 'ID.3', 'ID.4'],
    Toyota: ['Yaris', 'Yaris Cross', 'Corolla', 'C-HR', 'RAV4', 'Aygo X', 'Prius'],
    Dacia: ['Sandero', 'Duster', 'Spring', 'Jogger', 'Logan'],
    Tesla: ['Model 3', 'Model Y', 'Model S', 'Model X'],
  },
  moto: {
    Yamaha: ['MT-07', 'MT-09', 'MT-125', 'Tracer 9', 'Ténéré 700', 'R7', 'R1', 'TMAX', 'XMAX', 'NMAX'],
    Honda: ['CB650R', 'CB500F', 'CB125R', 'CBR650R', 'Rebel 500', 'Africa Twin', 'NC750X', 'X-ADV', 'Forza 125', 'PCX 125'],
    Kawasaki: ['Z650', 'Z900', 'Z125', 'Ninja 650', 'ZX-6R', 'Versys 650'],
    Suzuki: ['SV650', 'GSX-8S', 'GSX-S750', 'V-Strom 650', 'Burgman 125'],
    BMW: ['R 1300 GS', 'R 1250 GS', 'F 900 R', 'F 750 GS', 'G 310 R', 'S 1000 RR', 'R nineT', 'C 400 X'],
    KTM: ['125 Duke', '390 Duke', '790 Duke', '890 Duke', '1290 Super Duke R', '390 Adventure'],
    Piaggio: ['Liberty', 'Medley', 'Beverly', 'MP3'],
  },
};

/**
 * The form's own fields a product doesn't ask (by catalogue key): no Modèle for a T-shirt, no
 * « Référence ou numéro de série » for a book.
 */
export const LISTING_HIDDEN: Record<string, ('brand' | 'model' | 'serial')[]> = {
  vetements: ['model', 'serial'],
  meuble: ['model', 'serial'],
  luxe: ['serial'],
  livres: ['brand', 'model', 'serial'],
  puericulture: ['serial'],
  jouets: ['model', 'serial'],
  sport: ['serial'],
  deco: ['model', 'serial'],
};
