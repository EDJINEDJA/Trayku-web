/** What the admin API returns (see the backend's src/api/admin). */

export type Place = { label: string; city?: string; latitude: number; longitude: number };
export type Person = { id: string; first_name: string; rating: number; rating_count: number; missions_done: number; verified: boolean; avatar_color: string };
export type Photo = { file_id: string; at: string; live: boolean; url: string | null };

export type Mission = {
  id: string;
  mode: string;
  type: string;
  category: string;
  catalog_id: string | null;
  title: string;
  description: string;
  size: string;
  weight_kg: number;
  fragile: boolean;
  photos: string[];
  pickup: Place;
  dropoff: Place;
  pickup_note: string | null;
  dropoff_note: string | null;
  deadline: string;
  window_start: string | null;
  price: number;
  /** ISO 4217: the currency of the mission's amounts. */
  currency_code: string;
  /** Requester's fees on top of the price; Traiku's commission on the Traikeur. */
  service_fee?: number;
  insurance_fee?: number;
  traikeur_rate?: number;
  verify_only_price: number | null;
  declared_value: number;
  status: string;
  review_note: string | null;
  recipient_name: string | null;
  recipient_phone: string | null;
  handler_phone: string | null;
  sender_name: string | null;
  seller: { pseudo?: string; phone: string } | null;
  seller_code: string | null;
  order: { store: string; name: string; ref: string; bags: string; heavy: boolean } | null;
  purchase: { price: number; payment: string; url?: string } | null;
  listing: { brand?: string; model?: string; condition?: string; defects?: string } | null;
  checklist: string[] | null;
  cancel_fee: number | null;
  cancelled_at: string | null;
  created_at: string;
  requester_id: string;
  requester: Person | null;
  metadata: Record<string, unknown> | null;
};

export type RunEvent = { id: string; type: string; actor_id: string | null; payload: Record<string, unknown> | null; created_at: string };

export type Run = {
  id: string;
  step: string;
  status: string;
  traveler_id: string;
  traveler: Person | null;
  accepted_at: string;
  pickup_unlocked_at: string | null;
  picked_at: string | null;
  delivered_at: string | null;
  cancelled_at: string | null;
  locked: boolean;
  code_attempts: number;
  pickup_code: string;
  dropoff_code: string;
  pickup_photo: Photo | null;
  dropoff_photo: Photo | null;
  before_photos: Photo[];
  work_photos: Photo[];
  faces: { file_id: string; at: string; member_id: string; url: string | null }[];
  /** The selfie the Traikeur was verified with at sign-up, to compare the face checks with. */
  reference_selfie?: string | null;
  report: { verdict?: string; summary?: string } | null;
  decision: string | null;
  events: RunEvent[];
};

export type Dispute = {
  id: string;
  mission_id: string;
  run_id: string | null;
  opened_by: string;
  reason: string;
  message: string;
  status: string;
  resolution: string | null;
  resolved_at: string | null;
  created_at: string;
  mission?: { id: string; title: string; status: string } | null;
  opener?: Person | null;
};

export type Member = {
  id: string;
  phone: string;
  email: string | null;
  first_name: string;
  last_name: string | null;
  bio: string | null;
  vehicle: string | null;
  professions: string[];
  verified_phone: boolean;
  verified_id: boolean;
  verifier: { via: 'test' | 'pro'; since: string; in_review?: boolean } | null;
  rating: number;
  rating_count: number;
  missions_done: number;
  status: 'active' | 'suspended';
  suspended_until: string | null;
  created_at: string;
};

export type ApiKey = { id: string; title: string; type: 'publishable' | 'secret'; token: string; redacted: string; last_used_at: string | null; created_by: string; revoked_at: string | null; created_at: string };

export type Message = { id: string; sender_id: string | null; kind: string; body: string; file_id: string | null; created_at: string };
export type Conversation = { id: string; mission_id: string; member_a: string; member_b: string; blocked_by: string | null; reported_at: string | null; messages: Message[] };

export type IdentityCheck = {
  id: string;
  status: 'pending' | 'verified' | 'refused' | 'replaced';
  document_type: string;
  document_label: string;
  front_url: string | null;
  back_url: string | null;
  selfie_url: string | null;
  /** The live selfie's other poses (head left, right, chin up, straight on again). */
  poses: { pose: string; label: string; url: string | null }[];
  reason: string | null;
  provider: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  member: { id: string; first_name: string; last_name: string | null; birth_date: string | null; phone: string } | null;
};

export type Credential = {
  id: string;
  status: 'pending' | 'approved' | 'refused';
  profession: string;
  title: string | null;
  files: string[];
  reason: string | null;
  reviewed_at: string | null;
  created_at: string;
  member: { id: string; first_name: string; last_name: string | null; verified_id: boolean } | null;
};

/** The price scale (GET /admin/pricing): the same type as the apps read (SDK). */
export type { Pricing, PriceLevel } from '../../../sdk/src/types';
export type PricingVersion = { id: string; note: string | null; created_at: string; by: string | null };
/** As Medusa's admin region: currency, countries (ISO, upper case) and the start of its price scale. */
export type RegionMetadata = { area?: Area; minimum_wage?: number; rounding?: number; wage_note?: string };
export type Area = 'europe' | 'afrique' | 'monde-arabe' | 'asie' | 'ameriques';
export type Region = { id: string; name: string; currency_code: string; countries: string[]; metadata: RegionMetadata | null };
export type Currency = { code: string; name: string; symbol: string; symbol_native: string; decimal_digits: number; rounding: number };
export type Country = { iso_2: string; display_name: string; dial: string | null; region_id: string | null };

/** A paid ad, as GET /admin/ads gives it. */
export type AdminAd = {
  id: string;
  placement: 'messages';
  sponsor: string;
  title: string;
  image_file_id: string;
  image_url: string | null;
  url: string;
  starts_at: string | null;
  ends_at: string | null;
  active: boolean;
  views: number;
  clicks: number;
  reports: number;
  click_rate: number;
  created_at: string;
};

/** A member's question to the team (Aide et support). */
export type AdminSupportRequest = {
  id: string;
  member_id: string;
  member: { first_name: string } | null;
  topic: 'mission' | 'payment' | 'account' | 'safety' | 'other';
  message: string;
  status: 'open' | 'answered' | 'closed';
  answer: string | null;
  answered_at: string | null;
  created_at: string;
};
export type { Wallet, Payout as WalletPayout, PayoutAccount, Earning } from '../../../sdk/src/types';
export type Payee = { id: string; first_name: string; last_name: string | null; phone: string; status: string; tax_info: boolean };
export type AdminPayout = {
  id: string;
  amount: number;
  currency_code: string;
  status: 'pending' | 'paid' | 'failed' | 'canceled';
  error: string | null;
  by_team: boolean;
  created_at: string;
  paid_at: string | null;
  member: Payee | null;
  external_id: string | null;
  provider_id: string;
};
export type AdminBalance = {
  member_id: string;
  currency_code: string;
  pending: number;
  available: number;
  count: number;
  member: Payee | null;
  account: { status: 'pending' | 'active' | 'restricted'; hold: boolean; bank_last4: string | null } | null;
};
