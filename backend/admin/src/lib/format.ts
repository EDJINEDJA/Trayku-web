const dateTime = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const day = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
const money = new Map<string, Intl.NumberFormat>();

export const formatDateTime = (v?: string | null) => (v ? dateTime.format(new Date(v)) : '—');
export const formatDate = (v?: string | null) => (v ? day.format(new Date(v)) : '—');
/** An amount in its currency (a mission's currency_code; the euro by default). */
export const formatPrice = (v?: number | null, currency = 'EUR') => {
  if (v === null || v === undefined) return '—';
  if (!money.has(currency)) money.set(currency, new Intl.NumberFormat('fr-FR', { style: 'currency', currency }));
  return money.get(currency)!.format(v);
};

type Tone = 'green' | 'orange' | 'red' | 'blue' | 'neutral';

export const MISSION_STATUS: Record<string, { label: string; tone: Tone }> = {
  awaiting_payment: { label: 'À payer', tone: 'neutral' },
  review: { label: 'À valider', tone: 'orange' },
  open: { label: 'Ouverte', tone: 'blue' },
  accepted: { label: 'Acceptée', tone: 'blue' },
  picked_up: { label: 'En route', tone: 'blue' },
  delivered: { label: 'Terminée', tone: 'green' },
  cancelled: { label: 'Annulée', tone: 'neutral' },
};

export const CATEGORY: Record<string, string> = {
  clickcollect: 'Clic & Collect',
  check: 'Vérification',
  checkpickup: 'Vérification et retrait',
  transfer: 'Collecte et dépôt de colis',
  assistance: 'Sur place',
};

export const RUN_STEP: Record<string, string> = {
  confirmed: 'Acceptée',
  to_pickup: 'En route vers la prise en charge',
  inspected: 'Rapport envoyé',
  picked_up: 'Objet pris en charge',
  to_dropoff: 'En route vers la remise',
  delivered: 'Terminée',
  rated: 'Notée',
};

export const RUN_STATUS: Record<string, { label: string; tone: Tone }> = {
  active: { label: 'En cours', tone: 'blue' },
  done: { label: 'Terminée', tone: 'green' },
  cancelled: { label: 'Annulée', tone: 'neutral' },
};

export const RUN_EVENT: Record<string, string> = {
  accepted: 'Mission acceptée',
  leg_pickup: 'Départ vers la prise en charge',
  leg_dropoff: 'Départ vers la remise',
  face_checked: 'Visage vérifié',
  seller_checked: 'Code du vendeur validé',
  report_sent: 'Rapport envoyé',
  decision_accepted: 'Achat validé par le demandeur',
  decision_refused: 'Achat refusé par le demandeur',
  decision_expired: 'Pas de réponse au rapport',
  picked_up: 'Objet pris en charge',
  delivered: 'Mission terminée',
  photos_before: 'Photos en arrivant',
  photos_work: 'Photos une fois fini',
  code_wrong: 'Code faux',
  released: 'Mission rendue par le Traikeur',
  cancelled_by_requester: 'Annulée par le demandeur',
  dispute_opened: 'Problème signalé',
  unlocked_by_support: 'Débloquée par le support',
};

export const DISPUTE_REASON: Record<string, string> = {
  absent: 'Personne au rendez-vous',
  not_conform: 'Objet non conforme',
  damaged: 'Objet abîmé',
  late: 'Retard',
  payment: 'Paiement',
  behaviour: 'Comportement',
  other: 'Autre',
};

export const DISPUTE_STATUS: Record<string, { label: string; tone: Tone }> = {
  open: { label: 'Ouvert', tone: 'orange' },
  resolved: { label: 'Résolu', tone: 'green' },
  rejected: { label: 'Rejeté', tone: 'neutral' },
};

export const PAYOUT_STATUS: Record<string, { label: string; tone: Tone }> = {
  pending: { label: 'En cours', tone: 'orange' },
  paid: { label: 'Envoyé', tone: 'green' },
  failed: { label: 'Échoué', tone: 'red' },
  canceled: { label: 'Annulé', tone: 'neutral' },
};

export const PAYOUT_ACCOUNT: Record<string, { label: string; tone: Tone }> = {
  none: { label: 'Aucun compte', tone: 'neutral' },
  pending: { label: 'À compléter', tone: 'orange' },
  restricted: { label: 'Pièces demandées', tone: 'orange' },
  active: { label: 'Prêt', tone: 'green' },
};

export const EARNING_KIND: Record<string, string> = { mission: 'Mission', verify_only: 'Vérification seule', cancellation: 'Annulation tardive', no_show: 'Client absent' };
export const EARNING_STATUS: Record<string, { label: string; tone: Tone }> = {
  pending: { label: 'En attente', tone: 'orange' },
  available: { label: 'Disponible', tone: 'blue' },
  paid: { label: 'Versé', tone: 'green' },
};

export const VEHICLE: Record<string, string> = { car: 'Voiture', bike: 'Vélo', foot: 'À pied', transit: 'Transports', plane: 'Avion' };
export const PROFESSION: Record<string, string> = { mechanic: 'Mécanique', bike: 'Vélo', it: 'Informatique' };

export type { Tone };

const rating = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 });
export const formatRating = (v: number) => `${rating.format(v)} sur 5`;
