import type { Q } from './types';

/** In every test: what checking needs on the ground, whatever the trade (seeing, proving, spotting a trap). */
export const COMMON: Q[] = [
  [
    'L’objet ne correspond pas exactement à l’annonce (couleur, modèle, accessoire manquant). Que faites-vous ?',
    ['Vous le prenez quand même', 'Vous photographiez la différence et la signalez avant toute chose', 'Vous ne dites rien pour ne pas vexer le vendeur'],
    1,
    'Vous constatez et vous montrez. C’est au demandeur de décider en connaissant la différence.',
  ],
  [
    'Comment photographier un défaut pour qu’il soit clair ?',
    ['Une seule photo de loin', 'Une photo d’ensemble puis une de près, bien éclairée, nette', 'Une photo floue suffit'],
    1,
    'La vue d’ensemble situe le défaut, la vue de près le montre. La lumière et la netteté font la preuve.',
  ],
  [
    'Où trouver le numéro de série ou d’identification d’un objet ?',
    ['Sur l’annonce seulement', 'Sur l’objet lui-même (étiquette, gravure, réglages) et sur la facture', 'Nulle part'],
    1,
    'Le numéro relevé sur l’objet doit correspondre à la facture et aux papiers.',
  ],
  [
    'Le vendeur refuse que vous testiez l’objet. Que faites-vous ?',
    ['Vous le croyez sur parole', 'Vous le notez comme un signal d’alerte et prévenez le demandeur', 'Vous le testez de force'],
    1,
    'Un vendeur sérieux laisse tester. Un refus est un risque à signaler.',
  ],
  [
    'Quel signe doit faire penser à une arnaque ?',
    ['Un prix très bas, une urgence, des papiers absents ou au nom d’un autre', 'Un vendeur poli', 'Un objet propre'],
    0,
    'Prix anormal, pression pour aller vite et papiers manquants sont les signes classiques.',
  ],
  [
    'Vous n’êtes pas sûr d’un point. Que faites-vous ?',
    ['Vous le présentez comme sûr', 'Vous écrivez honnêtement ce que vous avez vu et ce que vous ne pouvez pas affirmer', 'Vous l’oubliez'],
    1,
    'Un constat honnête, même incomplet, vaut mieux qu’une certitude inventée.',
  ],
];
