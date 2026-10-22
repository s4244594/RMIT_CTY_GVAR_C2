import { withAuth } from "@/lib/auth/middleware";
import { handle, HttpError, requireRole, resolveCaller } from "@/lib/caller";
import { query, queryOne } from "@/lib/db";
import { PLAN_KINDS, planTagForParticipant, type PlanKind } from "@/lib/planRecords";

const isPlanKind = (value: unknown): value is PlanKind =>
  typeof value === "string" && PLAN_KINDS.includes(value as PlanKind);

export const GET = withAuth(async (_req, jwt) =>
  handle(async () => {
    const caller = await resolveCaller(jwt);
    requireRole(caller, "participant");
    const rows = await query<{ kind: PlanKind; ciphertext: string; updated_at: string }>(
      `select kind, ciphertext, updated_at
         from plan_records
        where participant_id = $1 and ciphertext <> 'NOT-YET-ENCRYPTED'
        order by kind`,
      [caller.id],
    );
    return Response.json({
      participantId: caller.id,
      records: rows.map((row) => ({
        kind: row.kind,
        ciphertext: row.ciphertext,
        updatedAt: row.updated_at,
      })),
    });
  }),
);

export const PUT = withAuth(async (req, jwt) =>
  handle(async () => {
    const caller = await resolveCaller(jwt);
    requireRole(caller, "participant");

    const body: unknown = await req.json().catch(() => null);
    if (!body || typeof body !== "object") throw new HttpError(400, "Invalid plan record.");
    const { kind, ciphertext } = body as { kind?: unknown; ciphertext?: unknown };
    if (!isPlanKind(kind)) throw new HttpError(400, "Unknown plan record type.");
    if (typeof ciphertext !== "string" || ciphertext.length === 0 || ciphertext.length > 100_000) {
      throw new HttpError(400, "Encrypted plan record must be between 1 and 100,000 characters.");
    }

    const tideTag = planTagForParticipant(caller.id);
    const row = await queryOne<{ kind: PlanKind; ciphertext: string; updated_at: string }>(
      `insert into plan_records (participant_id, kind, ciphertext, tide_tag)
       values ($1, $2, $3, $4)
       on conflict (participant_id, kind)
       do update set ciphertext = excluded.ciphertext,
                     tide_tag = excluded.tide_tag,
                     updated_at = now()
       returning kind, ciphertext, updated_at`,
      [caller.id, kind, ciphertext, tideTag],
    );
    if (!row) throw new Error("Plan record was not saved.");
    return Response.json({
      record: { kind: row.kind, ciphertext: row.ciphertext, updatedAt: row.updated_at },
    });
  }),
);