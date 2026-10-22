import { withAuth } from "@/lib/auth/middleware";
import { handle, HttpError, requireRole, resolveCaller } from "@/lib/caller";
import { loadClaim } from "@/lib/claims";
import { query, queryOne } from "@/lib/db";
import { pathParam } from "@/lib/http";
import {
  buildStatement, INTERIM_CONTRACT_ID, INTERIM_KEY_ID, signStatement, STEP_ORDER, STEP_ROLE,
  type ClaimRow, type Step,
} from "@/lib/statement";

// Sign one step of a claim as the caller. The database triggers enforce the same rules again
// (right person, right order, one signature per person, append-only).
export const POST = withAuth(async (req, jwt) =>
  handle(async () => {
    const caller = await resolveCaller(jwt);
    const claimId = pathParam(req, "claims");
    const { step } = (await req.json().catch(() => ({}))) as { step?: Step };
    if (!step || !STEP_ORDER.includes(step)) throw new HttpError(400, "Unknown step.");
    requireRole(caller, STEP_ROLE[step] as never);

    // Refuse to add a signature on top of data that no longer matches earlier signatures.
    const current = await loadClaim(caller, claimId);
    if (current.tampered) throw new HttpError(409, "This claim was changed after it was signed. It can't be signed further.");
    if (step === "approved") {
      const failed = current.checks.find((c) => !c.ok);
      if (failed) throw new HttpError(409, `Can't approve: ${failed.label}.`);
    }

    const claim = await queryOne<ClaimRow>("select * from claims where id = $1", [claimId]);
    if (!claim) throw new HttpError(404, "Claim not found.");
    const prev = await query<{ signature: string }>(
      "select signature from claim_steps where claim_id = $1 order by signed_at desc, id desc limit 1",
      [claimId],
    );

    const prevSignature = prev[0]?.signature ?? null;
    const signature = signStatement(buildStatement(claim, step, caller.id, prevSignature));
    await queryOne(
      `insert into claim_steps (claim_id, step, signer_id, prev_signature, signature, contract_id, key_id)
       values ($1, $2, $3, $4, $5, $6, $7)`,
      [claimId, step, caller.id, prevSignature, signature, INTERIM_CONTRACT_ID, INTERIM_KEY_ID],
    );
    return Response.json({ claim: await loadClaim(caller, claimId) }, { status: 201 });
  }),
);
