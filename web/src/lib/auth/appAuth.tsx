"use client";

import { useContext, type ReactNode } from "react";
import { TideCloakProvider, useTideCloak } from "@tidecloak/nextjs";
import tideConfig from "../../../data/tidecloak.json";
import { SimulatedAuthProvider } from "./simulatedAuthProvider";
import { AppAuthProviderContext, type AppAuth } from "./simulatedAuthContext";
export type { AppAuth } from "./simulatedAuthContext";

function LiveAuthBridge({ children }: { children: ReactNode }) {
  const tide = useTideCloak();
  const value: AppAuth = {
    authenticated: tide.authenticated,
    isInitializing: tide.isInitializing,
    isSimulated: false,
    username: tide.authenticated
      ? String(tide.getValueFromToken("preferred_username") ?? "")
      : null,
    login: () => tide.login(),
    logout: () => tide.logout(),
    hasRealmRole: tide.hasRealmRole,
    getValueFromToken: tide.getValueFromToken,
    secureFetch: tide.secureFetch,
    doEncrypt: tide.doEncrypt,
    doDecrypt: tide.doDecrypt,
    signInAs: async () => {
      throw new Error("Demo-account selection is available only in local simulation mode.");
    },
    demoPickerOpen: false,
    closeDemoPicker: () => undefined,
    demoUsers: [],
  };
  return <AppAuthProviderContext.Provider value={value}>{children}</AppAuthProviderContext.Provider>;
}

export function AppAuthProvider({ children }: { children: ReactNode }) {
  if (process.env.NODE_ENV === "production" && process.env.NEXT_PUBLIC_AUTH_MODE === "simulated") {
    throw new Error("Simulated authentication must not be enabled in a production build.");
  }

  if (process.env.NEXT_PUBLIC_AUTH_MODE === "simulated") {
    return <SimulatedAuthProvider>{children}</SimulatedAuthProvider>;
  }

  return (
    <TideCloakProvider
      config={{ ...tideConfig, useDPoP: { mode: "strict", alg: "ES256" } }}
    >
      <LiveAuthBridge>{children}</LiveAuthBridge>
    </TideCloakProvider>
  );
}

export function useAppAuth(): AppAuth {
  const value = useContext(AppAuthProviderContext);
  if (!value) throw new Error("useAppAuth must be used inside AppAuthProvider.");
  return value;
}
