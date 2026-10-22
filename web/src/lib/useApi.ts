"use client";

import { useCallback } from "react";
import { useAppAuth } from "@/lib/auth/appAuth";

/**
 * Calls the API through the selected auth mode. Live mode uses Tide secureFetch with a fresh
 * DPoP proof; local simulation uses same-origin cookies and a signed development session.
 * Absolute URLs are required because Tide secureFetch signs the full URL (AP-74).
 */
export function useApi() {
  const { secureFetch } = useAppAuth();
  return useCallback(
    async <T,>(path: string, init: RequestInit = {}): Promise<T> => {
      const headers = new Headers(init.headers);
      if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
      const res = await secureFetch(new URL(path, window.location.origin).toString(), { ...init, headers });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error ?? `Request failed (${res.status})`);
      return data as T;
    },
    [secureFetch],
  );
}
