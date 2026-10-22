// Client-safe role metadata. The server never trusts this; it reads roles from the verified token.

export const ROLES = {
  worker: { label: "Support worker", path: "/dashboard/worker" },
  participant: { label: "Participant", path: "/dashboard/participant" },
  provider: { label: "Provider", path: "/dashboard/provider" },
  approver: { label: "Agency approver", path: "/dashboard/approver" },
  sysadmin: { label: "System admin", path: "/dashboard/admin" },
} as const;

export type RoleKey = keyof typeof ROLES;

export function roleOf(hasRealmRole: (r: string) => boolean): RoleKey | null {
  return (Object.keys(ROLES) as RoleKey[]).find((r) => hasRealmRole(r)) ?? null;
}
