import type { JWTPayload } from "jose";
import { hasRole } from "./auth/tideJWT";
import { queryOne } from "./db";

export const APP_ROLES = ["worker", "participant", "provider", "approver", "sysadmin"] as const;
export type AppRole = (typeof APP_ROLES)[number];

export interface Caller {
  id: string;
  username: string;
  role: AppRole;
  organisationId: string | null;
  firstName: string | null;
  lastName: string | null;
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/**
 * Who is calling, from a token that withAuth has already verified (signature + DPoP).
 *
 * The role comes from the token, which the Tide network signed. The database row is used only
 * to find the person's id and organisation, and must agree with the token: a role changed in
 * the database alone grants nothing.
 */
export async function resolveCaller(jwt: JWTPayload): Promise<Caller> {
  const tokenRoles = APP_ROLES.filter((r) => hasRole(jwt, r));
  if (tokenRoles.length !== 1) {
    throw new HttpError(403, tokenRoles.length === 0 ? "Your account has no Claim Chain role." : "Your account has more than one Claim Chain role.");
  }
  const role = tokenRoles[0];
  const username = String(jwt.preferred_username ?? "");
  const vuid = typeof jwt.vuid === "string" ? jwt.vuid : null;

  const row = await queryOne<{
    id: string; role: AppRole; organisation_id: string | null; first_name: string | null; last_name: string | null;
  }>(
    // Keep the copy of the person's own name and Tide id in step with their token.
    `update users
        set vuid = coalesce($2, vuid),
            first_name = coalesce($3, first_name),
            last_name = coalesce($4, last_name)
      where username = $1
      returning id, role, organisation_id, first_name, last_name`,
    [username, vuid, jwt.given_name ?? null, jwt.family_name ?? null],
  );
  if (!row) throw new HttpError(403, `No Claim Chain record for ${username}.`);
  if (row.role !== role) throw new HttpError(403, "Your role in the database doesn't match your signed token.");

  return {
    id: row.id,
    username,
    role,
    organisationId: row.organisation_id,
    firstName: row.first_name,
    lastName: row.last_name,
  };
}

export function requireRole(caller: Caller, ...roles: AppRole[]) {
  if (!roles.includes(caller.role)) throw new HttpError(403, "Your role can't do this.");
}

/** Route helper: turns HttpError and database rule errors into JSON responses. */
export async function handle(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof HttpError) return Response.json({ error: err.message }, { status: err.status });
    const { dbErrorMessage } = await import("./db");
    const msg = dbErrorMessage(err);
    if (msg) return Response.json({ error: msg }, { status: 400 });
    console.error(err);
    return Response.json({ error: err instanceof Error ? err.message : "Server error" }, { status: 500 });
  }
}
