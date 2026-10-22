import type { Caller } from "./caller";
import { query } from "./db";

// Who may see whose name. A name is shown only to people who work with that person:
//   - the participant and the workers assigned to them, or who have claimed for them
//   - provider staff, for the people on their organisation's claims and assignments,
//     and staff of the same organisation as each other
//   - agency approvers, for the people on claims submitted for approval
//   - system admins see no one's name but their own
// Everyone else sees a role and a short reference instead.

const VISIBLE_SQL = `
with v as (select id, role, organisation_id from users where id = $1),
my_claims as (
  select c.* from claims c, v
   where v.role <> 'sysadmin' and (
         c.worker_id = v.id or c.participant_id = v.id
      or (v.role = 'provider' and c.provider_org_id = v.organisation_id)
      or (v.role = 'approver' and exists (
            select 1 from claim_steps s where s.claim_id = c.id and s.step = 'submitted')))
),
my_assignments as (
  select a.* from support_assignments a, v
   where v.role <> 'sysadmin' and (
         a.worker_id = v.id or a.participant_id = v.id
      or (v.role = 'provider' and a.provider_org_id = v.organisation_id))
)
select id from v
union select participant_id from my_claims
union select worker_id from my_claims
union select s.signer_id from claim_steps s join my_claims c on c.id = s.claim_id
union select participant_id from my_assignments
union select worker_id from my_assignments
union select u.id from users u, v
 where v.role in ('worker', 'provider') and u.organisation_id is not null
   and u.organisation_id = v.organisation_id`;

export async function visiblePeople(caller: Caller): Promise<Set<string>> {
  const rows = await query<{ id: string }>(VISIBLE_SQL, [caller.id]);
  return new Set(rows.map((r) => r.id));
}

const ROLE_LABEL: Record<string, string> = {
  worker: "Support worker",
  participant: "Participant",
  provider: "Provider staff",
  approver: "Agency approver",
  sysadmin: "System admin",
};

export interface PersonView {
  id: string;
  role: string;
  roleLabel: string;
  /** Full name, or null when the caller isn't allowed to see it (or it was never set). */
  name: string | null;
  /** What to show: the name, or a role and short reference. */
  label: string;
  isYou: boolean;
}

export interface PersonRow {
  id: string;
  role: string;
  first_name: string | null;
  last_name: string | null;
}

export function personView(p: PersonRow, caller: Caller, visible: Set<string>): PersonView {
  const roleLabel = ROLE_LABEL[p.role] ?? p.role;
  const full = [p.first_name, p.last_name].filter(Boolean).join(" ") || null;
  const allowed = visible.has(p.id);
  const name = allowed ? full : null;
  const ref = p.id.replace(/-/g, "").slice(-4).toUpperCase();
  return {
    id: p.id,
    role: p.role,
    roleLabel,
    name,
    label: p.id === caller.id ? (full ? `${full} (you)` : "You") : name ?? `${roleLabel} · ref ${ref}`,
    isYou: p.id === caller.id,
  };
}

export async function loadPeople(ids: string[]): Promise<Map<string, PersonRow>> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return new Map();
  const rows = await query<PersonRow>(
    "select id, role, first_name, last_name from users where id = any($1::uuid[])",
    [unique],
  );
  return new Map(rows.map((r) => [r.id, r]));
}
