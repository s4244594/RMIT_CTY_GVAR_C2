import { withAuth } from "@/lib/auth/middleware";
import { handle, HttpError, requireRole, resolveCaller } from "@/lib/caller";
import { loadClaim } from "@/lib/claims";
import { queryOne } from "@/lib/db";
import { pathParam } from "@/lib/http";

// TAMPER DEMO. Stands in for someone with direct database access editing a claim row, the
// same as editing `claims.hours` with psql in the claimchain-db container. It deliberately skips every
// rule; the point is that the signatures catch it afterwards.
export const PATCH = withAuth(async (req, jwt) =>
  handle(async () => {
    const caller = await resolveCaller(jwt);
    requireRole(caller, "sysadmin");
    const claimId = pathParam(req, "claims");
    const hours = Number((await req.json().catch(() => ({}))).hours);
    if (!(hours > 0 && hours <= 24)) throw new HttpError(400, "Hours must be between 0 and 24.");

    const updated = await queryOne("update claims set hours = $2 where id = $1 returning id", [claimId, hours]);
    if (!updated) throw new HttpError(404, "Claim not found.");
    return Response.json({ claim: await loadClaim(caller, claimId) });
  }),
);
