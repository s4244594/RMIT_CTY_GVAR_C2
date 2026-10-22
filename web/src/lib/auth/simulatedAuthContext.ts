"use client";

import { createContext } from "react";
import type { RoleKey } from "@/lib/roles";

export type AppAuth = {
  authenticated: boolean;
  isInitializing: boolean;
  isSimulated: boolean;
  username: string | null;
  login: () => void;
  logout: () => void | Promise<void>;
  hasRealmRole: (role: string) => boolean;
  getValueFromToken: (key: string) => unknown;
  secureFetch: (url: string, init?: RequestInit) => Promise<Response>;
  signInAs: (username: string) => Promise<void>;
  demoPickerOpen: boolean;
  closeDemoPicker: () => void;
  demoUsers: readonly { username: string; firstName: string; lastName: string; role: RoleKey }[];
};

export const AppAuthProviderContext = createContext<AppAuth | null>(null);
