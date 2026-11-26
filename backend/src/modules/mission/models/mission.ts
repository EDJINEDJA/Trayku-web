import { model, type AnyDmlEntity } from '@traiku/framework';
import { MISSION_CATEGORIES, MISSION_MODES, MISSION_STATUSES, MISSION_TYPES, PROFESSIONS, SIZES, type ListingInfo, type DepositInfo, type HandoffInfo, type LatLng, type OrderInfo, type ParcelInfo, type Place, type PurchaseInfo, type SellerInfo, type SellerWindow } from '../types';
import Dispute from './dispute';
import Proposal from './proposal';
import Run from './run';

/**
 * What a requester publishes. Transport: carry from pickup to dropoff. On site (onsite, pro): do
 * something at the pickup place. Fields marked private are only for the requester, and for the
 * Traikeur once accepted (see the serializers in src/api/utils).
 */
const Mission = model.define('mission', {
  id: model.id({ prefix: 'mis' }).primaryKey(),
  requester_id: model.text().index(),
  mode: model.enum(MISSION_MODES).default('transport'),
  type: model.enum(MISSION_TYPES),
  category: model.enum(MISSION_CATEGORIES).index(),
  /** Catalogue entry the title comes from; without one, the free title is reviewed by the team first. */
  catalog_id: model.text().nullable(),
  title: model.text(),
  description: model.text().default(''),
  size: model.enum(SIZES).default('S'),
  weight_kg: model.float().default(0),
  declared_value: model.bigNumber().default(0),
  fragile: model.boolean().default(false),
  frozen: model.boolean().default(false),
  /** File ids. */
  photos: model.json<string[]>().default([]),
  pickup: model.json<Place>(),
  dropoff: model.json<Place>(),
  /**
   * The road between the pickup and the drop-off as the public sees them (to about 1 km): drawn at once
   * on the cards, never more exact than the places shown. Null until computed, or with no road.
   */
  road_path: model.json<LatLng[]>().nullable(),
  pickup_note: model.text().nullable(),
  dropoff_note: model.text().nullable(),
  /** Latest delivery; on site, end of the window. */
  deadline: model.dateTime(),
  window_start: model.dateTime().nullable(),
  onsite_minutes: model.number().nullable(),
  /** On site: proven by photos, or by the requester's code when someone is there. */
  proof: model.enum(['photo', 'code']).nullable(),
  profession: model.enum(PROFESSIONS).nullable(),
  recipient_name: model.text().nullable(),
  /** Private. Gets the delivery code by SMS. */
  recipient_phone: model.text().nullable(),
  dropoff_floor: model.number().nullable(),
  dropoff_elevator: model.boolean().nullable(),
  // At the pickup, the same: up to the door or inside (Transport de colis).
  pickup_floor: model.number().nullable(),
  pickup_elevator: model.boolean().nullable(),
  sender_name: model.text().nullable(),
  // The sender's e-mail when it isn't the requester: for the requester and Traiku only, never the Traikeur.
  sender_email: model.text().nullable(),
  // The same for the recipient when it isn't the requester.
  recipient_email: model.text().nullable(),
  /** Private. Whoever hands the parcel over: gets the pickup code by SMS. */
  handler_phone: model.text().nullable(),
  chat_open: model.boolean().default(false),
  order: model.json<OrderInfo>().nullable(),
  handoff: model.json<HandoffInfo>().nullable(),
  parcel: model.json<ParcelInfo>().nullable(),
  deposit: model.json<DepositInfo>().nullable(),
  purchase: model.json<PurchaseInfo>().nullable(),
  seller: model.json<SellerInfo>().nullable(),
  listing: model.json<ListingInfo>().nullable(),
  subject: model.text().nullable(),
  inspect_kind: model.text().nullable(),
  checklist: model.json<string[]>().nullable(),
  min_photos: model.number().nullable(),
  live_call: model.boolean().default(false),
  /** A car's check with the electronic diagnosis (an OBD reader plugged in): paid on top, shown only to Traikeurs who have the reader. */
  obd_diagnostic: model.boolean().default(false),
  appointment: model.dateTime().nullable(),
  // Transport de colis: the pickup is a window, from the appointment to this.
  appointment_end: model.dateTime().nullable(),
  seller_windows: model.json<SellerWindow[]>().nullable(),
  chosen_proposal_id: model.text().nullable(),
  seller_confirmed: model.boolean().default(false),
  /** Private (requester). The requester gives it to the seller, who gives it to the Traikeur on arrival. */
  seller_code: model.text().nullable(),
  /** Vérification et retrait: paid if the item is refused and not picked up. */
  verify_only_price: model.bigNumber().nullable(),
  from_mission_id: model.text().nullable(),
  follow_up_id: model.text().nullable(),
  urgent: model.boolean().default(false),
  /** The region it is priced in (lib/regions.ts) and its currency, from the requester's. */
  region_id: model.text().nullable(),
  currency_code: model.text().default('EUR'),
  /** Paid by the requester; the Traikeur receives it less traikeur_rate. */
  price: model.bigNumber(),
  /** How many Traikeurs it asks (a small job for two or three); the price is shared between them. */
  crew: model.number().default(1),
  /** The places taken so far: the mission stays open, and doesn't start, until crew are. */
  seats_taken: model.number().default(0),
  /** Traiku's commission on what the Traikeur earns, as it was at publication. */
  traikeur_rate: model.float().default(0),
  /** Paid by the requester on top of the price, kept by Traiku (lib/pricing.ts). Private. */
  service_fee: model.bigNumber().default(0),
  insurance_fee: model.bigNumber().default(0),
  cancel_fee: model.bigNumber().nullable(),
  status: model.enum(MISSION_STATUSES).default('open').index(),
  review_note: model.text().nullable(),
  republished_at: model.dateTime().nullable(),
  cancelled_at: model.dateTime().nullable(),
  metadata: model.json().nullable(),
  runs: model.hasMany((): AnyDmlEntity => Run),
  proposals: model.hasMany((): AnyDmlEntity => Proposal),
  disputes: model.hasMany((): AnyDmlEntity => Dispute),
});

export default Mission;
