import type { Migration } from '@traiku/framework/migrations';

/**
 * Written by hand (db:generate doesn't know PostGIS): the pickup and dropoff as geography points,
 * computed by Postgres from the json columns and indexed, for the searches by distance and along a
 * trip. The services never read them (they select the model's columns only).
 */
export default {
  async up(db) {
    await db.raw(`alter table "mission" add column if not exists "pickup_geo" geography(Point, 4326) generated always as (st_setsrid(st_makepoint(("pickup"->>'longitude')::float8, ("pickup"->>'latitude')::float8), 4326)::geography) stored;`);
    await db.raw(`alter table "mission" add column if not exists "dropoff_geo" geography(Point, 4326) generated always as (st_setsrid(st_makepoint(("dropoff"->>'longitude')::float8, ("dropoff"->>'latitude')::float8), 4326)::geography) stored;`);
    await db.raw(`create index if not exists "IDX_mission_pickup_geo" on "mission" using gist ("pickup_geo") where deleted_at is null;`);
    await db.raw(`create index if not exists "IDX_mission_open_deadline" on "mission" ("deadline") where deleted_at is null and status = 'open';`);
  },

  async down(db) {
    await db.raw(`drop index if exists "IDX_mission_open_deadline";`);
    await db.raw(`drop index if exists "IDX_mission_pickup_geo";`);
    await db.raw(`alter table "mission" drop column if exists "dropoff_geo";`);
    await db.raw(`alter table "mission" drop column if exists "pickup_geo";`);
  },
} satisfies Migration;
