"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { AppAuthProviderContext, type AppAuth } from "./simulatedAuthContext";
import { decryptSimulatedPlan, encryptSimulatedPlan } from "./simulatedPlanCrypto";
import type { RoleKey } from "@/lib/roles";

type SessionUser = {
  username: string;
  firstName: string;
  lastName: string;
  role: RoleKey;
};

const DEMO_USERS: readonly SessionUser[] = [
  { username: "sam.patel", firstName: "Sam", lastName: "Patel", role: "worker" },
  { username: "mia.nguyen", firstName: "Mia", lastName: "Nguyen", role: "participant" },
  { username: "jordan.lee", firstName: "Jordan", lastName: "Lee", role: "provider" },
  { username: "alex.romero", firstName: "Alex", lastName: "Romero", role: "approver" },
  { username: "admin", firstName: "Admin", lastName: "User", role: "sysadmin" },
];

async function readSession(): Promise<SessionUser | null> {
  const response = await fetch("/api/dev-auth", { cache: "no-store" });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error ?? `Could not load simulated session (${response.status}).`);
  }
  const body = (await response.json()) as { user: SessionUser | null };
  return body.user;
}

export function SimulatedAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [isInitializing, setInitializing] = useState(true);
  const [demoPickerOpen, setDemoPickerOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    readSession()
      .then((session) => {
        if (active) setUser(session);
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : "Could not load simulated session.");
      })
      .finally(() => {
        if (active) setInitializing(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const login = useCallback(() => {
    setError(null);
    setDemoPickerOpen(true);
  }, []);

  const logout = useCallback(async () => {
    const response = await fetch("/api/dev-auth", { method: "DELETE" });
    if (!response.ok) throw new Error(`Could not sign out (${response.status}).`);
    setUser(null);
  }, []);

  const signInAs = useCallback(async (username: string) => {
    setError(null);
    const response = await fetch("/api/dev-auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = body.error ?? `Could not start simulated session (${response.status}).`;
      setError(message);
      throw new Error(message);
    }
    setUser(body.user as SessionUser);
    setDemoPickerOpen(false);
  }, []);

  const hasRealmRole = useCallback((role: string) => user?.role === role, [user]);
  const getValueFromToken = useCallback((key: string) => {
    if (!user) return undefined;
    const claims: Record<string, string> = {
      preferred_username: user.username,
      given_name: user.firstName,
      family_name: user.lastName,
      name: `${user.firstName} ${user.lastName}`,
    };
    return claims[key];
  }, [user]);
  const secureFetch = useCallback(
    (url: string, init?: RequestInit) => fetch(url, { ...init, credentials: "same-origin" }),
    [],
  );
  const doEncrypt = useCallback(
    (items: Parameters<typeof encryptSimulatedPlan>[1]) => {
      if (!user) throw new Error("Choose a simulated account before encrypting plan data.");
      return encryptSimulatedPlan(user.username, items);
    },
    [user],
  );
  const doDecrypt = useCallback(
    (items: Parameters<typeof decryptSimulatedPlan>[1]) => {
      if (!user) throw new Error("Choose a simulated account before decrypting plan data.");
      return decryptSimulatedPlan(user.username, items);
    },
    [user],
  );
  const closeDemoPicker = useCallback(() => setDemoPickerOpen(false), []);
  const value: AppAuth = useMemo(
    () => ({
      authenticated: user !== null,
      isInitializing,
      isSimulated: true,
      username: user?.username ?? null,
      login,
      logout,
      hasRealmRole,
      getValueFromToken,
      secureFetch,
      doEncrypt,
      doDecrypt,
      signInAs,
      demoPickerOpen,
      closeDemoPicker,
      demoUsers: DEMO_USERS,
    }),
    [user, isInitializing, login, logout, hasRealmRole, getValueFromToken, secureFetch, doEncrypt, doDecrypt, signInAs, demoPickerOpen, closeDemoPicker],
  );

  return (
    <AppAuthProviderContext.Provider value={value}>
      {error && <div role="alert" className="simulation-error">{error}</div>}
      {children}
    </AppAuthProviderContext.Provider>
  );
}
