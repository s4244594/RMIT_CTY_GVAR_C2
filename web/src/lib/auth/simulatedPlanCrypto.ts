import type { DecryptedItem, EncryptedItem } from "./simulatedAuthContext";

const PREFIX = "claimchain-local-plan-v1";

function assertSimulationMode() {
  if (process.env.NODE_ENV === "production" || process.env.NEXT_PUBLIC_AUTH_MODE !== "simulated") {
    throw new Error("Local plan encryption is only available in development simulation mode.");
  }
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
}

function keyStorageId(username: string, tags: string[]): string {
  const scope = [...tags].sort().join(",");
  return `claimchain-local-plan-key:${username}:${scope}`;
}

async function getSessionKey(username: string, tags: string[], usage: KeyUsage[]): Promise<CryptoKey> {
  if (typeof window === "undefined" || !window.crypto?.subtle) {
    throw new Error("Browser encryption is unavailable in this environment.");
  }
  if (tags.length === 0) throw new Error("A plan encryption tag is required.");

  const storageId = keyStorageId(username, tags);
  let raw = sessionStorage.getItem(storageId);
  if (!raw) {
    const generated = crypto.getRandomValues(new Uint8Array(32));
    raw = bytesToBase64(generated);
    sessionStorage.setItem(storageId, raw);
  }

  return crypto.subtle.importKey("raw", base64ToBytes(raw), { name: "AES-GCM" }, false, usage);
}

export async function encryptSimulatedPlan(
  username: string,
  items: EncryptedItem[],
): Promise<string[]> {
  assertSimulationMode();
  return Promise.all(items.map(async ({ data, tags }) => {
    const key = await getSessionKey(username, tags, ["encrypt"]);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const plaintext = typeof data === "string" ? new TextEncoder().encode(data) : data;
    const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext);
    return `${PREFIX}.${bytesToBase64(iv)}.${bytesToBase64(new Uint8Array(encrypted))}`;
  }));
}

export async function decryptSimulatedPlan(
  username: string,
  items: DecryptedItem[],
): Promise<string[]> {
  assertSimulationMode();
  return Promise.all(items.map(async ({ encrypted, tags }) => {
    if (typeof encrypted !== "string") throw new Error("Invalid local test ciphertext.");
    const [prefix, encodedIv, encodedData, extra] = encrypted.split(".");
    if (prefix !== PREFIX || !encodedIv || !encodedData || extra) {
      throw new Error("This plan record was not encrypted by the local test adapter.");
    }
    const key = await getSessionKey(username, tags, ["decrypt"]);
    const plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: base64ToBytes(encodedIv) },
      key,
      base64ToBytes(encodedData),
    );
    return new TextDecoder().decode(plaintext);
  }));
}