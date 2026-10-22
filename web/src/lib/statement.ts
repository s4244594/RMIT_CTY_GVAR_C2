import { createHmac, timingSafeEqual } from "crypto";

// Each claim step is a statement built from the claim data. It is never stored: every check
// rebuilds it from the current row and compares it with the stored signature, so an edit to
// the claim after signing makes the signature stop matching.
//
// INTERIM: until the Tide attestation contract is deployed by the Tide team, the signature is
// an HMAC made by this server. That still catches anyone who can edit the database but not
// the server. The Tide version moves signing to the Tide network so the server can't forge it.

export const INTERIM_CONTRACT_ID = "interim-hmac";
export const INTERIM_KEY_ID = "server-secret-v1";

export const STEP_ORDER = ["delivered", "confirmed", "disputed", "submitted", "approved"] as const;
export type Step = (typeof STEP_ORDER)[number];

export const STEP_ROLE: Record<Step, string> = {
  delivered: "worker",
  confirmed: "participant",
  disputed: "participant",
  submitted: "provider",
  approved: "approver",
};

export interface ClaimRow {
  id: string;
  participant_id: string;
  worker_id: string;
  provider_org_id: string;
  support_item_code: string;
  service: string;
  service_date: string | Date;
  hours: string | number;
  rate: string | number;
}

export function amountOf(c: Pick<ClaimRow, "hours" | "rate">): number {
  return Math.round(Number(c.hours) * Number(c.rate) * 100) / 100;
}

function isoDate(d: string | Date): string {
  if (d instanceof Date) {
    // node-postgres returns DATE as local midnight; format without shifting the day.
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }
  return d.slice(0, 10);
}

/** The exact bytes a step signs. Field order is fixed; changing it invalidates old steps. */
export function buildStatement(c: ClaimRow, step: Step, signerId: string, prevSignature: string | null): string {
  return JSON.stringify({
    claim: c.id,
    step,
    signer: signerId,
    participant: c.participant_id,
    worker: c.worker_id,
    provider: c.provider_org_id,
    item: c.support_item_code,
    service: c.service,
    date: isoDate(c.service_date),
    hours: Number(c.hours).toFixed(2),
    rate: Number(c.rate).toFixed(2),
    amount: amountOf(c).toFixed(2),
    prev: prevSignature ?? "start",
  });
}

function secret(): string {
  const s = process.env.STEP_SIGNING_SECRET;
  if (!s || s.length < 32) {
    throw new Error("STEP_SIGNING_SECRET is missing or too short. Set a long random value in web/.env.");
  }
  return s;
}

export function signStatement(statement: string): string {
  return createHmac("sha256", secret()).update(statement).digest("hex");
}

export function signatureMatches(statement: string, signature: string): boolean {
  const expected = Buffer.from(signStatement(statement), "hex");
  const given = Buffer.from(signature, "hex");
  return expected.length === given.length && timingSafeEqual(expected, given);
}
