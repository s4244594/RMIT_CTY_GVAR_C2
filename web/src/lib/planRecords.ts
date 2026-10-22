export const PLAN_KINDS = [
  "goals",
  "support_needs",
  "health",
  "funding",
  "service_agreement",
] as const;

export type PlanKind = (typeof PLAN_KINDS)[number];

export const PLAN_KIND_LABELS: Record<PlanKind, string> = {
  goals: "Goals",
  support_needs: "Support needs",
  health: "Health",
  funding: "Funding",
  service_agreement: "Service agreement",
};

export function planTagForParticipant(participantId: string): string {
  return `participant_${participantId.replaceAll("-", "")}`;
}

export function encodePlanCiphertext(value: string | Uint8Array): string {
  return typeof value === "string"
    ? JSON.stringify({ format: "string", value })
    : JSON.stringify({ format: "bytes", value: Array.from(value) });
}

export function decodePlanCiphertext(ciphertext: string): string | Uint8Array {
  const parsed: unknown = JSON.parse(ciphertext);
  if (!parsed || typeof parsed !== "object") throw new Error("Invalid encrypted plan record.");
  const value = parsed as { format?: unknown; value?: unknown };
  if (value.format === "string" && typeof value.value === "string") return value.value;
  if (value.format === "bytes" && Array.isArray(value.value) && value.value.every((byte) => Number.isInteger(byte) && byte >= 0 && byte <= 255)) {
    return Uint8Array.from(value.value);
  }
  throw new Error("Invalid encrypted plan record.");
}

export function decodePlanText(value: string | Uint8Array): string {
  return typeof value === "string" ? value : new TextDecoder().decode(value);
}