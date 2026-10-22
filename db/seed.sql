-- NDIS Claim Chain: demo data. Run after schema.sql. All people and numbers are fictional.
-- Usernames match the TideCloak users created by tidecloak/bootstrap.sh.
-- vuid is left empty: it's filled in when each person first signs in with TideCloak.
-- Names are filled in from each person's own TideCloak profile when they sign in.

insert into organisations (id, name, abn) values
  ('00000000-0000-0000-0000-0000000000b1', 'Brightpath Supports', 'DEMO-ABN-0001');

insert into users (id, username, role, organisation_id) values
  ('00000000-0000-0000-0000-000000000001', 'sam.patel',   'worker',      '00000000-0000-0000-0000-0000000000b1'),
  ('00000000-0000-0000-0000-000000000002', 'mia.nguyen',  'participant', null),
  ('00000000-0000-0000-0000-000000000003', 'jordan.lee',  'provider',    '00000000-0000-0000-0000-0000000000b1'),
  ('00000000-0000-0000-0000-000000000004', 'alex.romero', 'approver',    null),
  -- The TideCloak realm admin doubles as the app's system admin.
  ('00000000-0000-0000-0000-000000000005', 'admin',       'sysadmin',    null);

insert into participants (user_id, ndis_number) values
  ('00000000-0000-0000-0000-000000000002', '430123456');

insert into support_assignments (participant_id, worker_id, provider_org_id) values
  ('00000000-0000-0000-0000-000000000002',
   '00000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-0000000000b1');

-- Placeholders until Tide encryption is wired in. Real rows hold Tide ciphertext only.
insert into plan_records (participant_id, kind, ciphertext, tide_tag) values
  ('00000000-0000-0000-0000-000000000002', 'goals',             'NOT-YET-ENCRYPTED', 'plan.mia.goals'),
  ('00000000-0000-0000-0000-000000000002', 'support_needs',     'NOT-YET-ENCRYPTED', 'plan.mia.needs'),
  ('00000000-0000-0000-0000-000000000002', 'health',            'NOT-YET-ENCRYPTED', 'plan.mia.health'),
  ('00000000-0000-0000-0000-000000000002', 'funding',           'NOT-YET-ENCRYPTED', 'plan.mia.funding'),
  ('00000000-0000-0000-0000-000000000002', 'service_agreement', 'NOT-YET-ENCRYPTED', 'plan.mia.agreement');
