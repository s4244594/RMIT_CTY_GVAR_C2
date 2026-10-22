import type { NextRequest } from "next/server";
import { HttpError } from "./caller";

/** The path segment after `after`, e.g. pathParam(req, "claims") on /api/claims/X/steps -> "X". */
export function pathParam(req: NextRequest, after: string): string {
  const parts = new URL(req.url).pathname.split("/");
  const i = parts.indexOf(after);
  const value = i >= 0 ? parts[i + 1] : undefined;
  if (!value) throw new HttpError(400, `Missing ${after} id in the URL.`);
  return decodeURIComponent(value);
}
