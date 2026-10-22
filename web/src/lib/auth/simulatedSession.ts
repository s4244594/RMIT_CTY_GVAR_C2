import { createHmac, timingSafeEqual } from "crypto";
import type { NextRequest } from "next/server";
import type { JWTPayload } from "jose";
import { APP_ROLES, type AppRole } from "@/lib/caller";

export const SIMULATED_USERS = [
  { username: "sam.patel", firstName: "Sam", lastName: "Patel", role: "worker" },
  { username: "mia.nguyen", firstName: "Mia", lastName: "Nguyen", role: "participant" },
  { username: "jordan.lee", firstName: "Jordan", lastName: "Lee", role: "provider" },
  { username: "alex.romero", firstName: "Alex", lastName: "Romero", role: "approver" },
  { username: "admin", firstName: "Admin", lastName: "User", role: "sysadmin" },
] as const satisfies readonly {
  username: string;
  firstName: string;
  lastName: string;
  role: AppRole;
}[];

export const SIMULATED_SESSION_COOKIE = "claimchain_dev_session";
const SESSION_LIFETIME_SECONDS = 8 * 60 * 60;

type SimulatedUser = (typeof SIMULATED_USERS)[number];
type SessionPayload = JWTPayload & {
  iss: "claimchain-local-simulation";
  simulated: true;
  preferred_username: SimulatedUser["username"];
  given_name: string;
  family_name: string;
  realm_access: { roles: AppRole[] };
};

function signingKey(): Buffer {
  const secret = process.env.STEP_SIGNING_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("Set STEP_SIGNING_SECRET to at least 32 characters to enable local auth simulation.");
  }
  return createHmac("sha256", secret).update("claimchain-local-auth-simulation-v1").digest();
}

export function simulatedAuthEnabled(): boolean {
  return process.env.AUTH_MODE === "simulated" && process.env.NODE_ENV !== "production";
}

function encodeSession(payload: SessionPayload): string {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", signingKey()).update(encoded).digest("base64url");
  return `${encoded}.${signature}`;
}

export function createSimulatedSession(username: string): {
  value: string;
  user: SimulatedUser;
} {
  if (!simulatedAuthEnabled()) {
    throw new Error("Local auth simulation is disabled. Use it only with AUTH_MODE=simulated in development.");
  }

  const user = SIMULATED_USERS.find((candidate) => candidate.username === username);
  if (!user) throw new Error("Unknown demo account.");

  const now = Math.floor(Date.now() / 1000);
  const payload: SessionPayload = {
    iss: "claimchain-local-simulation",
    sub: `simulated:${user.username}`,
    simulated: true,
    preferred_username: user.username,
    given_name: user.firstName,
    family_name: user.lastName,
    realm_access: { roles: [user.role] },
    iat: now,
    exp: now + SESSION_LIFETIME_SECONDS,
  };

  return { value: encodeSession(payload), user };
}

export function verifySimulatedSession(value: string | undefined): JWTPayload {
  if (!simulatedAuthEnabled()) throw new Error("Local auth simulation is disabled.");
  if (!value) throw new Error("Missing simulated session.");

  const [encoded, suppliedSignature, extra] = value.split(".");
  if (!encoded || !suppliedSignature || extra) throw new Error("Invalid simulated session.");

  const expectedSignature = createHmac("sha256", signingKey()).update(encoded).digest();
  let receivedSignature: Buffer;
  try {
    receivedSignature = Buffer.from(suppliedSignature, "base64url");
  } catch {
    throw new Error("Invalid simulated session signature.");
  }
  if (
    receivedSignature.length !== expectedSignature.length ||
    !timingSafeEqual(receivedSignature, expectedSignature)
  ) {
    throw new Error("Invalid simulated session signature.");
  }

  let payload: SessionPayload;
  try {
    payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as SessionPayload;
  } catch {
    throw new Error("Invalid simulated session payload.");
  }

  const now = Math.floor(Date.now() / 1000);
  const user = SIMULATED_USERS.find((candidate) => candidate.username === payload.preferred_username);
  if (
    payload.iss !== "claimchain-local-simulation" ||
    payload.simulated !== true ||
    !user ||
    payload.sub !== `simulated:${user.username}` ||
    payload.realm_access?.roles?.length !== 1 ||
    payload.realm_access.roles[0] !== user.role ||
    typeof payload.exp !== "number" ||
    payload.exp <= now
  ) {
    throw new Error("Invalid or expired simulated session.");
  }

  return payload;
}

export function simulatedSessionFromRequest(req: NextRequest): JWTPayload {
  const cookieHeader = req.headers.get("cookie") ?? "";
  const cookie = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${SIMULATED_SESSION_COOKIE}=`));
  return verifySimulatedSession(cookie?.slice(SIMULATED_SESSION_COOKIE.length + 1));
}
