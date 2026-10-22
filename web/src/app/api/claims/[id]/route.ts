import { withAuth } from "@/lib/auth/middleware";
import { handle, resolveCaller } from "@/lib/caller";
import { loadClaim } from "@/lib/claims";
import { pathParam } from "@/lib/http";

export const GET = withAuth(async (req, jwt) =>
  handle(async () => {
    const caller = await resolveCaller(jwt);
    return Response.json({ claim: await loadClaim(caller, pathParam(req, "claims")) });
  }),
);
