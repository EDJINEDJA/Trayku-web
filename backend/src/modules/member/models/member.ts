import { model } from '@traiku/framework';

/**
 * A person on Traiku, requester and Traikeur alike (Person in the app). Signs in with their phone.
 * The phone and the last name stay private; the others see first name, rating and checks.
 */
const Member = model.define('member', {
  id: model.id({ prefix: 'mem' }).primaryKey(),
  phone: model.text().unique(),
  /** ISO country chosen with the phone at sign-up: it sets the member's region (currency, prices). */
  country: model.text().nullable(),
  email: model.text().nullable(),
  first_name: model.text(),
  last_name: model.text().nullable(),
  civility: model.enum(['mme', 'm']).nullable(),
  /** "YYYY-MM-DD", a calendar day (no time zone): 18 to be a Traikeur. Private. */
  birth_date: model.text().nullable(),
  avatar_color: model.text().default('#7C3AED'),
  /** The profile photo (a file sent by the member); none: the round with the initial. */
  avatar_file_id: model.text().nullable(),
  bio: model.text().nullable(),
  /** How they usually get around: new trips start with it. */
  vehicle: model.enum(['car', 'bike', 'foot', 'transit', 'plane']).nullable(),
  /** Trades declared, from the list ("mechanic", "plumber"…) or written by the member: pro missions are shown to their trade only. */
  professions: model.array().default([]),
  /** Has an OBD reader (a car's diagnostic plug): the car checks with the electronic diagnosis show to them only. */
  obd_reader: model.boolean().default(false),
  /** When the trade question was answered (an empty list: no particular trade). */
  professions_answered_at: model.dateTime().nullable(),
  /** Postal address, geocoded (label as typed or chosen, city, coordinates). Private. */
  address: model.json<{ label: string; city?: string; latitude: number; longitude: number }>().nullable(),
  /**
   * For the earnings: what the platforms must declare to the tax office (DAC7). Private: never
   * shown to others. `tax_number`: the French numéro fiscal (13 digits); `siret` for a micro-entrepreneur.
   */
  /** Adresses favorites: the places saved by name (Maison, Travail…), offered first in every address field. */
  saved_places: model.json<{ id: string; name: string; place: { label: string; city?: string; latitude: number; longitude: number } }[]>().default([]),
  /** « Supprimer mon compte »: asked on this date; the team erases it within 30 days. */
  deletion_requested_at: model.dateTime().nullable(),
  tax_info: model.json<{ status: 'individual' | 'business'; birth_date: string; tax_number: string; siret?: string | null }>().nullable(),
  /** Where they're active: missions are looked for around it. */
  zone: model.json<{ label: string; latitude: number; longitude: number; radius_km: number }>().nullable(),
  /** As a Traikeur: the missions under min_price are not shown to them, and new trips start with it. */
  price_prefs: model.json<{ min_price: number }>().nullable(),
  verified_phone: model.boolean().default(false),
  /** Identity document checked by the team. */
  verified_id: model.boolean().default(false),
  /** Certificate to take verification missions: { via: "test" | "pro", since, in_review? }. */
  verifier: model.json<{ via: 'test' | 'pro'; since: string; in_review?: boolean }>().nullable(),
  rating_avg: model.float().default(0),
  rating_count: model.number().default(0),
  missions_done: model.number().default(0),
  /** Missions given back after the free minutes, to suspend after too many in 30 days. */
  withdrawals: model.json<string[]>().default([]),
  status: model.enum(['active', 'suspended']).default('active'),
  suspended_until: model.dateTime().nullable(),
  metadata: model.json().nullable(),
});

export default Member;
