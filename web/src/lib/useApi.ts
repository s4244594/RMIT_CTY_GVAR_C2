"use client";

import { useCallback } from "react";
import { useAppAuth } from "@/lib/auth/appAuth";

/**
 * Calls our API through the SDK's secureFetch, which attaches the access token AND a fresh
 * DPoP proof for this exact URL and method. The server rejects plain `fetch` with a Bearer
 * token, because a stolen token on its own must not work.
 *
 * Absolute URLs only: secureFetch signs the full URL, and a relative one fails (AP-74).
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
