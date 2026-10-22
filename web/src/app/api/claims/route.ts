import { randomBytes } from "crypto";
import { withAuth } from "@/lib/auth/middleware";
import { handle, HttpError, requireRole, resolveCaller } from "@/lib/caller";
import { listClaims, loadClaim, PRICE_LIMIT } from "@/lib/claims";
import { queryOne } from "@/lib/db";

// Support items a worker can log in this demo.
const SUPPORT_ITEMS: Record<string, string> = {
  "04_104_0125_6_1": "Community access (Core supports)",
  "01_011_0107_1_1": "Assistance with daily life (Core supports)",
  "04_590_0125_6_1": "Transport (Core supports)",
};

export const GET = withAuth(async (_req, jwt) =>
  handle(async () => {
    const caller = await resolveCaller(jwt);
    return Response.json({ claims: await listClaims(caller) });
  }),
);

// A worker logs a service for a participant they're assigned to. Signing it is a separate step.
export const POST = withAuth(async (req, jwt) =>
  handle(async () => {
    const caller = await resolveCaller(jwt);
    requireRole(caller, "worker");

    const body = await req.json().catch(() => ({}));
    const { participantId, itemCode, serviceDate } = body as Record<string, string>;
    const hours = Number(body.hours);

    if (!SUPPORT_ITEMS[itemCode]) throw new HttpError(400, "Unknown support item.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(serviceDate ?? "")) throw new HttpError(400, "Service date must be YYYY-MM-DD.");
    if (!(hours > 0 && hours <= 24)) throw new HttpError(400, "Hours must be between 0 and 24.");

    const assignment = await queryOne<{ provider_org_id: string }>(
      "select provider_org_id from support_assignments where participant_id = $1 and worker_id = $2",
      [participantId, caller.id],
    );
    if (!assignment) throw new HttpError(403, "You're not assigned to this participant.");

    const id = `CLM-${serviceDate.slice(0, 4)}-${randomBytes(3).toString("hex").toUpperCase()}`;
    await queryOne(
      `insert into claims (id, participant_id, worker_id, provider_org_id, support_item_code, service, service_date, hours, rate)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [id, participantId, caller.id, assignment.provider_org_id, itemCode, SUPPORT_ITEMS[itemCode], serviceDate, hours, PRICE_LIMIT],
    );
    return Response.json({ claim: await loadClaim(caller, id) }, { status: 201 });
  }),
);
