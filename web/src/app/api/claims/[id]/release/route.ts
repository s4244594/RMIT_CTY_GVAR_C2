import { withAuth } from "@/lib/auth/middleware";
import { handle, HttpError, requireRole, resolveCaller } from "@/lib/caller";
import { loadClaim } from "@/lib/claims";
import { queryOne } from "@/lib/db";
import { pathParam } from "@/lib/http";

// Release payment: only an approver, only on an approved claim whose signatures all still match.
export const POST = withAuth(async (req, jwt) =>
  handle(async () => {
    const caller = await resolveCaller(jwt);
    requireRole(caller, "approver");
    const claimId = pathParam(req, "claims");

    const claim = await loadClaim(caller, claimId);
    if (claim.paid) throw new HttpError(409, "Already paid.");
    if (claim.tampered) throw new HttpError(409, "Payment blocked: claim data was changed after it was signed.");
    const failed = claim.checks.filter((c) => !c.ok);
    if (failed.length) throw new HttpError(409, `Payment blocked: ${failed[0].label}.`);

    await queryOne(
      "insert into payments (claim_id, amount, released_by) values ($1, $2, $3)",
      [claimId, claim.amount, caller.id],
    );
    return Response.json({ claim: await loadClaim(caller, claimId) });
  }),
);
