/**
 * What the app offers at sign-up, served by GET /app/reference: the identity documents accepted and
 * the trades. Changed here, the app follows without a new version.
 */

/** As the banking apps: an identity card or passport from anywhere, a residence permit, a driving licence. */
export const ID_DOCUMENTS = [
  { id: 'cni', label: 'Carte nationale d’identité', hint: 'France ou autre pays', sides: 2 },
  { id: 'passport', label: 'Passeport', hint: 'Tous pays, page avec la photo', sides: 1 },
  { id: 'residence_permit', label: 'Titre de séjour', hint: 'Carte de séjour ou carte de résident', sides: 2 },
  { id: 'driving_licence', label: 'Permis de conduire', hint: 'Format carte, en cours de validité', sides: 2 },
] as const;

export type IdDocumentId = (typeof ID_DOCUMENTS)[number]['id'];
export const ID_DOCUMENT_IDS = ID_DOCUMENTS.map((d) => d.id) as [IdDocumentId, ...IdDocumentId[]];

/**
 * The live selfie, as the banking apps: after the face straight on (the selfie), the head turned
 * left, right, the chin up, then straight on again. A photo of each, so the team sees a person
 * moving in front of the camera, not a printed photo or a screen.
 */
export const SELFIE_POSES = [
  { id: 'left', label: 'Tourné à gauche' },
  { id: 'right', label: 'Tourné à droite' },
  { id: 'up', label: 'Menton levé' },
  { id: 'front', label: 'De face, à la fin' },
] as const;

export type SelfiePose = (typeof SELFIE_POSES)[number]['id'];

/**
 * Trades, the ones pro missions ask for first (mechanic, bike, it). A member can also write their
 * own; "verifies" marks the trades whose proof can make them a certified verifier.
 */
export const TRADES = [
  { id: 'mechanic', label: 'Mécanicien automobile', verifies: true },
  { id: 'bike', label: 'Réparateur vélo', verifies: true },
  { id: 'it', label: 'Informaticien, réparateur téléphone', verifies: true },
  { id: 'electronics', label: 'Technicien électronique, électroménager', verifies: true },
  { id: 'watchmaker', label: 'Horloger, bijoutier', verifies: true },
  { id: 'furniture', label: 'Menuisier, ébéniste', verifies: true },
  { id: 'electrician', label: 'Électricien', verifies: false },
  { id: 'plumber', label: 'Plombier', verifies: false },
  { id: 'painter', label: 'Peintre, plaquiste', verifies: false },
  { id: 'locksmith', label: 'Serrurier', verifies: false },
  { id: 'gardener', label: 'Jardinier, paysagiste', verifies: false },
  { id: 'mover', label: 'Déménageur', verifies: false },
  { id: 'driver', label: 'Chauffeur, livreur', verifies: false },
  { id: 'cleaner', label: 'Agent d’entretien', verifies: false },
] as const;
