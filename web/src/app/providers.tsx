"use client";

import { AppAuthProvider } from "@/lib/auth/appAuth";

export function Providers({ children }: { children: React.ReactNode }) {
  return <AppAuthProvider>{children}</AppAuthProvider>;
}
