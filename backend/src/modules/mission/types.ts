/** The shapes of the mission's json columns, as the mobile app has them (src/types.ts). */

export type LatLng = { latitude: number; longitude: number };
export type Place = LatLng & { label: string; city?: string };

export const MISSION_MODES = ['transport', 'onsite', 'pro'] as const;
export const MISSION_TYPES = ['parcel', 'pickup', 'errand', 'handover', 'bulky', 'check', 'task', 'pro'] as const;
export const MISSION_CATEGORIES = ['clickcollect', 'check', 'checkpickup', 'transfer', 'assistance'] as const;
/** awaiting_payment: published, the amount not reserved yet (nobody sees it); then review or open. */
export const MISSION_STATUSES = ['awaiting_payment', 'review', 'open', 'accepted', 'picked_up', 'delivered', 'cancelled'] as const;
/** S an envelope; M, L, XL the post office's boxes (3, 5, 7 kg); XXL bigger or heavier. */
export const SIZES = ['S', 'M', 'L', 'XL', 'XXL'] as const;
export const PROFESSIONS = ['mechanic', 'bike', 'it'] as const;
export const RUN_STEPS = ['confirmed', 'to_pickup', 'inspected', 'picked_up', 'to_dropoff', 'delivered', 'rated'] as const;

export type MissionCategory = (typeof MISSION_CATEGORIES)[number];
export type RunStep = (typeof RUN_STEPS)[number];

/** Clic & Collect: the order waiting at the store. `ref` goes to the Traikeur only once accepted. */
/**
 * Clic & Collect: what the « commande prête » message holds, often several at once (methods). scan:
 * the barcode or QR code (its capture, proofs, is shown to the Traikeur); code: a pickup code
 * (pickup_code); number: the order number (ref). method: the first of them, for older readers. proofs: the captures (private files). id_required: the counter asks the buyer's ID, so the
 * requester signs a mandate in the app (mandate_at) and the Traikeur shows their own ID with it.
 * last_day: the store keeps it until then.
 */
export type OrderMethod = 'scan' | 'code' | 'number';
/**
 * Transport de colis, between private people: where the Traikeur takes the parcel (at the door, or
 * brought down to the street) and how it is left (in hand at the door, in the street, or in the
 * letterbox for a small one: no code then, a photo proves it). help: someone helps to carry, the
 * Traikeur coming alone, with no trolley or straps.
 */
export type HandoffInfo = { pickup: HandoffMode; dropoff: HandoffMode | 'letterbox' | 'counter'; help?: boolean };

/**
 * Dropped at a counter instead of handed to someone: a relay point (Vinted, Leboncoin: the label is on
 * the parcel, or a QR code to show), or a store (a return, an exchange, a repair: the receipt or the
 * return slip, and the name on the purchase). proofs: the captures (file ids). The receipt of the
 * drop, photographed by the Traikeur, proves it.
 */
export type DepositInfo = {
  kind: 'relay' | 'return';
  store: string;
  label_on?: boolean;
  /** No label yet: the deposit code typed (the QR code's letters and digits), with or without its capture. */
  code?: string;
  proofs: string[];
  first_name?: string;
  last_name?: string;
  reason?: 'refund' | 'repair';
};
/** street: at the car, in front of the house; door: up to the door; room: inside, to the room chosen. */
export type HandoffMode = 'street' | 'door' | 'room';

/** Transport de colis: how many pieces, and the exact dimensions when the requester knows them. */
export type ParcelInfo = { quantity: number; length_cm?: number; width_cm?: number; height_cm?: number };

export type OrderInfo = {
  store: string;
  /** Full name on the order (« Rihad ALEX »); first_name and last_name apart when typed apart. */
  name: string;
  first_name?: string;
  last_name?: string;
  ref?: string;
  bags: string;
  heavy: boolean;
  ready_at?: string;
  method?: OrderMethod;
  methods?: OrderMethod[];
  pickup_code?: string;
  proofs?: string[];
  id_required?: boolean;
  mandate_at?: string;
  last_day?: string;
};
/** Vérification: price agreed with the seller, paid by the requester directly (never through the Traikeur). */
export type PurchaseInfo = { url?: string; price?: number; payment?: 'platform' | 'transfer' | 'paid' };
/** The seller isn't on Traiku: their phone goes to the chosen Traikeur only. */
export type SellerInfo = { pseudo?: string; phone: string; email?: string };
export type ListingInfo = {
  brand?: string;
  model?: string;
  serial?: string;
  condition?: 'new' | 'very_good' | 'good' | 'fair' | 'parts';
  defects?: string;
  /** The ad's own text, pasted. */
  description?: string;
  /** What was filled in of the product's fields (GET /app/reference listing_specs), with their names. */
  specs?: { id: string; label: string; value: string }[];
};
export type SellerWindow = { from: string; to: string };

/** A photo taken during the run: the uploaded file, when and where, and whether from the camera. */
export type ProofPhoto = { file_id: string; at: string; coords?: LatLng; live: boolean };
/** A face check: who was there, when. */
export type FaceCheck = { file_id: string; at: string; member_id: string; coords?: LatLng };
