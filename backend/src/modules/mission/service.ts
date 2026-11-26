import { randomDigits, safeEqual, TraikuError, TraikuService } from '@traiku/framework';
import Dispute from './models/dispute';
import Mission from './models/mission';
import Proposal from './models/proposal';
import Run from './models/run';
import RunEvent from './models/run-event';
import type { LatLng } from './types';

export type MissionRow = Awaited<ReturnType<MissionModuleService['retrieveMission']>>;
export type RunRow = Awaited<ReturnType<MissionModuleService['retrieveRun']>>;

export const CODE_TRIES = 3;

/** Search of the open missions, done by Postgres (PostGIS): only one page ever leaves the database. */
export type OpenSearch = {
  deadlineAfter: Date;
  excludeRequester?: string | null;
  categories?: string[];
  /** The searcher's trades: pro missions only show to them. */
  professions: string[];
  /** Has an OBD reader: the car checks with the electronic diagnosis show only then. */
  obdReader: boolean;
  minPrice?: number;
  maxWeightKg?: number;
  sizes?: string[];
  /** Around a point, nearest first. */
  near?: { latitude: number; longitude: number; radiusM: number };
  /** Along a route: pickup and dropoff in the corridor, in the right order; the smallest detour first. */
  route?: { coordinates: LatLng[]; corridorM: number };
  /**
   * By train, bus or plane: only where the Traikeur gets off (departure, stops, arrival, in order).
   * The pickup near one of them, the drop-off near the same one or a later one; the smallest detour first.
   */
  stations?: { points: LatLng[]; radiusM: number };
  take: number;
  skip: number;
};

export type FoundMission = MissionRow & { distance_m: number | null; detour_m: number | null };

const pick = (o: Record<string, unknown>, keys: string[]) => Object.fromEntries(keys.map((k) => [k, o[k]]));

export default class MissionModuleService extends TraikuService({ Mission, Run, RunEvent, Proposal, Dispute }) {
  /**
   * Takes an open mission for one Traikeur, atomically: of two accepting at the same moment, one
   * gets it, the other a clear error.
   */
  /**
   * Takes a place, in one statement (two Traikeurs at once can't both get the last one): the mission
   * stays open until its crew is complete, then is accepted.
   */
  async claim(id: string): Promise<MissionRow> {
    const [row] = await this.db('mission')
      .where({ id, status: 'open' })
      .whereNull('deleted_at')
      .andWhereRaw('seats_taken < crew')
      .update({
        seats_taken: this.db.raw('seats_taken + 1'),
        status: this.db.raw("case when seats_taken + 1 >= crew then 'accepted' else status end"),
        updated_at: new Date(),
      })
      .returning('id');
    if (!row) throw new TraikuError(TraikuError.Types.CONFLICT, 'Cette mission vient d’être prise par quelqu’un d’autre.', 'mission_taken');
    return this.retrieveMission(id);
  }

  /** A place given back (a Traikeur withdraws): open again, one place more. */
  async unclaim(id: string) {
    await this.db('mission').where({ id }).andWhere('seats_taken', '>', 0).update({ seats_taken: this.db.raw('seats_taken - 1'), status: 'open', updated_at: new Date() });
  }

  /** The pickup and dropoff codes: 4 digits, different from each other. */
  newCodes() {
    const pickup = randomDigits(4);
    let dropoff = randomDigits(4);
    while (dropoff === pickup) dropoff = randomDigits(4);
    return { pickup_code: pickup, dropoff_code: dropoff };
  }

  /** Checks a code typed by the Traikeur; 3 wrong tries lock the run. */
  async checkCode(run: RunRow, expected: string | null | undefined, typed: string, actorId: string) {
    if (run.locked_at) throw new TraikuError(TraikuError.Types.NOT_ALLOWED, 'Trop de codes faux : la mission est bloquée. Contactez le support.', 'run_locked');
    if (expected && safeEqual(expected, typed.trim())) {
      if (run.code_attempts) await this.updateRuns({ id: run.id, code_attempts: 0 });
      return;
    }
    const attempts = run.code_attempts + 1;
    const locked = attempts >= CODE_TRIES;
    await this.updateRuns({ id: run.id, code_attempts: attempts, locked_at: locked ? new Date() : null });
    await this.logEvent(run.id, 'code_wrong', actorId, null, { attempts });
    throw new TraikuError(
      locked ? TraikuError.Types.NOT_ALLOWED : TraikuError.Types.INVALID_DATA,
      locked ? 'Trop de codes faux : la mission est bloquée. Contactez le support.' : `Code incorrect. Encore ${CODE_TRIES - attempts} essai${CODE_TRIES - attempts > 1 ? 's' : ''}.`,
      locked ? 'run_locked' : 'code_invalid'
    );
  }

  logEvent(runId: string, type: string, actorId: string | null, coords?: LatLng | null, payload?: Record<string, unknown>) {
    return this.createRunEvents({ run_id: runId, type, actor_id: actorId, coords: coords ?? null, payload: payload ?? null });
  }

  /** Updates a run and its mission in one transaction; returns the values before, to undo. */
  async applyChanges(changes: Changes) {
    return this.transaction(async (ctx) => {
      const before: Changes = {};
      const after: { run?: RunRow; mission?: MissionRow } = {};
      if (changes.run_id && changes.run && Object.keys(changes.run).length) {
        const prev = await this.retrieveRun(changes.run_id, {}, ctx);
        before.run_id = prev.id;
        before.run = pick(prev, Object.keys(changes.run)) as RunChanges;
        after.run = await this.updateRuns({ id: prev.id, ...changes.run }, ctx);
      }
      if (changes.mission_id && changes.mission && Object.keys(changes.mission).length) {
        const prev = await this.retrieveMission(changes.mission_id, {}, ctx);
        before.mission_id = prev.id;
        before.mission = pick(prev, Object.keys(changes.mission)) as MissionChanges;
        after.mission = await this.updateMissions({ id: prev.id, ...changes.mission }, ctx);
      }
      return { before, after };
    });
  }

  async searchOpen(o: OpenSearch): Promise<{ rows: FoundMission[]; count: number }> {
    const columns = this.repo('Mission').allColumns.map((c) => `m.${c}`);
    let qb = this.db.from({ m: 'mission' });
    if (o.route) {
      // The route as a line, simplified to about 50 m: a few hundred points whatever the trip.
      const wkt = `LINESTRING(${o.route.coordinates.map((c) => `${Number(c.longitude)} ${Number(c.latitude)}`).join(',')})`;
      qb = this.db.with('r', this.db.raw('select st_simplify(st_geomfromtext(?, 4326), 0.0005) as g', [wkt])).from({ m: 'mission' }).joinRaw('cross join r');
    }
    if (o.stations?.points.length) {
      // The stations, numbered in the order they are reached.
      const values = o.stations.points.map((_, i) => `(${i}, st_setsrid(st_makepoint(?, ?), 4326)::geography)`).join(', ');
      const coords = o.stations.points.flatMap((c) => [Number(c.longitude), Number(c.latitude)]);
      qb = (o.route ? qb : this.db.from({ m: 'mission' })).with('st', this.db.raw(`select * from (values ${values}) as v(idx, g)`, coords));
    }
    qb.whereNull('m.deleted_at').where('m.status', 'open').where('m.deadline', '>', o.deadlineAfter);
    if (o.excludeRequester) qb.whereNot('m.requester_id', o.excludeRequester);
    if (o.categories?.length) qb.whereIn('m.category', o.categories);
    qb.where((b) => b.whereNot('m.mode', 'pro').orWhereIn('m.profession', o.professions.length ? o.professions : ['']));
    if (!o.obdReader) qb.where('m.obd_diagnostic', false);
    if (o.minPrice) qb.where('m.price', '>=', o.minPrice);
    if (o.maxWeightKg !== undefined) qb.where('m.weight_kg', '<=', o.maxWeightKg);
    if (o.sizes) qb.whereIn('m.size', o.sizes);

    const extra: string[] = [];
    const bindings: number[] = [];
    if (o.near) {
      const point = 'st_setsrid(st_makepoint(?, ?), 4326)::geography';
      qb.whereRaw(`st_dwithin(m.pickup_geo, ${point}, ?)`, [o.near.longitude, o.near.latitude, o.near.radiusM]);
      extra.push(`st_distance(m.pickup_geo, ${point}) as distance_m`);
      bindings.push(o.near.longitude, o.near.latitude);
    }
    if (o.route) {
      qb.whereRaw('st_dwithin(m.pickup_geo, r.g::geography, ?)', [o.route.corridorM]);
      qb.where((b) =>
        b.whereNot('m.mode', 'transport').orWhereRaw('st_dwithin(m.dropoff_geo, r.g::geography, ?) and st_linelocatepoint(r.g, m.pickup_geo::geometry) <= st_linelocatepoint(r.g, m.dropoff_geo::geometry)', [o.route!.corridorM])
      );
      extra.push("(st_distance(m.pickup_geo, r.g::geography) + case when m.mode = 'transport' then st_distance(m.dropoff_geo, r.g::geography) else 0 end) * 2 as detour_m");
    }

    if (o.stations?.points.length) {
      const R = o.stations.radiusM;
      qb.whereRaw('exists (select 1 from st where st_dwithin(m.pickup_geo, st.g, ?))', [R]);
      qb.where((b) =>
        b
          .whereNot('m.mode', 'transport')
          .orWhereRaw('(select min(idx) from st where st_dwithin(m.pickup_geo, st.g, ?)) <= (select max(idx) from st where st_dwithin(m.dropoff_geo, st.g, ?))', [R, R])
      );
      extra.push("((select min(st_distance(m.pickup_geo, st.g)) from st) + case when m.mode = 'transport' then (select min(st_distance(m.dropoff_geo, st.g)) from st) else 0 end) * 2 as detour_m");
    }

    const counted = await qb.clone().count({ count: '*' }).first();
    const rows = qb.clone().select(columns);
    if (extra.length) rows.select(this.db.raw(extra.join(', '), bindings));
    if (o.route || o.stations) rows.orderBy('detour_m', 'asc');
    else if (o.near) rows.orderBy('distance_m', 'asc');
    else rows.orderByRaw('m.republished_at desc nulls last, m.created_at desc');
    const list = (await rows.limit(o.take).offset(o.skip)) as FoundMission[];
    return {
      rows: list.map((r) => ({ ...r, distance_m: r.distance_m == null ? null : Math.round(r.distance_m), detour_m: r.detour_m == null ? null : Math.round(r.detour_m) })),
      count: Number((counted as { count?: number } | undefined)?.count ?? 0),
    };
  }

  /** The active run of a mission, if any. */
  async activeRun(missionId: string) {
    const [run] = await this.listRuns({ mission_id: missionId, status: 'active' }, { take: 1 });
    return run ?? null;
  }

  /** Every Traikeur still on it (a crew has several). */
  activeRuns(missionId: string) {
    return this.listRuns({ mission_id: missionId, status: 'active' });
  }
}

type Writable<T> = Partial<Omit<T, 'id' | 'created_at' | 'updated_at' | 'deleted_at' | 'mission' | 'events' | 'runs' | 'proposals' | 'disputes'>>;
export type RunChanges = Writable<RunRow>;
export type MissionChanges = Writable<MissionRow>;

export type Changes = { run_id?: string; run?: RunChanges; mission_id?: string; mission?: MissionChanges };
