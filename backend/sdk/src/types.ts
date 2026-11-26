/** The shapes the API sends back (see the backend's src/api/utils/serialize.ts). */

export type Vehicle = 'car' | 'bike' | 'foot' | 'transit' | 'plane';
export type Civility = 'mme' | 'm';

/** The signed-in member, as GET /app/me sends it. */
export type Me = {
  id: string;
  phone: string;
  email: string | null;
  first_name: string;
  last_name: string | null;
  civility: Civility | null;
  /** "YYYY-MM-DD". */
  birth_date: string | null;
  /** Postal address, private. */
  address: Place | null;
  /** Adresses favorites, by name (Maison, Travail…). */
  saved_places: SavedPlace[];
  /** « Supprimer mon compte » asked on this date (erased within 30 days). */
  deletion_requested_at: string | null;
  /** The tax details the earnings are declared with (DAC7), private. */
  tax_info: { status: 'individual' | 'business'; birth_date: string; tax_number: string; siret?: string | null } | null;
  /** Where they're active: missions are looked for around it. */
  zone: Zone | null;
  /** As a Traikeur: missions under min_price are not shown. */
  price_prefs: PricePrefs | null;
  /** ISO code of the phone's country (the region's). */
  country: string | null;
  /** When the trade question was answered (an empty list: no particular trade). */
  professions_answered_at: string | null;
  identity: { status: 'none' | 'pending' | 'verified' | 'refused'; document_type: string | null; reason: string | null; at: string | null };
  /** Sign-up: each part done; the app opens once `done`. */
  onboarding: { identity: boolean; profession: boolean; zone: boolean; done: boolean };
  /** The driving licence sent (the newest), to bring back a car or a motorbike once approved. */
  licence: { status: 'pending' | 'approved' | 'refused'; categories: string[]; reason: string | null } | null;
  /** A new Traikeur: one mission at a time until `needed` are done. Null once past. */
  newcomer: { done: number; needed: number } | null;
  avatar_color: string;
  /** The profile photo (a link that expires); null: the round with the initial. */
  avatar_url: string | null;
  bio: string | null;
  vehicle: Vehicle | null;
  professions: string[];
  /** Has an OBD reader: sees the car checks with the electronic diagnosis. */
  obd_reader: boolean;
  verified_phone: boolean;
  verified_id: boolean;
  verifier: { via: 'test' | 'pro'; since: string; in_review?: boolean } | null;
  rating: number;
  rating_count: number;
  missions_done: number;
  /** Km between pickup and drop-off of the missions done as a Traikeur, as the crow flies. */
  km_shared: number;
  /** Missions given back after the free minutes, in the last 30 days (ISO). */
  withdrawals: string[];
  /** Certificat Traiku obtained, by trade id: when, with what score. */
  certificates: Record<string, { at: string; score: number }>;
  /** A failed Certificat Traiku test, by trade id: when (the next try opens 7 days later). */
  certificate_fails: Record<string, string>;
  status: 'active' | 'suspended';
  suspended_until: string | null;
  created_at: string;
};

/** What every member sees of another one. */
export type PublicMember = {
  id: string;
  first_name: string;
  avatar_color: string;
  civility: Civility | null;
  rating: number;
  rating_count: number;
  missions_done: number;
  verified: boolean;
  vehicle: Vehicle | null;
};

export type Review = {
  id: string;
  rating: number;
  comment: string | null;
  /** The role the author had on the mission. */
  role: string;
  author: PublicMember | null;
  created_at: string;
};

export type RegisterMember = {
  first_name: string;
  last_name?: string | null;
  email?: string | null;
  civility?: Civility | null;
  /** "YYYY-MM-DD". */
  birth_date?: string | null;
  vehicle?: Vehicle | null;
  address?: Place | null;
  /** ISO code of the phone's country: the member's region (currency, prices). */
  country?: string | null;
};

export type Zone = { label: string; latitude: number; longitude: number; radius_km: number };
export type PricePrefs = { min_price: number };

export type PriceLevel = 'simple' | 'skilled' | 'expert';

/** A region, as Medusa's (GET /app/regions): a currency and its countries (ISO 3166, upper case). */
export type Region = { id: string; name: string; currency_code: string; countries: string[] };
/**
 * The price scale (backend: lib/pricing.ts, changed from the dashboard): every number prices, fees
 * and cancellations are computed from. A mission is base_minutes on the SMIC × its level, never under
 * min_price; the requester pays it plus Traiku's fees; the Traikeur receives it less traikeur_rate.
 */
export type Pricing = {
  smic_hourly: number;
  /** Prices are suggested to this step of the currency: 0,50 €, 25 FCFA. */
  rounding: number;
  min_price: number;
  base_minutes: number;
  step_minutes: number;
  max_extra_minutes: number;
  levels: Record<PriceLevel, { label: string; factor: number; examples: string }>;
  fees: { service_rate: number; service_min: number; insurance: number; traikeur_rate: number };
  families: Record<string, { label: string; level: PriceLevel }>;
  /** By catalogue id: a small job's own level and bonus (%), a fixed service's price. */
  services: Record<string, { title: string; family?: string; group?: string; level?: PriceLevel; bonus?: number; price?: number }>;
  urgent: number;
  trade_urgent: number;
  transport: {
    pickup: number;
    per_km: number;
    km_threshold: number;
    per_km_beyond: number;
    sizes: Record<Size, number>;
    weights: { over_kg: number; extra: number }[];
    fragile: number;
    urgent: number;
    /** Carrying at each end, all for the Traikeur: up to the door, inside, per floor without a lift. */
    handling: { door: number; room: number; floor: number };
  };
  clickcollect: { pickup: number; per_km: number; max_km: number; bags: Record<'1' | '2-5' | '6-9' | '10+', number>; heavy: number; urgent: number };
  onsite: {
    travel: number;
    per_minute: number;
    free_checks: number;
    per_check: number;
    photos: { from: number; extra: number }[];
    urgent: number;
    live_call: number;
    /** A car's electronic diagnosis (OBD reader). */
    obd: number;
    verify_only_share: number;
    verify_only_min: number;
    /** A car or a motorbike driven back: taking it in hand, then per km. */
    drive: { pickup: number; per_km: number };
  };
  cancellation: { grace_minutes: number; share_early: number; share_late: number; late_hours: number; min_fee: number; to_traikeur: number };
  /** Until this many missions are done, one at a time. */
  newcomers: { one_at_a_time: number };
};

export type UpdateMe = Partial<RegisterMember> & { bio?: string | null; avatar_color?: string; avatar_file_id?: string | null; professions?: string[]; obd_reader?: boolean; zone?: Zone | null; price_prefs?: PricePrefs | null; tax_info?: Me['tax_info']; saved_places?: SavedPlace[] };

export type SavedPlace = { id: string; name: string; place: Place };

export type SupportTopic = 'mission' | 'payment' | 'account' | 'safety' | 'other';
/** A question to the team (Aide et support) and its answer. */
export type SupportRequest = { id: string; topic: SupportTopic; message: string; status: 'open' | 'answered' | 'closed'; answer: string | null; answered_at: string | null; created_at: string };

/** What the app offers at sign-up (GET /app/reference). */
export type Reference = {
  /** For the phone field: ISO code, French name, calling code ("+33"). */
  countries: { code: string; name: string; dial: string }[];
  default_country: string;
  id_documents: { id: string; label: string; hint: string; sides: 1 | 2 }[];
  /** `verifies`: a proof in that trade can make its holder a certified verifier. */
  trades: { id: string; label: string; verifies: boolean }[];
  /** The member's region (else the asked country's, else France's), as Medusa's store region; null before any exists. */
  region: Pick<Region, 'id' | 'name' | 'currency_code'> | null;
  /** The currency every amount is in: the region's, the euro without one. */
  currency_code: string;
  pricing: Pricing;
  /** The fields asked about an object to check, by kind of product (the app's catalogue keys). */
  listing_specs: Record<string, ListingSpec[]>;
  /** The brands offered for a product (the catalogue keys), or for one of its types (« console/Manette »): the most sold, then the others. */
  listing_brands: Record<string, { popular: string[]; others: string[] }>;
  /** The models offered once the brand is chosen: by catalogue key (or « key/Type » for a product with types), then brand, the newest first. */
  listing_models: Record<string, Record<string, string[]>>;
  /** The form's own fields a product doesn't ask (no Modèle for a T-shirt). */
  listing_hidden: Record<string, ('brand' | 'model' | 'serial')[]>;
  /** The paid ads running now, by place in the app. */
  ads: Ad[];
};

/** A paid ad: a picture (1280 × 400) that opens `url`; `title` is what it says, for screen readers. */
export type Ad = {
  id: string;
  placement: 'messages';
  title: string;
  image_url: string;
  url: string;
};

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
      /** A last line of the sheet that opens a field (« Plus de 512 Go »). */
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

export type SubmitIdentity = { document_type: string; front_file_id: string; back_file_id?: string | null; selfie_file_id: string;
  /** The live selfie's other photos: the head turned left, right, the chin up, straight on again. */
  pose_file_ids: { left: string; right: string; up: string; front: string };
  consent: true;
};

/** A trade proof, or (kind licence) a driving licence, its categories in `title` (« B, A2 »). */
/** Certificat Traiku: a trade's test as the app gets it (no answers), then its result with the corrections. */
export type CertificateTest = {
  trade: string;
  label: string;
  total: number;
  pass: number;
  certified: { at: string; score: number } | null;
  retry_at: string | null;
  questions: { id: string; q: string; options: string[] }[];
};
export type CertificateResult = {
  passed: boolean;
  score: number;
  total: number;
  pass: number;
  retry_at: string | null;
  corrections: { id: string; q: string; picked: string | null; answer: string; right: boolean; why: string }[];
};

/** The general verifier test as the app gets it (no answers), then its result. */
export type VerifierTest = {
  total: number;
  pass: number;
  verifier: { via: 'test' | 'pro'; since: string; in_review?: boolean } | null;
  questions: { id: string; q: string; options: string[] }[];
};
export type VerifierTestResult = {
  passed: boolean;
  score: number;
  total: number;
  pass: number;
  corrections: { id: string; q: string; picked: string | null; answer: string; right: boolean; why: string }[];
  member: Me;
};

export type Credential = { id: string; kind: 'trade' | 'licence'; profession: string; title: string | null; status: 'pending' | 'approved' | 'refused'; reason: string | null; created_at: string };

export type LatLng = { latitude: number; longitude: number };
export type Place = LatLng & { label: string; city?: string };
export type Size = 'S' | 'M' | 'L' | 'XL' | 'XXL';
export type MissionMode = 'transport' | 'onsite' | 'pro';
export type MissionType = 'parcel' | 'pickup' | 'errand' | 'handover' | 'bulky' | 'check' | 'task' | 'pro';
export type MissionCategory = 'clickcollect' | 'check' | 'checkpickup' | 'transfer' | 'assistance';
/** awaiting_payment: published, the amount not reserved yet; only its requester sees it. */
export type MissionStatus = 'awaiting_payment' | 'review' | 'open' | 'accepted' | 'picked_up' | 'delivered' | 'cancelled';
export type RunStep = 'confirmed' | 'to_pickup' | 'inspected' | 'picked_up' | 'to_dropoff' | 'delivered' | 'rated';
export type Profession = 'mechanic' | 'bike' | 'it';

/** A photo sent with /app/uploads, then given in a step: when and where it was taken. */
export type ProofPhotoInput = { file_id: string; at: string; coords?: LatLng; live: boolean };
/** As the API sends it back: with a link that expires. */
export type ProofPhoto = ProofPhotoInput & { url: string | null };

/** A store chain or a pickup network, offered in the « Enseigne » field. */
export type BrandKind = 'store' | 'relay' | 'drive' | 'pressing' | 'other';
export type Brand = { name: string; kind: BrandKind };

/** Clic & Collect: scan (barcode or QR code capture), code (pickup code), number (order number and name). */
export type OrderMethod = 'scan' | 'code' | 'number';
/** Transport de colis: how many pieces, and the exact dimensions (cm) when known. */
export type ParcelInfo = { quantity: number; length_cm?: number; width_cm?: number; height_cm?: number };

/** Transport de colis: where the parcel is taken and how it is left (letterbox: no code, a photo). */
export type Handoff = { pickup: HandoffMode; dropoff: HandoffMode | 'letterbox' | 'counter'; help?: boolean };
/** Dropped at a relay point or brought back to a store; proofs: links once read, file ids when sent. */
export type Deposit = {
  kind: 'relay' | 'return';
  store: string;
  label_on?: boolean;
  code?: string;
  proofs?: string[];
  first_name?: string;
  last_name?: string;
  reason?: 'refund' | 'repair';
};
/** street: at the car, in front of the house; door: up to the door; room: inside, to the room chosen. */
export type HandoffMode = 'street' | 'door' | 'room';

/** name, ref, proofs (capture links) and mandate_at: for the requester, and the Traikeur once at the counter. */
export type OrderInfo = {
  store: string;
  /** The name as shown before the counter: « Rihad A. ». */
  holder: string;
  /** The full name (« Rihad ALEX »), at the counter only. */
  name?: string;
  first_name?: string;
  last_name?: string;
  ref?: string;
  bags: '1' | '2-5' | '6-9' | '10+';
  heavy: boolean;
  ready_at?: string;
  method: OrderMethod;
  /** All the message holds (a capture, a pickup code, an order number). */
  methods: OrderMethod[];
  pickup_code?: string;
  proofs?: string[];
  id_required: boolean;
  mandate_at?: string;
  last_day?: string;
};
export type PurchaseInfo = { url?: string; price?: number; payment?: 'platform' | 'transfer' | 'paid' };
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

export type Proposal = { id: string; at: string; status: 'pending' | 'sent' | 'accepted' | 'declined'; by: PublicMember | null; mine: boolean };

/** The run, for its Traikeur (no codes) or its requester (codes and face checks). */
export type Run = {
  id: string;
  mission_id: string;
  step: RunStep;
  status: 'active' | 'done' | 'cancelled';
  accepted_at: string;
  pickup_unlocked_at: string | null;
  pickup_code_at: string | null;
  seller_checked_at: string | null;
  picked_at: string | null;
  delivered_at: string | null;
  cancelled_at: string | null;
  /** Three wrong codes: blocked until the support unlocks it. */
  locked: boolean;
  code_attempts: number;
  pickup_photo: ProofPhoto | null;
  dropoff_photo: ProofPhoto | null;
  before_photos: ProofPhoto[];
  work_photos: ProofPhoto[];
  report: (Record<string, unknown> & { verdict: 'ok' | 'reserves' | 'refuse'; photos: ProofPhoto[] }) | null;
  report_sent_at: string | null;
  decision: 'accepted' | 'refused' | 'expired' | null;
  decided_at: string | null;
  leg_started_at: string | null;
  leg_from: LatLng | null;
  tip: number;
  /** On site: extra time accepted by the requester, paid on top of the price. */
  extra_minutes: number;
  extra_amount: number;
  /** Asked by the Traikeur, waiting for the requester. */
  extra_request: { minutes: number; amount: number; reason: string | null; at: string } | null;
  traveler: PublicMember | null;
  trip_id?: string | null;
  /** Requester only. */
  pickup_code?: string;
  dropoff_code?: string;
  faces?: { at: string; url: string | null }[];
};

/** A mission as the member sees it: public (area only), as its Traikeur, or as its requester. */
export type Mission = {
  /** An assistance service, to the Traikeur once arrived: the requester's phone, to call them. */
  requester_phone?: string | null;
  /** Why it closed, to its requester: « no_show » (absent on arrival), « expired », « verify_only ». */
  outcome?: string | null;
  id: string;
  role: 'public' | 'traveler' | 'requester';
  mode: MissionMode;
  type: MissionType;
  category: MissionCategory;
  catalog_id: string | null;
  title: string;
  description: string | null;
  size: Size;
  weight_kg: number;
  fragile: boolean;
  frozen: boolean;
  photos: string[];
  pickup: Place;
  dropoff: Place;
  /** The road between pickup and drop-off as the public sees them (to about 1 km); null until computed. */
  road_path: LatLng[] | null;
  deadline: string;
  window_start: string | null;
  onsite_minutes: number | null;
  proof: 'photo' | 'code' | null;
  profession: Profession | null;
  dropoff_floor: number | null;
  dropoff_elevator: boolean | null;
  pickup_floor: number | null;
  pickup_elevator: boolean | null;
  chat_open: boolean;
  handoff: Handoff | null;
  parcel: ParcelInfo | null;
  deposit: Deposit | null;
  order: OrderInfo | null;
  purchase: PurchaseInfo | null;
  listing: ListingInfo | null;
  subject: string | null;
  inspect_kind: string | null;
  checklist: string[] | null;
  min_photos: number | null;
  live_call: boolean;
  /** A car's check with the electronic diagnosis: only for Traikeurs with an OBD reader. */
  obd_diagnostic: boolean;
  appointment: string | null;
  /** Transport de colis: the end of the pickup window. */
  appointment_end: string | null;
  seller_windows: SellerWindow[] | null;
  seller_confirmed: boolean;
  urgent: boolean;
  price: number;
  /** Several Traikeurs (a small job for two or three): how many, the places taken, each one's share. */
  crew: number;
  seats_taken: number;
  price_each: number;
  /** What one Traikeur receives (their share), Traiku's commission taken. */
  payout: number;
  traikeur_rate: number;
  /** ISO 4217: the currency of every amount of the mission. */
  currency_code: string;
  verify_only_price: number | null;
  status: MissionStatus;
  republished_at: string | null;
  created_at: string;
  requester: PublicMember | null;
  run: Run | null;
  /** A crew: who is on it and where each stands (null for a single Traikeur). */
  team: { run_id: string; traveler: PublicMember | null; step: string; status: string; mine: boolean }[] | null;
  proposals: Proposal[];
  chosen_proposal_id: string | null;
  /** The rating I gave after this mission. */
  my_rating: number | null;
  /** The requester's own: what is reserved on their card or PayPal, then captured or released. */
  payment?: Payment | null;
  /** Traikeur and requester. */
  pickup_note?: string | null;
  dropoff_note?: string | null;
  recipient_name?: string | null;
  sender_name?: string | null;
  handler_phone?: string | null;
  seller?: SellerInfo | null;
  /** Requester only. */
  recipient_phone?: string | null;
  sender_email?: string | null;
  recipient_email?: string | null;
  declared_value?: number;
  seller_code?: string | null;
  review_note?: string | null;
  cancel_fee?: number | null;
  /** Requester only: Traiku's fees, paid on top of the price. */
  service_fee?: number;
  insurance_fee?: number;
  cancelled_at?: string | null;
  from_mission_id?: string | null;
  follow_up_id?: string | null;
  /** In a search near a point / on a trip. */
  distance_m?: number;
  detour_m?: number;
};

export type CreateMission = {
  mode?: MissionMode;
  type: MissionType;
  category: MissionCategory;
  catalog_id?: string | null;
  title: string;
  description?: string;
  size?: Size;
  weight_kg?: number;
  declared_value?: number;
  fragile?: boolean;
  frozen?: boolean;
  /** File ids from /app/uploads. */
  photos?: string[];
  pickup: Place;
  dropoff?: Place | null;
  pickup_note?: string | null;
  dropoff_note?: string | null;
  deadline: string;
  window_start?: string | null;
  onsite_minutes?: number | null;
  proof?: 'photo' | 'code' | null;
  profession?: Profession | null;
  recipient_name?: string | null;
  recipient_phone?: string | null;
  dropoff_floor?: number | null;
  dropoff_elevator?: boolean | null;
  pickup_floor?: number | null;
  pickup_elevator?: boolean | null;
  sender_name?: string | null;
  handler_phone?: string | null;
  sender_email?: string | null;
  recipient_email?: string | null;
  chat_open?: boolean;
  handoff?: Handoff | null;
  parcel?: ParcelInfo | null;
  deposit?: Deposit | null;
  order?: {
    store: string;
    name: string;
    first_name?: string;
    last_name?: string;
    ref?: string;
    bags: '1' | '2-5' | '6-9' | '10+';
    heavy: boolean;
    ready_at?: string;
    method: OrderMethod;
    methods?: OrderMethod[];
    pickup_code?: string;
    /** Uploaded file ids. */
    proofs?: string[];
    id_required?: boolean;
    mandate?: boolean;
    last_day?: string;
  } | null;
  purchase?: PurchaseInfo | null;
  seller?: SellerInfo | null;
  listing?: ListingInfo | null;
  subject?: string | null;
  inspect_kind?: string | null;
  /** Several Traikeurs, for a small job on site (2 or 3). */
  crew?: number;
  checklist?: string[] | null;
  min_photos?: number | null;
  live_call?: boolean;
  obd_diagnostic?: boolean;
  appointment?: string | null;
  appointment_end?: string | null;
  seller_windows?: SellerWindow[] | null;
  verify_only_price?: number | null;
  urgent?: boolean;
  from_mission_id?: string | null;
  price: number;
};

/** What cancelling costs now. */
export type CancelTerms = { allowed: boolean; fee: number; toTraikeur: number; toTraiku: number; refund: number; why: string };

export type Trip = {
  id: string;
  member_id: string;
  origin: Place;
  destination: Place;
  stops: (Place & { stop_minutes: number })[];
  route: { distance_m: number; duration_s: number; coordinates: LatLng[]; label?: string; via?: string[]; motorway?: boolean; estimated?: boolean };
  depart_at: string;
  flex_minutes: number;
  round_trip: boolean;
  recurring_days: number[];
  vehicle: Vehicle;
  max_size: Size;
  max_weight_kg: number;
  prefs: { max_detour_min: number; accepted_categories: MissionCategory[]; min_price: number; auto_accept_score: number | null };
  status: 'active' | 'done' | 'cancelled';
  created_at: string;
};

export type CreateTrip = Omit<Trip, 'id' | 'member_id' | 'status' | 'created_at'>;

export type ConversationSummary = {
  id: string;
  mission: { id: string; title: string } | null;
  with: PublicMember | null;
  last_message: { body: string; kind: string; created_at: string; mine: boolean } | null;
  unread: number;
  blocked: boolean;
};

export type Message = { id: string; from: 'me' | 'them' | 'system'; kind: string; body: string; image: string | null; created_at: string; read_at: string | null };

export type DisputeReason = 'absent' | 'not_conform' | 'damaged' | 'late' | 'payment' | 'behaviour' | 'other';

/** A file to send (React Native: { uri, name, type }; browser: a File). */
export type UploadFile = { uri: string; name: string; type: string } | Blob;

export type PaymentMode = 'test' | 'live';
/** A way to pay: system (test, nothing charged), stripe (card, Apple Pay, Google Pay), paypal. */
export type PaymentProvider = { id: string; label: string; mode: PaymentMode };
export type Payment = {
  id: string;
  provider_id: string;
  mode: PaymentMode;
  status: 'pending' | 'authorized' | 'captured' | 'canceled' | 'error';
  amount: number;
  captured_amount: number;
  refunded_amount: number;
  currency_code: string;
};

/** Where a Traikeur's earnings go: none yet, details still asked, ready, or more asked by the provider. */
export type PayoutAccountStatus = 'none' | 'pending' | 'active' | 'restricted';
export type PayoutAccount = {
  provider_id: string;
  /** The test provider: the app asks the holder and the IBAN itself (savePayoutBank). */
  takes_bank_details: boolean;
  status: PayoutAccountStatus;
  bank_last4: string | null;
  holder: string | null;
  /** The team stopped the transfers. */
  hold: boolean;
  hold_reason: string | null;
  currently_due: string[];
};
export type EarningKind = 'mission' | 'verify_only' | 'cancellation' | 'no_show';
/** What one mission brought: pending during the wait (or a dispute), then available, then paid. */
export type Earning = {
  id: string;
  mission_id: string;
  title: string | null;
  kind: EarningKind;
  amount: number;
  currency_code: string;
  status: 'pending' | 'available' | 'paid';
  available_at: string;
  created_at: string;
};
export type Payout = {
  id: string;
  amount: number;
  currency_code: string;
  status: 'pending' | 'paid' | 'failed' | 'canceled';
  error: string | null;
  by_team: boolean;
  created_at: string;
  paid_at: string | null;
};
export type Balance = { currency_code: string; pending: number; available: number; paid: number };
export type Wallet = {
  account: PayoutAccount;
  balances: Balance[];
  /** Hours an earning waits before it can be withdrawn. */
  hold_hours: number;
  /** The least that can be withdrawn, in the currency's main unit. */
  min_amount: number;
  earnings: Earning[];
  payouts: Payout[];
};
