-- PeopleStrong-style desk: org policy, regularization, leave / not attending.

alter table organizations
  add column if not exists grace_minutes integer not null default 10;

create table if not exists attendance_requests (
  id                    text primary key,
  organization_id       text not null references organizations(id),
  user_id               text not null,
  session_id            text references sabha_sessions(id),
  day_date              date not null,
  request_type          text not null
                        check (request_type in ('regularize', 'not_attending', 'leave')),
  status                text not null default 'pending'
                        check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  requested_punch_in    timestamptz,
  requested_punch_out   timestamptz,
  reason                text not null,
  reviewer_user_id      text,
  reviewer_note         text,
  reviewed_at           timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists attendance_requests_org_status_idx
  on attendance_requests (organization_id, status, created_at desc);

create index if not exists attendance_requests_user_idx
  on attendance_requests (user_id, created_at desc);

create index if not exists attendance_requests_day_idx
  on attendance_requests (user_id, day_date);

create unique index if not exists attendance_requests_pending_session
  on attendance_requests (user_id, session_id, request_type)
  where status = 'pending' and session_id is not null;

create unique index if not exists attendance_requests_pending_day
  on attendance_requests (user_id, day_date, request_type)
  where status = 'pending' and session_id is null;

insert into system_settings (key, value) values
  ('grace_minutes', '10')
on conflict (key) do nothing;
