import { withAuth } from "@/lib/auth/middleware";
import { handle, requireRole, resolveCaller } from "@/lib/caller";
import { query } from "@/lib/db";
import { personView, visiblePeople, type PersonRow } from "@/lib/people";

// The participants a worker is assigned to, for the "log a service" form.
export const GET = withAuth(async (_req, jwt) =>
  handle(async () => {
    const caller = await resolveCaller(jwt);
    requireRole(caller, "worker");
    const rows = await query<PersonRow & { ndis_number: string }>(
      `select u.id, u.role, u.first_name, u.last_name, p.ndis_number
         from support_assignments a
         join users u on u.id = a.participant_id
         join participants p on p.user_id = a.participant_id
        where a.worker_id = $1`,
      [caller.id],
    );
    const visible = await visiblePeople(caller);
    return Response.json({
      participants: rows.map((r) => ({ ...personView(r, caller, visible), ndisNumber: r.ndis_number })),
    });
  }),
);
