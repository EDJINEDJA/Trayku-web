#!/bin/bash
# Runs once, when the database is created (after PostGIS's own init script).
set -euo pipefail

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  -v owner_pw="$TRAIKU_OWNER_PASSWORD" -v app_pw="$TRAIKU_APP_PASSWORD" <<'SQL'
create role traiku_owner login password :'owner_pw' nosuperuser nocreatedb nocreaterole;
create role traiku_app login password :'app_pw' nosuperuser nocreatedb nocreaterole;

alter database traiku owner to traiku_owner;
revoke all on database traiku from public;
grant connect on database traiku to traiku_owner, traiku_app;

alter schema public owner to traiku_owner;
revoke create on schema public from public;
grant usage on schema public to traiku_app;

-- Every table and sequence db:migrate creates: rows only for the app.
alter default privileges for role traiku_owner in schema public grant select, insert, update, delete on tables to traiku_app;
alter default privileges for role traiku_owner in schema public grant usage, select on sequences to traiku_app;

-- PostGIS's reference table stays readable.
grant select on spatial_ref_sys to traiku_app;
SQL
