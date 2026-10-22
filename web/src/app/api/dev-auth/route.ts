import { NextRequest, NextResponse } from "next/server";
import {
  createSimulatedSession,
  SIMULATED_SESSION_COOKIE,
  simulatedAuthEnabled,
  simulatedSessionFromRequest,
  SIMULATED_USERS,
} from "@/lib/auth/simulatedSession";

export const dynamic = "force-dynamic";

function unavailable() {
  return NextResponse.json(
    { error: "Local authentication simulation is disabled. Start the app with AUTH_MODE=simulated and NEXT_PUBLIC_AUTH_MODE=simulated." },
    { status: 404 },
  );
}

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: "strict" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 8 * 60 * 60,
  };
}

export async function GET(req: NextRequest) {
  if (!simulatedAuthEnabled()) return unavailable();

  const cookie = req.cookies.get(SIMULATED_SESSION_COOKIE)?.value;
  if (!cookie) {
    return NextResponse.json({ user: null }, { headers: { "Cache-Control": "no-store" } });
  }

  try {
    const jwt = simulatedSessionFromRequest(req);
    const user = SIMULATED_USERS.find((candidate) => candidate.username === jwt.preferred_username);
    return NextResponse.json({ user: user ?? null }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid simulated session." },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }
}

export async function POST(req: NextRequest) {
  if (!simulatedAuthEnabled()) return unavailable();
  if (req.headers.get("origin") !== req.nextUrl.origin) {
    return NextResponse.json({ error: "Sign-in request must come from this app." }, { status: 403 });
  }

  let body: { username?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid sign-in request." }, { status: 400 });
  }
  if (typeof body.username !== "string") {
    return NextResponse.json({ error: "Choose a demo account." }, { status: 400 });
  }

  try {
    const session = createSimulatedSession(body.username);
    const response = NextResponse.json({ user: session.user });
    response.cookies.set(SIMULATED_SESSION_COOKIE, session.value, cookieOptions());
    return response;
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not create simulated session." },
      { status: 400 },
    );
  }
}

export async function DELETE(req: NextRequest) {
  if (!simulatedAuthEnabled()) return unavailable();
  if (req.headers.get("origin") !== req.nextUrl.origin) {
    return NextResponse.json({ error: "Sign-out request must come from this app." }, { status: 403 });
  }

  const response = NextResponse.json({ signedOut: true });
  response.cookies.set(SIMULATED_SESSION_COOKIE, "", { ...cookieOptions(), maxAge: 0 });
  return response;
}
