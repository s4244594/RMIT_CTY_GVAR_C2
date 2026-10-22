-- NDIS Claim Chain: database schema
-- Target: PostgreSQL 15+ (the local claimchain-db container). Run once on an empty database.
--
-- What lives where:
--   TideCloak  -> logins, passwords (never stored anywhere), roles, keys.
--   This DB    -> claims, signed claim steps, encrypted plan records, payments.
-- Authorization always comes from the TideCloak token on each request. The `role`
-- column below is a copy used for display and for the consistency checks in the triggers.

create extension if not exists pgcrypto;

-- ---------- People and organisations ----------

create table organisations (
  id   uuid primary key default gen_random_uuid(),
  name text not null,
  abn  text unique
);

create table users (
  id              uuid primary key default gen_random_uuid(),
  username        text not null unique,          -- same as the TideCloak username
  -- Names come from the person's own TideCloak profile and are copied here when they sign in.
  -- The API only shows a name to people who work with that person (see web/src/lib/people.ts).
  first_name      text,
  last_name       text,
  role            text not null check (role in ('worker', 'participant', 'provider', 'approver', 'sysadmin')),
  vuid            text unique,                   -- Tide user id; filled on first sign-in
  organisation_id uuid references organisations(id),
  created_at      timestamptz not null default now()
);

create table participants (
  user_id     uuid primary key references users(id),
  ndis_number text not null unique
);

-- Plan details are encrypted with Tide in the browser. The server only ever stores ciphertext.
create table plan_records (
  id             uuid primary key default gen_random_uuid(),
  participant_id uuid not null references participants(user_id),
  kind           text not null check (kind in ('goals', 'support_needs', 'health', 'funding', 'service_agreement')),
  ciphertext     text not null,
  tide_tag       text not null,                  -- the access tag Tide checks before decrypting
  updated_at     timestamptz not null default now(),
  unique (participant_id, kind)
);

-- Which worker supports which participant, through which provider. A worker can only log
-- services for participants they're assigned to, and the assignment is one of the
-- relationships that lets two people see each other's names.
create table support_assignments (
  participant_id  uuid not null references participants(user_id),
  worker_id       uuid not null references users(id),
  provider_org_id uuid not null references organisations(id),
  created_at      timestamptz not null default now(),
  primary key (participant_id, worker_id)
);

-- ---------- Claims ----------

-- The claim data. Deliberately editable: if anyone changes it after signing, the
-- signatures in claim_steps stop matching and the app refuses the claim.
create table claims (
  id                text primary key,
  participant_id    uuid not null references participants(user_id),
  worker_id         uuid not null references users(id),
  provider_org_id   uuid not null references organisations(id),
  support_item_code text not null,
  service           text not null,
  service_date      date not null,
  hours             numeric(5, 2) not null check (hours > 0 and hours <= 24),
  rate              numeric(8, 2) not null check (rate > 0),
  created_at        timestamptz not null default now()
);

-- One row per signed step. Append-only: rows can be added, never changed or removed.
-- Store the signature and what it was signed under, never the signed bytes themselves:
-- the app rebuilds the statement from `claims` every time and checks it against `signature`.
-- Until the Tide attestation contract is deployed by the Tide team, `signature` is an
-- HMAC made by the app server (contract_id 'interim-hmac'), so someone who can edit the
-- database but not the server still can't forge one.
create table claim_steps (
  id             bigint generated always as identity primary key,
  claim_id       text not null references claims(id),
  step           text not null check (step in ('delivered', 'confirmed', 'disputed', 'submitted', 'approved')),
  signer_id      uuid not null references users(id),
  prev_signature text,                           -- signature of the step before, so order is signed too
  signature      text not null,
  contract_id    text not null,                  -- Tide contract the step was signed under
  key_id         text not null,                  -- Tide realm key the step was signed with
  signed_at      timestamptz not null default now(),
  unique (claim_id, step),
  unique (claim_id, signer_id)                   -- every step signed by a different person
);

create table payments (
  claim_id    text primary key references claims(id),
  amount      numeric(10, 2) not null check (amount > 0),
  released_by uuid not null references users(id),
  released_at timestamptz not null default now()
);

create index claim_steps_claim_idx on claim_steps (claim_id);
create index claims_participant_idx on claims (participant_id);
create index claims_worker_idx on claims (worker_id);

-- ---------- Rules the database enforces ----------

-- Right person, right order, for every step.
create or replace function check_claim_step() returns trigger
language plpgsql as $$
declare
  c             claims%rowtype;
  signer        users%rowtype;
  required_role text;
  required_prev text;
begin
  select * into c from claims where id = new.claim_id;
  select * into signer from users where id = new.signer_id;

  required_role := case new.step
    when 'delivered' then 'worker'
    when 'confirmed' then 'participant'
    when 'disputed'  then 'participant'
    when 'submitted' then 'provider'
    when 'approved'  then 'approver'
  end;
  if signer.role is distinct from required_role then
    raise exception 'Step "%" must be signed by a %, not a %', new.step, required_role, signer.role;
  end if;

  if new.step = 'delivered' and new.signer_id <> c.worker_id then
    raise exception 'Only the worker on this claim can sign "delivered"';
  end if;
  if new.step in ('confirmed', 'disputed') and new.signer_id <> c.participant_id then
    raise exception 'Only the participant on this claim can confirm or dispute it';
  end if;
  if new.step = 'submitted' and signer.organisation_id is distinct from c.provider_org_id then
    raise exception 'Only the claim''s provider organisation can submit it';
  end if;

  required_prev := case new.step
    when 'confirmed' then 'delivered'
    when 'disputed'  then 'delivered'
    when 'submitted' then 'confirmed'
    when 'approved'  then 'submitted'
  end;
  if required_prev is not null and not exists (
    select 1 from claim_steps where claim_id = new.claim_id and step = required_prev
  ) then
    raise exception 'Step "%" needs step "%" first', new.step, required_prev;
  end if;

  if new.step in ('submitted', 'approved') and exists (
    select 1 from claim_steps where claim_id = new.claim_id and step = 'disputed'
  ) then
    raise exception 'Claim % is disputed by the participant', new.claim_id;
  end if;

  return new;
end;
$$;

create trigger claim_steps_check
  before insert on claim_steps
  for each row execute function check_claim_step();

-- Payment only after approval, and only by an approver.
create or replace function check_payment() returns trigger
language plpgsql as $$
begin
  if not exists (select 1 from claim_steps where claim_id = new.claim_id and step = 'approved') then
    raise exception 'Claim % has not been approved', new.claim_id;
  end if;
  if (select role from users where id = new.released_by) is distinct from 'approver' then
    raise exception 'Only an agency approver can release payment';
  end if;
  return new;
end;
$$;

create trigger payments_check
  before insert on payments
  for each row execute function check_payment();

-- Signed history can't be rewritten through the app. (A database owner could still drop
-- these triggers, which is why the signatures, not the database, are the real protection.)
create or replace function forbid_change() returns trigger
language plpgsql as $$
begin
  raise exception '% is append-only: rows can be added but not changed or deleted', tg_table_name;
end;
$$;

create trigger claim_steps_append_only
  before update or delete on claim_steps
  for each row execute function forbid_change();

create trigger payments_append_only
  before update or delete on payments
  for each row execute function forbid_change();

-- ---------- Row level security ----------
-- Enabled with no policies, so any database role other than the table owner can read and
-- write nothing. The app server connects as the owner. Keeps the schema safe if it is ever
-- moved to a host that exposes the database through an API.
alter table organisations enable row level security;
alter table users         enable row level security;
alter table participants  enable row level security;
alter table plan_records  enable row level security;
alter table support_assignments enable row level security;
alter table claims        enable row level security;
alter table claim_steps   enable row level security;
alter table payments      enable row level security;
