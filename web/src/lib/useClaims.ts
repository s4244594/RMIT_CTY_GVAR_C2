"use client";

import { useCallback, useEffect, useState } from "react";
import { useAppAuth } from "@/lib/auth/appAuth";
import type { ClaimView } from "./claims";
import { useApi } from "./useApi";

/** Loads the claims the server lets this person see. */
export function useClaims() {
  const api = useApi();
  const { authenticated } = useAppAuth();
  const [claims, setClaims] = useState<ClaimView[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const data = await api<{ claims: ClaimView[] }>("/api/claims");
      setClaims(data.claims);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load claims.");
    }
  }, [api]);

  useEffect(() => {
    if (authenticated) reload();
  }, [authenticated, reload]);

  return { claims, error, reload, setClaims };
}
