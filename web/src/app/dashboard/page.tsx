"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTideCloak } from "@tidecloak/nextjs";
import { RoleGate } from "@/components/RoleGate";
import { ROLES, roleOf } from "@/lib/roles";

// Sends each person to their own role's dashboard.
export default function DashboardRedirect() {
  const { authenticated, hasRealmRole } = useTideCloak();
  const router = useRouter();
  const role = authenticated ? roleOf(hasRealmRole) : null;

  useEffect(() => {
    if (role) router.replace(ROLES[role].path);
  }, [role, router]);

  return (
    <RoleGate role="any">
      <div className="container loading">{role ? "Opening your dashboard…" : "Your account has no Claim Chain role yet."}</div>
    </RoleGate>
  );
}
