import type { Client, Query } from './client';
import type {
  CertificateResult,
  PayoutAccount,
  Payout,
  Wallet,
  CertificateTest,
  VerifierTest,
  VerifierTestResult,
  Brand,
  BrandKind,
  SupportRequest,
  SupportTopic,
  Region,
  CancelTerms,
  Payment,
  PaymentMode,
  PaymentProvider,
  ConversationSummary,
  CreateMission,
  CreateTrip,
  DisputeReason,
  LatLng,
  Me,
  Message,
  Mission,
  MissionCategory,
  Credential,
  Reference,
  SubmitIdentity,
  ProofPhotoInput,
  PublicMember,
  Review,
  Trip,
  UpdateMe,
  UploadFile,
} from './types';

type Page = { limit?: number; offset?: number };
type Coords = { coords?: LatLng | null };
type One = { mission: Mission };
type List = { missions: Mission[]; count: number };

/** The routes of the app (/app/*), as Medusa's sdk.store. */
export class App {
  constructor(private readonly client: Client) {}

  private get = <T>(path: string, query?: Query) => this.client.fetch<T>(path, { query });
  private post = <T>(path: string, body?: unknown) => this.client.fetch<T>(path, { method: 'POST', body: body ?? {} });
  private id = (id: string) => encodeURIComponent(id);

  me = {
    retrieve: () => this.get<{ member: Me }>('/app/me'),
    update: (data: UpdateMe) => this.post<{ member: Me }>('/app/me', data),
    /** The missions I published, with their run. */
    missions: (query: Page = {}) => this.get<List>('/app/me/missions', query),
    /** The missions I took as a Traikeur. */
    runs: (query: Page = {}) => this.get<List>('/app/me/runs', query),
    trips: (query: Page = {}) => this.get<{ trips: Trip[]; count: number }>('/app/me/trips', query),
    /** The document (front, back) and the live selfie, uploaded first; the team or the provider checks them. */
    submitIdentity: (data: SubmitIdentity) => this.post<{ member: Me }>('/app/me/identity', data),
    credentials: () => this.get<{ credentials: Credential[] }>('/app/me/credentials'),
    /** Certificat Traiku of a trade: its questions (no answers), then the answers sent, scored by the API. */
    certificateTest: (trade: string) => this.get<CertificateTest>(`/app/me/certificates/${encodeURIComponent(trade)}`),
    answerCertificate: (trade: string, answers: Record<string, string>) => this.post<CertificateResult>(`/app/me/certificates/${encodeURIComponent(trade)}`, { answers }),
    /** The general verifier test: questions from the ground (no answers), then answers scored by the API. */
    verifierTest: () => this.get<VerifierTest>('/app/me/verifier-test'),
    answerVerifierTest: (answers: Record<string, string | number>) => this.post<VerifierTestResult>('/app/me/verifier-test', { answers }),
    /** A trade proof (diploma, certificate), to become a certified verifier in that trade. */
    /** Aide et support: my questions and their answers; a new one. */
    support: () => this.get<{ requests: SupportRequest[] }>('/app/me/support'),
    writeSupport: (data: { topic: SupportTopic; message: string }) => this.post<{ request: SupportRequest }>('/app/me/support', data),
    /** Everything Traiku holds about me (RGPD), as JSON. */
    exportData: () => this.get<Record<string, unknown>>('/app/me/export'),
    /** « Supprimer mon compte »: erased by the team within 30 days. */
    requestDeletion: () => this.post<{ requested: true }>('/app/me/delete-request'),
    submitCredential: (data: { kind?: 'trade' | 'licence'; profession: string; title?: string | null; file_ids: string[] }) => this.post<{ credential: Credential }>('/app/me/credentials', data),
    /** My wallet: where my earnings go, what I have (waiting, available, paid), my earnings and payouts. */
    wallet: () => this.get<Wallet>('/app/me/wallet'),
    /** Sets up where my earnings go: the provider's page to open (url), back into the app at return_to. */
    setupPayoutAccount: (data: { return_to?: string | null } = {}) => this.post<{ account: PayoutAccount; url: string | null }>('/app/me/payout-account', data),
    /** The test provider: the holder and the IBAN (only the last digits are kept). */
    savePayoutBank: (data: { holder: string; iban: string }) => this.post<{ account: PayoutAccount }>('/app/me/payout-account/bank', data),
    /** Back from the provider's page: where my account stands. */
    syncPayoutAccount: () => this.post<{ account: PayoutAccount }>('/app/me/payout-account/sync'),
    /** The provider's page of my transfers to the bank (to change the IBAN too); null without one. */
    payoutDashboard: () => this.get<{ url: string | null }>('/app/me/payout-account/dashboard'),
    /** Withdraws all that is available. */
    withdraw: () => this.post<{ payouts: Payout[]; wallet: Wallet }>('/app/me/payouts'),
  };

  /** What the app offers at sign-up: identity documents, trades. */
  /** Signed in: the member's region and its prices; otherwise those of `country` (ISO), else the default region's. */
  /** The regions and their currencies, as Medusa's store.region.list(). */
  regions = () => this.get<{ regions: Region[]; count: number }>('/app/regions');
  /** Chains and pickup networks to offer as one types the « Enseigne » (the closest match first). */
  brands = (q: string, kind?: BrandKind) => this.get<{ brands: Brand[] }>('/app/brands', { q, ...(kind && { kind }) });
  /** The ways to pay, and whether real money moves (live) or not (test). */
  paymentProviders = () => this.get<{ mode: PaymentMode; providers: PaymentProvider[] }>('/app/payments/providers');
  reference = (country?: string) => this.get<Reference>('/app/reference', country ? { country } : undefined);

  members = {
    /** A public profile and its latest reviews. */
    retrieve: (id: string, query: Page = {}) => this.get<{ member: PublicMember; bio: string | null; reviews: Review[]; count: number }>(`/app/members/${this.id(id)}`, query),
  };

  missions = {
    /** The open missions; near a point (nearest first) when lat/lng are given. */
    list: (query: Page & { category?: MissionCategory; lat?: number; lng?: number; radius_km?: number } = {}) => this.get<List & { limit: number; offset: number }>('/app/missions', query),
    retrieve: (id: string) => this.get<One>(`/app/missions/${this.id(id)}`),
    create: (data: CreateMission) => this.post<One>('/app/missions', data),
    accept: (id: string, data: { trip_id?: string | null } = {}) => this.post<One>(`/app/missions/${this.id(id)}/accept`, data),
    /** What cancelling would cost now. */
    /** Pays a mission just published: reserved at once (test payment), or the provider's page to open, then confirmPayment. */
    pay: (id: string, data: { provider_id: string; return_to?: string }) => this.post<One & { payment: Payment; redirect_url: string | null }>(`/app/missions/${this.id(id)}/payment`, data),
    /** Back from the provider's page: where the payment stands. */
    confirmPayment: (id: string) => this.post<One & { payment: Payment | null }>(`/app/missions/${this.id(id)}/payment/confirm`),
    cancelTerms: (id: string) => this.get<{ terms: CancelTerms }>(`/app/missions/${this.id(id)}/cancel`),
    cancel: (id: string) => this.post<{ terms: CancelTerms }>(`/app/missions/${this.id(id)}/cancel`),
    /** Before accepting, when the requester allows it: the conversation to ask a question. */
    ask: (id: string) => this.post<{ conversation: { id: string; mission_id: string } }>(`/app/missions/${this.id(id)}/questions`),
    /** With a seller: a time to go there, within the seller's windows. */
    proposeTime: (id: string, at: string) => this.post<One>(`/app/missions/${this.id(id)}/proposals`, { at }),
    /** The requester picks the time to send to the seller (null: picks again). */
    chooseProposal: (id: string, proposalId: string | null) => this.post<One>(`/app/missions/${this.id(id)}/proposals/choose`, { proposal_id: proposalId }),
    /** The seller agreed: the mission goes to that Traikeur. */
    confirmSeller: (id: string) => this.post<One>(`/app/missions/${this.id(id)}/seller-confirm`),
  };

  /** The steps of a mission once accepted (run id, not mission id). Each returns the mission as it now is. */
  runs = {
    retrieve: (id: string) => this.get<One>(`/app/runs/${this.id(id)}`),
    startLeg: (id: string, data: { leg: 'pickup' | 'dropoff' } & Coords) => this.post<One>(`/app/runs/${this.id(id)}/leg`, data),
    faceCheck: (id: string, data: { file_id: string } & Coords) => this.post<One>(`/app/runs/${this.id(id)}/face`, data),
    sellerCode: (id: string, data: { code: string } & Coords) => this.post<One>(`/app/runs/${this.id(id)}/seller-code`, data),
    pickupCode: (id: string, data: { code: string } & Coords) => this.post<One>(`/app/runs/${this.id(id)}/pickup-code`, data),
    sendReport: (id: string, data: { report: Record<string, unknown> & { verdict: 'ok' | 'reserves' | 'refuse'; photos: ProofPhotoInput[] } } & Coords) =>
      this.post<One>(`/app/runs/${this.id(id)}/report`, data),
    decide: (id: string, decision: 'accepted' | 'refused') => this.post<One>(`/app/runs/${this.id(id)}/decision`, { decision }),
    confirmPickup: (id: string, data: { code?: string; photo?: ProofPhotoInput | null } & Coords) => this.post<One>(`/app/runs/${this.id(id)}/pickup`, data),
    confirmDropoff: (id: string, data: { code?: string; photo?: ProofPhotoInput | null } & Coords) => this.post<One>(`/app/runs/${this.id(id)}/dropoff`, data),
    onsitePhotos: (id: string, data: { kind: 'before' | 'work'; photos: ProofPhotoInput[] } & Coords) => this.post<One>(`/app/runs/${this.id(id)}/photos`, data),
    complete: (id: string, data: { checks: string[]; code?: string } & Coords) => this.post<One>(`/app/runs/${this.id(id)}/complete`, data),
    /** The Traikeur gives the mission back: free in the first minutes, counted after. */
    release: (id: string, data: Coords = {}) => this.post<One & { free: boolean; suspended: boolean }>(`/app/runs/${this.id(id)}/release`, data),
    /** An assistance service, the requester absent on arrival: the Traikeur stops, paid for the trip. */
    noShow: (id: string, data: Coords = {}) => this.post<One>(`/app/runs/${this.id(id)}/no-show`, data),
    setTip: (id: string, tip: number | null) => this.post<One>(`/app/runs/${this.id(id)}/tip`, { tip }),
    requestExtraTime: (id: string, minutes: number, reason?: string | null) => this.post<One>(`/app/runs/${this.id(id)}/extra-time`, { minutes, reason }),
    answerExtraTime: (id: string, accept: boolean) => this.post<One>(`/app/runs/${this.id(id)}/extra-time/answer`, { accept }),
  };

  trips = {
    create: (data: CreateTrip) => this.post<{ trip: Trip }>('/app/trips', data),
    retrieve: (id: string) => this.get<{ trip: Trip }>(`/app/trips/${this.id(id)}`),
    cancel: (id: string) => this.client.fetch<{ trip: Trip }>(`/app/trips/${this.id(id)}`, { method: 'DELETE' }),
    /** The open missions on the trip's way, smallest detour first. */
    missions: (id: string, query: Page = {}) => this.get<{ missions: Mission[]; count: number }>(`/app/trips/${this.id(id)}/missions`, query),
  };

  reviews = {
    create: (data: { mission_id: string; rating: number; comment?: string | null }) => this.post<{ review: { id: string; rating: number; comment: string | null; created_at: string } }>('/app/reviews', data),
  };

  ads = {
    /** Seen (once per display) or opened: counted for the sponsor. */
    track: (id: string, type: 'view' | 'click') => this.post<null>(`/app/ads/${this.id(id)}/events`, { type }),
    /** « Signaler cette publicité ». */
    report: (id: string) => this.post<null>(`/app/ads/${this.id(id)}/report`),
  };

  disputes = {
    create: (data: { mission_id: string; reason: DisputeReason; message: string }) => this.post<{ dispute: { id: string; status: string; reason: DisputeReason; created_at: string } }>('/app/disputes', data),
  };

  conversations = {
    list: () => this.get<{ conversations: ConversationSummary[] }>('/app/conversations'),
    /** Newest first; the other's messages are marked read. */
    messages: (id: string, query: Page = {}) => this.get<{ messages: Message[]; count: number; blocked: boolean }>(`/app/conversations/${this.id(id)}/messages`, query),
    send: (id: string, data: { body?: string; file_id?: string | null }) => this.post<{ message: Message }>(`/app/conversations/${this.id(id)}/messages`, data),
    block: (id: string) => this.post<{ blocked: true }>(`/app/conversations/${this.id(id)}/block`),
    /** Only the one who blocked can unblock. */
    unblock: (id: string) => this.client.fetch<{ blocked: false }>(`/app/conversations/${this.id(id)}/block`, { method: 'DELETE' }),
    report: (id: string) => this.post<{ reported: true }>(`/app/conversations/${this.id(id)}/report`),
  };

  uploads = {
    /** Photos (10 at most, 10 MB each): their ids, to give in the steps and messages. */
    create: (files: UploadFile[]) => {
      const form = new FormData();
      for (const f of files) form.append('files', f as Blob);
      return this.client.fetch<{ files: { id: string; url: string }[] }>('/app/uploads', { method: 'POST', body: form, timeoutMs: 120_000 });
    },
  };
}
