import { model } from '@traiku/framework';

type Place = { latitude: number; longitude: number; label: string; city?: string };

/** A trip a Traikeur publishes: the route is kept to find the missions along it. */
const Trip = model.define('trip', {
  id: model.id({ prefix: 'trip' }).primaryKey(),
  member_id: model.text().index(),
  origin: model.json<Place>(),
  destination: model.json<Place>(),
  stops: model.json<(Place & { stop_minutes: number })[]>().default([]),
  /** { distance_m, duration_s, coordinates: [{ latitude, longitude }], label, via? }. */
  route: model.json<{ distance_m: number; duration_s: number; coordinates: { latitude: number; longitude: number }[]; label?: string; via?: string[]; motorway?: boolean; estimated?: boolean }>(),
  depart_at: model.dateTime().index(),
  flex_minutes: model.number().default(15),
  round_trip: model.boolean().default(false),
  /** 0 = Sunday … 6 = Saturday; empty: one-off. */
  recurring_days: model.json<number[]>().default([]),
  vehicle: model.enum(['car', 'bike', 'foot', 'transit', 'plane']),
  max_size: model.enum(['S', 'M', 'L', 'XL', 'XXL']).default('M'),
  max_weight_kg: model.float().default(10),
  /** { max_detour_min, accepted_categories, min_price, auto_accept_score }. */
  prefs: model.json<{ max_detour_min: number; accepted_categories: string[]; min_price: number; auto_accept_score: number | null }>(),
  status: model.enum(['active', 'done', 'cancelled']).default('active').index(),
});

export default Trip;
