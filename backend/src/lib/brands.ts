import type { BrandKind } from '../modules/brand/service';

/**
 * The chains and pickup networks offered from the start in the « Enseigne » field of a Clic & Collect.
 * The ones requesters type are added as they go (modules/brand).
 */
export const BRANDS: { name: string; kind: BrandKind }[] = [
  // ── Points relais et consignes ──
  ...['Mondial Relay', 'Relais Colis', 'Pickup', 'La Poste', 'Colissimo', 'Chronopost', 'DPD Pickup', 'UPS Access Point', 'InPost', 'Amazon Locker', 'Amazon Hub', 'Shop2Shop', 'GLS', 'Vinted Go'].map(
    (name) => ({ name, kind: 'relay' as const })
  ),
  // ── Drives ──
  ...['Leclerc Drive', 'Carrefour Drive', 'Auchan Drive', 'Intermarché Drive', 'Courses U Drive', 'Chronodrive', 'Lidl'].map((name) => ({ name, kind: 'drive' as const })),
  // ── Magasins ──
  ...[
    'Leroy Merlin', 'Castorama', 'Brico Dépôt', 'Bricomarché', 'Mr.Bricolage', 'Bricorama',
    'Ikea', 'Conforama', 'But', 'Maisons du Monde', 'Alinéa',
    'Fnac', 'Darty', 'Boulanger', 'Apple Store', 'Cultura', 'Micromania',
    'Decathlon', 'Intersport', 'Go Sport', 'Sport 2000',
    'JouéClub', 'King Jouet', 'La Grande Récré',
    'Zara', 'H&M', 'Kiabi', 'Primark', 'Uniqlo',
    'Sephora', 'Nocibé', 'Marionnaud',
    'E.Leclerc', 'Carrefour', 'Auchan', 'Intermarché', 'Super U', 'Monoprix', 'Franprix', 'Picard',
    'Action', 'Gifi', 'Truffaut', 'Jardiland', 'Botanic', 'Gamm Vert',
    'Norauto', 'Feu Vert', 'Point S',
  ].map((name) => ({ name, kind: 'store' as const })),
];
