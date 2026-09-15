-- Sannidhi attendance schema. Idempotent. No extensions (PGLite preview).

create table if not exists organizations (
  id         text primary key,
  name       text not null,
  timezone   text not null default 'Asia/Kolkata',
  created_at timestamptz not null default now()
);

create table if not exists centres (
  id              text primary key,
  organization_id text not null references organizations(id),
  name            text not null,
  created_at      timestamptz not null default now()
);

create table if not exists profiles (
  user_id         text primary key,
  organization_id text not null references organizations(id),
  centre_id       text references centres(id),
  full_name       text not null,
  email           text,
  mobile          text,
  member_id       text,
  role            text not null default 'satsangi'
                  check (role in ('satsangi', 'coordinator', 'admin', 'super_admin')),
  status          text not null default 'active'
                  check (status in ('active', 'inactive')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists profiles_org_idx on profiles (organization_id);
create index if not exists profiles_role_idx on profiles (role);

create table if not exists sabha_locations (
  id                    text primary key,
  organization_id       text not null references organizations(id),
  centre_id             text not null references centres(id),
  name                  text not null,
  address               text,
  description           text,
  latitude              double precision not null,
  longitude             double precision not null,
  allowed_radius_meters integer not null default 100
                        check (allowed_radius_meters >= 10 and allowed_radius_meters <= 5000),
  is_active             boolean not null default true,
  created_by            text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists sabha_locations_org_idx on sabha_locations (organization_id);

create table if not exists sabha_sessions (
  id                              text primary key,
  organization_id                 text not null references organizations(id),
  location_id                     text not null references sabha_locations(id),
  name                            text not null,
  session_date                    date not null,
  scheduled_start                 timestamptz not null,
  scheduled_end                   timestamptz not null,
  punch_in_open_time              timestamptz not null,
  punch_in_close_time             timestamptz not null,
  punch_out_close_time            timestamptz,
  status                          text not null default 'scheduled'
                                  check (status in ('scheduled', 'open', 'closed', 'cancelled')),
  allow_location_exceptions       boolean not null default false,
  allow_out_of_geofence_punch_out boolean not null default true,
  created_by                      text,
  created_at                      timestamptz not null default now(),
  updated_at                      timestamptz not null default now()
);

create index if not exists sabha_sessions_date_idx on sabha_sessions (session_date, status);
create index if not exists sabha_sessions_location_idx on sabha_sessions (location_id);

create table if not exists attendance_records (
  id                              text primary key,
  organization_id                 text not null references organizations(id),
  user_id                         text not null,
  session_id                      text not null references sabha_sessions(id),
  location_id                     text not null references sabha_locations(id),
  status                          text not null default 'active'
                                  check (status in ('active', 'completed', 'cancelled')),
  punch_in_time                   timestamptz,
  punch_in_latitude               double precision,
  punch_in_longitude              double precision,
  punch_in_accuracy               double precision,
  punch_in_distance_from_location double precision,
  punch_in_client_time            timestamptz,
  punch_out_time                  timestamptz,
  punch_out_latitude              double precision,
  punch_out_longitude             double precision,
  punch_out_accuracy              double precision,
  punch_out_distance_from_location double precision,
  punch_out_client_time           timestamptz,
  duration_seconds                integer,
  is_late                         boolean not null default false,
  has_location_exception          boolean not null default false,
  missing_punch_out               boolean not null default false,
  created_at                      timestamptz not null default now(),
  updated_at                      timestamptz not null default now()
);

create unique index if not exists attendance_one_per_session
  on attendance_records (user_id, session_id)
  where status <> 'cancelled';

create index if not exists attendance_session_idx on attendance_records (session_id, status);
create index if not exists attendance_user_idx on attendance_records (user_id, punch_in_time desc);

create table if not exists attendance_events (
  id                     text primary key,
  attendance_record_id   text not null references attendance_records(id),
  user_id                text not null,
  session_id             text not null,
  event_type             text not null
                         check (event_type in (
                           'PUNCH_IN',
                           'PUNCH_OUT',
                           'MANUAL_PUNCH_IN',
                           'MANUAL_PUNCH_OUT',
                           'LOCATION_EXCEPTION',
                           'CORRECTION'
                         )),
  server_timestamp       timestamptz not null default now(),
  client_timestamp       timestamptz,
  latitude               double precision,
  longitude              double precision,
  accuracy               double precision,
  distance_from_location double precision,
  user_agent             text,
  notes                  text,
  created_by             text,
  created_at             timestamptz not null default now()
);

create index if not exists attendance_events_record_idx on attendance_events (attendance_record_id, created_at);

create table if not exists audit_logs (
  id              text primary key,
  organization_id text not null,
  actor_user_id   text not null,
  action          text not null,
  entity_type     text not null,
  entity_id       text,
  old_value       text,
  new_value       text,
  reason          text,
  created_at      timestamptz not null default now()
);

create index if not exists audit_logs_org_idx on audit_logs (organization_id, created_at desc);

create table if not exists system_settings (
  key   text primary key,
  value text not null
);

insert into organizations (id, name, timezone)
  values ('org_sannidhi', 'Satsang Sabha', 'Asia/Kolkata')
  on conflict (id) do nothing;

insert into centres (id, organization_id, name)
  values ('centre_main', 'org_sannidhi', 'Main Centre')
  on conflict (id) do nothing;

-- Demo hall near Mumbai; admins should move the pin to the real hall.
insert into sabha_locations (
  id, organization_id, centre_id, name, address, description,
  latitude, longitude, allowed_radius_meters, is_active, created_by
) values (
  'loc_main_hall',
  'org_sannidhi',
  'centre_main',
  'Main Sabha Hall',
  'Main Sabha Hall',
  'Default hall. Move the pin to your real Sabha location.',
  19.0760,
  72.8777,
  100,
  true,
  'system'
) on conflict (id) do nothing;

insert into system_settings (key, value) values
  ('location_retention_days', '365'),
  ('privacy_version', '1')
on conflict (key) do nothing;
