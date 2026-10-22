import type { Caller } from "./caller";
import { HttpError } from "./caller";
import { query, queryOne } from "./db";
import { loadPeople, personView, visiblePeople, type PersonView } from "./people";
import { amountOf, buildStatement, signatureMatches, STEP_ORDER, type ClaimRow, type Step } from "./statement";

// Demo funding rules the approver checks. Real values would come from the NDIS price guide
// and the participant's plan.
export const PRICE_LIMIT = 67.56;
export const MAX_HOURS_PER_DAY = 8;
export const REMAINING_CORE_BUDGET = 4200;

interface StepRow {
  id: string;
  claim_id: string;
  step: Step;
  signer_id: string;
  prev_signature: string | null;
  signature: string;
  contract_id: string;
  signed_at: string;
}

export interface StepView {
  step: Step;
  signer: PersonView;
  signedAt: string;
  signature: string;
  contractId: string;
  /** true when the statement rebuilt from today's claim data still matches the signature. */
  matches: boolean;
}

export interface ClaimView {
  id: string;
  participant: PersonView;
  worker: PersonView;
  providerOrg: string;
  supportItemCode: string;
  service: string;
  serviceDate: string;
  hours: number;
  rate: number;
  amount: number;
  steps: StepView[];
  tampered: boolean;
  disputed: boolean;
  paid: boolean;
  nextStep: Step | null;
  checks: { label: string; ok: boolean }[];
}

/** SQL condition for "the caller may see this claim", on alias c. $1 = caller id. */
const CAN_SEE = `
  exists (select 1 from users v where v.id = $1 and (
       v.role = 'sysadmin'
    or c.worker_id = v.id or c.participant_id = v.id
    or (v.role = 'provider' and c.provider_org_id = v.organisation_id)
    or (v.role = 'approver' and exists (
          select 1 from claim_steps s where s.claim_id = c.id and s.step = 'submitted'))))`;

export async function listClaims(caller: Caller): Promise<ClaimView[]> {
  const rows = await query<{ id: string }>(
    `select c.id from claims c where ${CAN_SEE} order by c.created_at desc limit 100`,
    [caller.id],
  );
  const views: ClaimView[] = [];
  for (const r of rows) views.push(await loadClaim(caller, r.id));
  return views;
}

export async function loadClaim(caller: Caller, claimId: string): Promise<ClaimView> {
  const c = await queryOne<ClaimRow & { provider_name: string }>(
    `select c.*, o.name as provider_name
       from claims c join organisations o on o.id = c.provider_org_id
      where c.id = $2 and ${CAN_SEE}`,
    [caller.id, claimId],
  );
  if (!c) throw new HttpError(404, "Claim not found.");

  const steps = await query<StepRow>(
    "select * from claim_steps where claim_id = $1 order by signed_at, id",
    [claimId],
  );
  const paid = !!(await queryOne("select 1 from payments where claim_id = $1", [claimId]));

  const people = await loadPeople([c.participant_id, c.worker_id, ...steps.map((s) => s.signer_id)]);
  const visible = await visiblePeople(caller);
  const view = (id: string) => personView(people.get(id) ?? { id, role: "unknown", first_name: null, last_name: null }, caller, visible);

  // Rebuild every statement from today's claim data and compare with what was signed.
  const stepViews: StepView[] = steps.map((s) => ({
    step: s.step,
    signer: view(s.signer_id),
    signedAt: new Date(s.signed_at).toISOString(),
    signature: s.signature,
    contractId: s.contract_id,
    matches: signatureMatches(buildStatement(c, s.step, s.signer_id, s.prev_signature), s.signature),
  }));

  const has = (step: Step) => steps.some((s) => s.step === step);
  const disputed = has("disputed");
  const tampered = stepViews.some((s) => !s.matches);
  const nextStep: Step | null = disputed ? null
    : !has("delivered") ? "delivered"
    : !has("confirmed") ? "confirmed"
    : !has("submitted") ? "submitted"
    : !has("approved") ? "approved"
    : null;

  const hours = Number(c.hours);
  const rate = Number(c.rate);
  const amount = amountOf(c);
  const signers = steps.map((s) => s.signer_id);
  const checks = [
    { label: "Every signed step still matches the claim data", ok: !tampered },
    { label: "Each step signed by a different person", ok: new Set(signers).size === signers.length },
    { label: `No more than ${MAX_HOURS_PER_DAY} hours of this support on one day (${hours} claimed)`, ok: hours <= MAX_HOURS_PER_DAY },
    { label: `Rate within the price limit (${rate.toFixed(2)} ≤ ${PRICE_LIMIT.toFixed(2)})`, ok: rate <= PRICE_LIMIT },
    { label: `Within the participant's remaining core budget (${REMAINING_CORE_BUDGET.toFixed(2)})`, ok: amount <= REMAINING_CORE_BUDGET },
    { label: "Not disputed by the participant", ok: !disputed },
  ];

  return {
    id: c.id,
    participant: view(c.participant_id),
    worker: view(c.worker_id),
    providerOrg: c.provider_name,
    supportItemCode: c.support_item_code,
    service: c.service,
    serviceDate: c.service_date instanceof Date
      ? `${c.service_date.getFullYear()}-${String(c.service_date.getMonth() + 1).padStart(2, "0")}-${String(c.service_date.getDate()).padStart(2, "0")}`
      : String(c.service_date).slice(0, 10),
    hours,
    rate,
    amount,
    steps: stepViews.sort((a, b) => STEP_ORDER.indexOf(a.step) - STEP_ORDER.indexOf(b.step)),
    tampered,
    disputed,
    paid,
    nextStep,
    checks,
  };
}
